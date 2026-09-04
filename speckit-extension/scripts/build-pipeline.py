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
import decision_routes as decisions_mod  # noqa: E402
import emission_sync  # noqa: E402
import hook_render  # noqa: E402
import template_render  # noqa: E402
from _command_parts import (  # noqa: E402
    PROJECT_NODES_REL,
    decomposed_commands,
    frame_source,
    node_source,
    read_node,
    nodes_command_dir,
    project_commands,
    use_project_nodes,
)

assemble = importlib.import_module("assemble-nodes")
manifest_mod = importlib.import_module("manifest")

CONFIG_REL = os.path.join(".specify", "companion.yml")
TEMPLATES_REL = os.path.join(".specify", "templates")
FRAGMENTS_REL = os.path.join(".specify", "companion", "fragments")
#: A project's own node files, which a `type: node` hook may name by id.
USER_NODES_REL = os.path.join(".specify", "companion", "nodes")
#: Whole named configurations a project can switch between.
WORKFLOWS_REL = os.path.join(".specify", "companion", "workflows")
DEFAULT_OUT_REL = os.path.join(".specify", "extensions", "companion", "commands")

#: The name for "Companion with nothing changed" — always offered, never a file.
SHIPPED_WORKFLOW = "shipped"


class BuildError(Exception):
    """A build that cannot complete. Nothing has been written when this is raised."""


def _read_yaml(path: str, label: str) -> dict:
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
        raise BuildError(f"{label}: {err}") from err


#: Stock spec-kit's own extension registry. A Companion run fires these too.
EXTENSIONS_REL = os.path.join(".specify", "extensions.yml")


def stock_hooks(project_root: str, command: str) -> list:
    """Hooks stock spec-kit extensions attach to this step, before and after.

    These are a second, independent hook system: `.specify/extensions.yml` is
    spec-kit's own registry, keyed by lifecycle step, and a Companion run fires
    it alongside `companion.yml`. Drawing only Companion's half told a project
    it had nine hooks when it had fifteen — a panel that is wrong by omission.

    Never raises: a registry that cannot be read is reported as no hooks, the
    same silent-skip the command bodies apply at run time.
    """
    path = os.path.join(project_root, EXTENSIONS_REL)
    if not os.path.isfile(path):
        return []
    try:
        with open(path, encoding="utf-8") as fh:
            registry = cc.load_yaml(fh.read()) or {}
    except (ValueError, SystemExit, OSError):
        return []

    hooks = registry.get("hooks")
    if not isinstance(hooks, dict):
        return []

    out = []
    for when in cc.WHENS:
        for entry in hooks.get(f"{when}_{command}") or []:
            if not isinstance(entry, dict):
                continue
            # Absent `enabled` means enabled, matching the command bodies.
            if entry.get("enabled") is False:
                continue
            out.append({
                "when": when,
                "extension": str(entry.get("extension") or "an extension"),
                "command": str(entry.get("command") or ""),
                "description": str(entry.get("description") or "").strip(),
                "optional": bool(entry.get("optional")),
                # A condition is the HookExecutor's to evaluate, not ours — so
                # the panel says "sometimes" rather than promising it will run.
                "conditional": bool(str(entry.get("condition") or "").strip()),
            })
    return out


#: Where an agent keeps its skills. A skill hook names one of these.
SKILL_DIRS = [
    os.path.join(".claude", "skills"),
    os.path.join(".agents", "skills"),
    os.path.join(".specify", "skills"),
]


def available_skills(project_root: str) -> list:
    """Skill names this project has, so a hook can be picked rather than typed.

    A skill hook was a free-text box: you had to already know the name, and a
    typo produced a hook that silently invoked nothing.
    """
    found = set()
    for rel in SKILL_DIRS:
        directory = os.path.join(project_root, rel)
        if not os.path.isdir(directory):
            continue
        for entry in os.listdir(directory):
            path = os.path.join(directory, entry)
            if os.path.isdir(path) and os.path.isfile(os.path.join(path, "SKILL.md")):
                found.add(entry)
            elif entry.endswith(".md") and not entry.startswith("_"):
                found.add(entry[:-3])
    return sorted(found)


