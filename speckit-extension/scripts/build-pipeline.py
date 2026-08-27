#!/usr/bin/env python3
"""Build a project's pipeline from its `companion.yml`.

The configuration is the source of truth; the command bodies are derived output.
Until now nothing derived them: `resolve_order` and `merge_hooks` resolved a
project's recipe and hooks and had no production caller, so a project could
declare a different node order or a hook and get the shipped pipeline anyway.

What a build does, in order:

  1. read `.specify/companion.yml` (the constrained subset — anything outside it
     is refused loudly, naming the line, rather than half-applied)
  2. per command: resolve the node order, check every kept node's inputs are
     still produced, resolve the hooks
  3. assemble each body from its nodes, with boundaries, and splice the hooks in
     at those boundaries
  4. write the bodies and the artifact manifest
  5. say what changed

Nothing is written until every command has assembled. A build that cannot
complete leaves the previous pipeline exactly as it was.

Read-only against the extension's own sources — it never edits `nodes/`.
Stdlib only.
"""
from __future__ import annotations

import argparse
import difflib
import importlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import companion_config as cc  # noqa: E402
import hook_render  # noqa: E402
from _command_parts import decomposed_commands, nodes_command_dir  # noqa: E402

assemble = importlib.import_module("assemble-nodes")
manifest_mod = importlib.import_module("manifest")

CONFIG_REL = os.path.join(".specify", "companion.yml")
DEFAULT_OUT_REL = os.path.join(".specify", "extensions", "companion", "commands")


class BuildError(Exception):
    """A build that cannot complete. Nothing has been written when this is raised."""


def load_config(project_root: str) -> dict:
    path = os.path.join(project_root, CONFIG_REL)
    if not os.path.isfile(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    try:
        return cc.load_yaml(text) or {}
    except (ValueError, SystemExit) as err:
        # The reader names the line it refused; a build that cannot read the
        # configuration must say so rather than fall back to the defaults and
        # look like it applied one.
        raise BuildError(f"{CONFIG_REL}: {err}") from err


def plan_build(config: dict) -> tuple[dict, list]:
    """Resolve every command's order and hooks. Returns (plan, warnings).

    Raises before anything is written when a recipe drops a node another kept
    node reads, or names a hook node that does not exist.
    """
    plan = {}
    warnings = []
    for command in decomposed_commands():
        default = assemble.default_order(command)
        order = cc.resolve_order(config, command, default)

        missing = [n for n in order if n not in default]
        if missing:
            raise BuildError(
                f"{command}: recipe names nodes that do not exist: {', '.join(missing)}"
            )

        try:
            cc.validate_reads(assemble.node_reads_map(command, order))
        except cc.ConfigError as err:
            raise BuildError(f"{command}: {err}") from err

        try:
            hooks, hook_warnings = cc.merge_hooks(
                config, command, order, nodes_dir=os.path.join(EXT, "presets", "_parts")
            )
        except cc.ConfigError as err:
            raise BuildError(f"{command}: {err}") from err

        warnings.extend(hook_warnings)
        plan[command] = {"order": order, "hooks": hooks, "default": default}
    return plan, warnings


def render(command: str, entry: dict) -> str:
    """The finished body for one command: nodes in the resolved order, hooks spliced in."""
    body = assemble.assemble_command(command, order=entry["order"])
    return hook_render.insert_hooks(
        body, entry["hooks"], nodes_dir=os.path.join(EXT, "presets", "_parts")
    )


def describe(command: str, entry: dict) -> str:
    """One line saying how this command differs from the shipped default."""
    order, default = entry["order"], entry["default"]
    bits = []
    dropped = [n for n in default if n not in order]
    added = [n for n in order if n not in default]
    if dropped:
        bits.append(f"−{len(dropped)} node ({', '.join(dropped)})" if len(dropped) == 1
                    else f"−{len(dropped)} nodes ({', '.join(dropped)})")
    if added:
        bits.append(f"+{len(added)} node ({', '.join(added)})")
    if not dropped and not added and order != default:
        bits.append("reordered")
    if entry["hooks"]:
        bits.append(f"{len(entry['hooks'])} hook" + ("" if len(entry["hooks"]) == 1 else "s"))
    return f"  {command}: " + (", ".join(bits) if bits else "shipped default")


def preview(bodies: dict, out_dir: str) -> list:
    """How each command's body differs from what is built right now.

    A build overwrites the commands the assistant reads, so the question worth
    answering before writing is not "what will it contain" but "what changes".
    An unbuilt command is reported as new rather than as a diff against nothing.
    """
    lines = []
    for command, body in sorted(bodies.items()):
        target = os.path.join(out_dir, f"speckit.companion.{command}.md")
        if not os.path.isfile(target):
            lines.append(f"  {command}: new — {len(body.splitlines())} lines")
            continue
        with open(target, encoding="utf-8") as fh:
            current = fh.read()
        if current == body:
            lines.append(f"  {command}: unchanged")
            continue
        diff = list(difflib.unified_diff(
            current.splitlines(), body.splitlines(),
            fromfile=f"{command} (built)", tofile=f"{command} (next)", lineterm="",
        ))
        added = sum(1 for d in diff if d.startswith("+") and not d.startswith("+++"))
        removed = sum(1 for d in diff if d.startswith("-") and not d.startswith("---"))
        lines.append(f"  {command}: +{added} −{removed} lines")
        lines.extend(f"    {d}" for d in diff if d.startswith(("+", "-")) and
                     not d.startswith(("+++", "---")))
    return lines


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--project", default=os.getcwd(),
                    help="project root holding .specify/companion.yml (default: cwd)")
    ap.add_argument("--out", help=f"where to write the bodies (default: <project>/{DEFAULT_OUT_REL})")
    ap.add_argument("--dry-run", action="store_true",
                    help="say what would change and write nothing")
    args = ap.parse_args()

    project = os.path.abspath(args.project)
    out_dir = os.path.abspath(args.out) if args.out else os.path.join(project, DEFAULT_OUT_REL)

    try:
        config = load_config(project)
        plan, warnings = plan_build(config)
        # Every body is rendered before any is written: a build that cannot
        # finish must leave the working pipeline in place.
        bodies = {command: render(command, entry) for command, entry in plan.items()}
    except BuildError as err:
        print(f"[build] cannot build — nothing was written\n  {err}", file=sys.stderr)
        return 1

    for warning in warnings:
        print(f"[build] {warning}")

    print(f"[build] {'would build' if args.dry_run else 'built'} "
          f"{len(bodies)} commands from {CONFIG_REL if config else 'the shipped defaults'}")
    for command, entry in plan.items():
        print(describe(command, entry))

    manifest = manifest_mod.build(orders={c: e["order"] for c, e in plan.items()})
    print(manifest_mod.render(manifest))

    if args.dry_run:
        print("[build] what would change:")
        for line in preview(bodies, out_dir):
            print(line)
        return 0

    os.makedirs(out_dir, exist_ok=True)
    for command, body in bodies.items():
        target = os.path.join(out_dir, f"speckit.companion.{command}.md")
        with open(target, "w", encoding="utf-8") as fh:
            fh.write(body)
    with open(os.path.join(out_dir, ".manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")

    print(f"[build] wrote {len(bodies)} command bodies + the manifest to "
          f"{os.path.relpath(out_dir, project)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
