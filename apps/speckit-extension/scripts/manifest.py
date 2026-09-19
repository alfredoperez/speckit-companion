#!/usr/bin/env python3
"""What a built pipeline expects each run to produce, and which node produces it.

Every author node already declared its output in `writes:`. Nothing read it —
the field was documentation shaped like data, sitting in the frontmatter of six
nodes while the docs described it as metadata only. So a build could not say what
it was going to produce, a run could not be checked against what it claimed, and
a step that quietly stopped writing its document looked exactly like one that
wrote it.

The manifest makes that declaration answerable. It is derived, never hand-kept:
built from the same node order the assembler uses, so it cannot describe a
pipeline other than the one that was assembled.

Read-only. Stdlib only.
"""
from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from _command_parts import decomposed_commands, read_node  # noqa: E402
from spec_context import feature_spec_path  # noqa: E402

MANIFEST_PATH = os.path.join(EXT, "commands", ".manifest.json")


def _declared_artifacts(command: str, order: list) -> list:
    """What each node in the order produces, in the order they run.

    A node may name one artifact or several. The node's id travels with it: an
    artifact nobody can attribute is a report nobody can act on.

    Two kinds. `writes:` is what the step always produces. `may-write:` is what
    it produces unless the size budget folds it away — `plan` writes research
    and data-model at `normal` and above, and folds them into `plan.md` at
    `simple`. Both belong in the manifest, because a panel that showed `plan`
    producing one file was undercounting the step by three. Only the first kind
    is checked: calling a `simple` run incomplete for doing what it was told is
    the manifest crying wolf.
    """
    out = []
    for node_id in order:
        meta, _ = read_node(command, node_id)
        for key, conditional in (("writes", False), ("may-write", True)):
            declared = meta.get(key)
            if not declared:
                continue
            names = declared if isinstance(declared, list) else [declared]
            for name in names:
                name = str(name).strip()
                if name:
                    out.append({
                        "artifact": name, "node": node_id, "conditional": conditional,
                    })
    return out


def build(orders: dict | None = None) -> dict:
    """The manifest for the current node graph.

    `orders` lets a caller pass the order actually assembled (a project's recipe,
    once configuration reaches the assembler) instead of the shipped default.
    """
    assemble = importlib.import_module("assemble-nodes")
    commands = {}
    for command in decomposed_commands():
        order = (orders or {}).get(command) or assemble.default_order(command)
        commands[command] = _declared_artifacts(command, order)
    total = sum(len(v) for v in commands.values())
    return {"commands": commands, "artifactCount": total}


def artifacts_for(manifest: dict, command: str) -> list:
    """Just the artifact names one command expects to produce."""
    return [entry["artifact"] for entry in manifest["commands"].get(command, [])]


def unproduced(manifest: dict, command: str, feature_dir: str) -> list:
    """Artifacts the command declared and the run did not leave on disk.

    This is the check the declaration was always for. A step that quietly stops
    writing its document is indistinguishable from one that wrote it — the run
    reports success either way — and that silence is the failure this turns into
    a statement.

    A `may-write` artifact is skipped: the size budget is allowed to fold it
    away, so its absence is the pipeline working, not failing.

    Returns `[{artifact, node}]`, empty when every declared artifact is there.
    """
    missing = []
    for entry in manifest["commands"].get(command, []):
        if entry.get("conditional"):
            continue
        target = os.path.join(feature_dir, entry["artifact"])
        if entry["artifact"].endswith(".spec.md"):
            target = str(feature_spec_path(Path(feature_dir)))
        if not os.path.isfile(target):
            missing.append(entry)
    return missing


def render_unproduced(command: str, missing: list) -> str:
    """The report for a command that did not produce what it said it would."""
    lines = [f"[manifest] {command} declared artifacts it did not produce:"]
    for entry in missing:
        lines.append(f"  - {entry['artifact']} (declared by {entry['node']})")
    lines.append("  The step reported success; the file is not there. Either the node "
                 "did not run, or its `writes:` names something it never writes.")
    return "\n".join(lines)


def render(manifest: dict) -> str:
    lines = []
    for command, entries in manifest["commands"].items():
        if not entries:
            continue
        produced = ", ".join(f"{e['artifact']} ({e['node']})" for e in entries)
        lines.append(f"  {command}: {produced}")
    if not lines:
        return "[manifest] no node declares an artifact"
    return "[manifest] a run of this pipeline writes:\n" + "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", dest="as_json", action="store_true")
    ap.add_argument("--write", action="store_true",
                    help="write the manifest beside the built commands")
    ap.add_argument("--verify", metavar="COMMAND",
                    help="report artifacts COMMAND declared but did not produce")
    ap.add_argument("--feature-dir", help="the spec directory to verify against")
    args = ap.parse_args()

    manifest = build()

    if args.verify:
        feature_dir = args.feature_dir or os.getcwd()
        missing = unproduced(manifest, args.verify, feature_dir)
        if missing:
            print(render_unproduced(args.verify, missing))
            return 1
        declared = artifacts_for(manifest, args.verify)
        noun = "artifact" if len(declared) == 1 else "artifacts"
        print(f"[manifest] {args.verify} produced all {len(declared)} declared {noun}")
        return 0
    if args.write:
        with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
            json.dump(manifest, fh, indent=2)
            fh.write("\n")
        print(f"[manifest] wrote {os.path.relpath(MANIFEST_PATH, EXT)} "
              f"— {manifest['artifactCount']} artifacts")
    elif args.as_json:
        print(json.dumps(manifest, indent=2))
    else:
        print(render(manifest))
    return 0


if __name__ == "__main__":
    sys.exit(main())