def available_hook_nodes(project_root: str) -> list:
    """Node files a `type: node` hook can name — the project's, then the shipped parts."""
    found = set()
    for directory in ([os.path.join(project_root, USER_NODES_REL)]
                      + [os.path.join(EXT, "presets", "_parts")]):
        if not os.path.isdir(directory):
            continue
        found.update(
            f[:-3] for f in os.listdir(directory)
            if f.endswith(".md") and not f.startswith("_")
        )
    return sorted(found)


#: Whole configurations Companion ships as starting points for a new workflow.
PRESETS_DIR = os.path.join(EXT, "workflows", "presets")


def available_presets() -> list:
    """The starting configurations Companion ships, as `{name, label, summary}`.

    A preset is an ordinary workflow file: picking one seeds a project workflow
    with its contents and nothing more, so everything it sets stays editable
    afterwards. `name` is the filename, which is what seeding names.
    """
    if not os.path.isdir(PRESETS_DIR):
        return []
    out = []
    for filename in sorted(os.listdir(PRESETS_DIR)):
        if not filename.endswith(".yml") or filename.startswith("_"):
            continue
        try:
            meta = _read_yaml(os.path.join(PRESETS_DIR, filename), filename)
        except BuildError:
            # One preset nobody can read is a preset missing from the list, not
            # a panel that will not draw.
            continue
        out.append({
            "name": filename[:-4],
            "label": str(meta.get("preset") or filename[:-4]),
            "summary": str(meta.get("summary") or ""),
        })
    return out


def available_workflows(project_root: str) -> list:
    """Named workflows this project has written, by name, sorted."""
    directory = os.path.join(project_root, WORKFLOWS_REL)
    if not os.path.isdir(directory):
        return []
    return sorted(
        f[:-4] for f in os.listdir(directory)
        if f.endswith(".yml") and not f.startswith("_")
    )


def active_workflow(project_root: str) -> str:
    """Which workflow `companion.yml` selects. Absent means companion.yml itself."""
    base = _read_yaml(os.path.join(project_root, CONFIG_REL), CONFIG_REL)
    name = base.get("workflow")
    return str(name).strip() if isinstance(name, str) and name.strip() else ""


def load_config(project_root: str) -> dict:
    """The configuration a build works from.

    `companion.yml` is the project's configuration. A `workflow: <name>` in it
    hands over to `.specify/companion/workflows/<name>.yml` INSTEAD — switching
    workflows switches the whole configuration at once, which is the point, so
    the two are never merged into a third thing nobody wrote.

    The reserved name `shipped` selects no configuration at all.
    """
    base = _read_yaml(os.path.join(project_root, CONFIG_REL), CONFIG_REL)
    name = active_workflow(project_root)
    if not name:
        return base
    if name == SHIPPED_WORKFLOW:
        return {}

    path = os.path.join(project_root, WORKFLOWS_REL, f"{name}.yml")
    if not os.path.isfile(path):
        known = available_workflows(project_root)
        raise BuildError(
            f"{CONFIG_REL}: workflow '{name}' has no file at "
            f"{os.path.join(WORKFLOWS_REL, name + '.yml')}"
            + (f" — this project has: {', '.join(known)}" if known else "")
        )
    return _read_yaml(path, os.path.join(WORKFLOWS_REL, f"{name}.yml"))


#: Set for the project being built, so a `type: node` hook can name a file the
#: project wrote. Empty means the extension's own parts only.
_user_nodes_dir = None


def hook_node_dirs() -> list:
    """Where a `type: node` ref is looked for: the project first, then the extension."""
    return ([_user_nodes_dir] if _user_nodes_dir else []) + [
        os.path.join(EXT, "presets", "_parts")]


def use_project_hook_nodes(project_root: str) -> None:
    global _user_nodes_dir
    _user_nodes_dir = os.path.join(project_root, USER_NODES_REL) if project_root else None


def plan_build(config: dict) -> tuple[dict, list]:
    """Resolve every command's order and hooks. Returns (plan, warnings).

    Raises before anything is written when a recipe drops a node another kept
    node reads, or names a hook node that does not exist.
    """
    plan = {}
    warnings = []
    own_steps = set(project_commands())
    # A project may name and regroup the phases, so that is resolved before
    # anything reads one.
    try:
        assemble.use_project_phases({
            command: cc.resolve_phases(config, command)
            for command in decomposed_commands()
        })
    except cc.ConfigError as err:
        raise BuildError(str(err)) from err

    for command in decomposed_commands():
        default = assemble.default_order(command)
        order = cc.resolve_order(config, command, default)

        # A recipe may name a node the project wrote, not only one that ships.
        # Without this, replacing what a whole step DOES meant rewriting each
        # shipped node in place — you could not hand the step to one document of
        # your own and adapt it.
        # An exists check rather than the replaced flag: a shipped optional
        # node — an add-on, or a variant of a default one — is neither in the
        # default order nor a project copy, and naming it is exactly what a
        # recipe that adds a block does.
        missing = [
            n for n in order
            if n not in default and not os.path.isfile(node_source(command, n)[0])
        ]
        if missing:
            raise BuildError(
                f"{command}: names nodes that are neither shipped nor in "
                f"{os.path.join(PROJECT_NODES_REL, command)}: {', '.join(missing)}"
            )

        try:
            cc.validate_reads(assemble.node_reads_map(command, order),
                              assemble.stands_in_for(command))
        except cc.ConfigError as err:
            raise BuildError(f"{command}: {err}") from err

        # A hook may anchor on a node or on a phase — the design's coarser
        # boundary — so both are valid anchor names. Without the phase names
        # here, a hook attached to one is warned about and silently skipped.
        phases = assemble.phases_for(command, order)
        unknown = [
            n for phase in assemble.declared_phases(command) for n in phase["nodes"]
            if n not in default and not os.path.isfile(node_source(command, n)[0])
        ]
        if unknown:
            raise BuildError(
                f"{command}: phases name nodes that do not exist: {', '.join(unknown)}")

        stray = assemble.unexpressible_order(command, order)
        if stray:
            raise BuildError(
                f"{command}: '{stray}' is ordered across a phase boundary. Phases are "
                f"contiguous in the body, so this order cannot be built — move it "
                f"within its phase, or change the phase it belongs to."
            )
        # A hook anchors on a node, a phase, or the step itself. The step is the
        # only anchor that survives a regroup: naming the first phase means
        # re-pointing the hook the day that phase is renamed or split.
        anchors = list(order) + [phase["name"] for phase in phases] + [command]

        try:
            hooks, hook_warnings = cc.merge_hooks(
                config, command, anchors, nodes_dir=hook_node_dirs()
            )
        except cc.ConfigError as err:
            raise BuildError(f"{command}: {err}") from err

        warnings.extend(hook_warnings)
        declared = decisions_mod.decisions_for(command, os.path.join(EXT, "nodes"))
        resolved, changed = decisions_mod.apply_overrides(declared, config, command)
        problems = decisions_mod.validate(resolved, set(decomposed_commands()))
        if problems:
            raise BuildError(f"{command}: " + "; ".join(problems))

        shipped_phases = assemble.shipped_phases(command)
        plan[command] = {"order": order, "hooks": hooks, "default": default,
                         "phases": phases, "decisions": resolved,
                         "decisionsChanged": changed,
                         "phasesChanged": [
                             p["name"] for p in phases
                             if p["name"] not in {s["name"] for s in shipped_phases}
                         ],
                         # A step this project added is its own, not a change to
                         # one that ships — nothing in it replaces anything.
                         "own": command in own_steps,
                         "replaced": ([] if command in own_steps
                                      else [n for n in order
                                            if node_source(command, n)[1]])}
    return plan, warnings


def plan_templates(config: dict, project_root: str) -> dict:
    """Resolve every template a project asked to change. `{command: (name, text, sections)}`.

    Raises before anything is written when a section named in the configuration
    is not in the template, or names a fragment the project has not written — a
    template override that quietly does nothing is the same silence as a hook
    that never fires.
    """
    templates_dir = os.path.join(project_root, TEMPLATES_REL)
    fragments_dir = os.path.join(project_root, FRAGMENTS_REL)
    resolved = {}
    for command in decomposed_commands():
        try:
            name, text, changed = template_render.resolve(
                command, config, templates_dir, fragments_dir
            )
        except template_render.TemplateError as err:
            raise BuildError(str(err)) from err
        if name and text is not None:
            resolved[command] = (name, text, changed)
    return resolved


def _description(command: str) -> str:
    """What a step says it is, for an emission that has to be created for it.

    The frame's `description:` is the step's own one-liner, which is what the
    installer would have used had it ever seen this step.
    """
    frame, _replaced = frame_source(command)
    if not os.path.isfile(frame):
        return ""
    with open(frame, encoding="utf-8") as fh:
        head = fh.read(600)
    for line in head.splitlines():
        if line.startswith("description:"):
            return line[len("description:"):].strip().strip("\"'")
    return ""


def render(command: str, entry: dict, template=None) -> str:
    """The finished body: nodes in the resolved order, hooks and any routing change spliced in."""
    body = assemble.assemble_command(command, order=entry["order"])
    body = hook_render.insert_hooks(
        body, entry["hooks"], nodes_dir=hook_node_dirs(), command=command)

    # A project that changed where a verdict routes has to tell the assistant,
    # which is the thing that acts on the verdict. The note goes after the node
    # that decides, so it is read with the decision rather than out of context.
    note = decisions_mod.render_override_note(
        entry.get("decisions") or [], entry.get("decisionsChanged") or [])
    if note:
        for decision in entry["decisions"]:
            marker = f"<!-- /speckit-companion:node {decision['node']} -->\n"
            if marker in body:
                body = body.replace(marker, marker + note + "\n", 1)
                break

    # A reshaped document is only reshaped if the assistant is told to follow it.
    # The nodes carry their own shape in their instructions, so a resolved
    # template sat on disk read by nothing. The note goes above the first node
    # that writes the document, where the shape is about to be used.
    if template:
        name, _text, changed = template
        shape = template_render.render_shape_note(name, changed)
        if shape:
            body = _above_first_writer(body, command, entry["order"], shape)
    return body


def _above_first_writer(body: str, command: str, order: list, note: str) -> str:
    """Put `note` immediately before the first node in `order` that writes a file.

    Above the node that produces the document, so it is read with the
    instructions it changes rather than as a preamble far from them. A step whose
    nodes declare nothing takes it at the top of the first node instead — still
    inside the run, still before any authoring.
    """
    writers = [
        nid for nid in order
        if (read_node(command, nid)[0].get("writes") or "")
    ]
    for nid in (writers or order):
        marker = f"<!-- speckit-companion:node {nid} -->\n"
        if marker in body:
            return body.replace(marker, marker + note + "\n\n", 1)
    return note + "\n\n" + body


def describe(command: str, entry: dict) -> str:
    """One line saying how this command differs from the shipped default."""
    order, default = entry["order"], entry["default"]
    # A step the extension does not ship has no default to differ from, so every
    # node in it would read as "replaced" — replacing nothing.
    if entry.get("own"):
        return (f"  {command}: this project's own step, "
                f"{len(order)} node" + ("" if len(order) == 1 else "s"))
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
    replaced = entry.get("replaced") or []
    if replaced:
        bits.append(f"{len(replaced)} replaced ({', '.join(replaced)})")
    renamed = entry.get("phasesChanged") or []
    if renamed:
        bits.append(f"phases: {', '.join(renamed)}")
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

    # A project's own node files replace the shipped ones of the same id, so this
    # has to be in force before anything reads a node.
    use_project_nodes(project)
    use_project_hook_nodes(project)

    try:
        config = load_config(project)
        plan, warnings = plan_build(config)
        # Every body and template is resolved before any is written: a build that
        # cannot finish must leave the working pipeline in place.
        # Templates first: a body now carries a note naming the sections this
        # project reshaped, so it cannot be rendered before they are resolved.
        templates = plan_templates(config, project)
        bodies = {command: render(command, entry, templates.get(command))
                  for command, entry in plan.items()}
    except BuildError as err:
        print(f"[build] cannot build — nothing was written\n  {err}", file=sys.stderr)
        return 1

    for warning in warnings:
        print(f"[build] {warning}")

    print(f"[build] {'would build' if args.dry_run else 'built'} "
          f"{len(bodies)} commands from {CONFIG_REL if config else 'the shipped defaults'}")
    for command, entry in plan.items():
        print(describe(command, entry))

    routed = [(c, e) for c, e in plan.items() if e.get("decisions")]
    if routed:
        print("[build] decisions:")
        for command, entry in routed:
            print(decisions_mod.render(entry["decisions"]))
            if entry.get("decisionsChanged"):
                print(f"    (this project changed: {', '.join(entry['decisionsChanged'])})")

    replaced = {c: e["replaced"] for c, e in plan.items() if e.get("replaced")}
    if replaced:
        total = sum(len(v) for v in replaced.values())
        print(f"[build] {total} node" + ("" if total == 1 else "s") +
              f" replaced from {PROJECT_NODES_REL}:")
        for command, ids in sorted(replaced.items()):
            print(f"  {command}: {', '.join(ids)}")

    if templates:
        print("[build] templates resolved:")
        for command, (name, _, changed) in sorted(templates.items()):
            detail = f"{', '.join(changed)} replaced" if changed else "used as-is"
            print(f"  {command}: {name} — {detail}")

    manifest = manifest_mod.build(orders={c: e["order"] for c, e in plan.items()})
    print(manifest_mod.render(manifest))

    if args.dry_run:
        print("[build] what would change:")
        for line in preview(bodies, out_dir):
            print(line)
        # A preview that lists the extension's copies and stays silent about the
        # files the assistant reads is the same half-answer the build gave.
        reachable = {c: emission_sync.emission_paths(project, c) for c in bodies}
        count = sum(len(p) for p in reachable.values())
        if count:
            print(f"  and refresh {count} agent command "
                  f"{'file' if count == 1 else 'files'} from them")
        missing = [c for c, paths in sorted(reachable.items()) if not paths]
        if missing:
            print(f"  and give an agent command to: {', '.join(missing)}")
        return 0

    os.makedirs(out_dir, exist_ok=True)
    for command, body in bodies.items():
        target = os.path.join(out_dir, f"speckit.companion.{command}.md")
        with open(target, "w", encoding="utf-8") as fh:
            fh.write(body)
    if templates:
        template_out = os.path.join(os.path.dirname(out_dir), "templates")
        os.makedirs(template_out, exist_ok=True)
        for _command, (name, text, _changed) in templates.items():
            with open(os.path.join(template_out, name), "w", encoding="utf-8") as fh:
                fh.write(text)

    with open(os.path.join(out_dir, ".manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")

    print(f"[build] wrote {len(bodies)} command bodies + the manifest to "
          f"{os.path.relpath(out_dir, project)}")

    # The bodies above are the extension's copy, and nothing dispatches it. What
    # an assistant loads is the emission the installer rendered into that agent's
    # own directory, once, when the extension was added. Without this a build
    # reported five commands and changed nothing the assistant would ever read.
    try:
        written, created, unreached, stale = emission_sync.sync(
            project, bodies,
            {c: _description(c) for c in bodies})
    except emission_sync.EmissionError as err:
        # The commands are written and correct; only the hand-off failed. Saying
        # so beats failing a build that did its own job.
        print(f"[build] could not refresh the agent commands — {err}")
        return 0
    for line in emission_sync.describe(written, created, unreached, project, stale):
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
