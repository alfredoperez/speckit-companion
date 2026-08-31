#!/usr/bin/env python3
"""The pipeline as a structure something else can draw.

The builder needs the same answer the build command works from — which steps,
which phases, which nodes, where the hooks land, what the decision routes to,
and how all of that differs from the shipped default. Deriving it a second time
in TypeScript would be a second source that drifts from this one within a
release, so the structure is emitted from here and read there.

Everything is resolved against the project's configuration, so what the builder
draws is what a build would produce — not the shipped defaults with the
project's changes imagined on top.

Read-only. Emits JSON on stdout. Stdlib only.
"""
from __future__ import annotations

import argparse
import importlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from _command_parts import (  # noqa: E402
    decomposed_commands,
    frame_source,
    node_source,
    project_commands,
    read_node,
    use_project_nodes,
)

assemble = importlib.import_module("assemble-nodes")
build = importlib.import_module("build-pipeline")
manifest_mod = importlib.import_module("manifest")
template_render = importlib.import_module("template_render")


def _template(command: str, resolved, project_root: str, config: dict):
    """What the panel needs to offer this step's template: its name, what the
    project replaced, and every section it could replace.

    A step with no template at all gets `None` — the shape the panel already
    draws nothing for.
    """
    name = (resolved[0] if resolved
            else template_render.DEFAULT_TEMPLATE_BY_COMMAND.get(command))
    if not name:
        return None
    source = os.path.join(project_root, ".specify", "templates", name)
    available = []
    if os.path.isfile(source):
        with open(source, encoding="utf-8") as fh:
            available = [
                template_render._clean(m.group(2))
                for m in template_render.SECTION_RE.finditer(fh.read())
                if m.group(1) == "##"
            ]
    return {
        "file": name,
        "sections": resolved[2] if resolved else [],
        "sectionsAvailable": available,
        # Which fragment each replaced section is using, so a picker can show
        # the choice in force rather than only that one was made.
        "chosenBy": dict(
            (template_render.template_config(config, command).get("sections") or {})),
    }


def _summary(command: str, node_id: str) -> str:
    """A node's first line of instruction — what it does, for a picker."""
    try:
        _meta, body = read_node(command, node_id)
    except SystemExit:
        return ""
    for line in body.splitlines():
        line = line.strip()
        if line and not line.startswith(("<!--", "#")):
            return line[:120]
    return ""


def _variants(command: str, node_id: str, offered: dict) -> list:
    """The alternatives that stand in for this node — what "replace it" can pick.

    Only nodes whose file is actually present are offered: a variant named in
    `_order.yml` but never written would otherwise be a choice that build-errors.
    """
    out = []
    for variant_id in offered.get(node_id, []):
        path, _replaced = node_source(command, variant_id)
        if not os.path.isfile(path):
            continue
        meta, _body = read_node(command, variant_id)
        out.append({
            "id": variant_id,
            "name": meta.get("name") or variant_id,
            "summary": _summary(command, variant_id),
        })
    return out


def _node(command: str, node_id: str, hooks: list, pinned: str = "",
          variants: list = ()) -> dict:
    meta, _body = read_node(command, node_id)
    writes = meta.get("writes")
    source, replaced = node_source(command, node_id)
    return {
        # Alternatives for this slot: same place in the run, different
        # instructions. Empty for a node nothing stands in for.
        "variants": list(variants),
        "id": node_id,
        # Why this node cannot be dragged, or "" when it can. A node that looks
        # draggable and refuses is worse than one that never offered.
        "pinned": pinned,
        # Where these instructions actually came from, so the builder opens the
        # file someone can edit instead of the assembled body they cannot.
        "source": source,
        "replaced": replaced,
        # The id is a handle; the name is what a person reads. A project's copy
        # may have dropped the frontmatter, and it is still the same node — so
        # the shipped name stands in before the id does.
        "name": meta.get("name") or _shipped_name(command, node_id) or node_id,
        "kind": meta.get("kind") or "control",
        "reads": list(meta.get("reads") or []),
        "writes": ([writes] if isinstance(writes, str) else list(writes or [])),
        "hooks": [_hook(h) for h in hooks if h["anchor"] == node_id],
    }


def _shipped_name(command: str, node_id: str) -> str:
    """The name Companion gave this node, whatever a project's copy says."""
    path = os.path.join(EXT, "nodes", command, f"{node_id}.md")
    if not os.path.isfile(path):
        return ""
    with open(path, encoding="utf-8") as fh:
        head = fh.read(600)
    # Only the frontmatter: a `name:` in the body is prose, not the node's name.
    # The opening `---` is optional — several shipped nodes start straight at the
    # keys — so the closing one is the first `---` that is not line zero.
    for i, line in enumerate(head.split("\n")):
        stripped = line.strip()
        if stripped.startswith("name:"):
            return stripped.split(":", 1)[1].strip()
        if stripped == "---" and i > 0:
            break
    return ""


def _hook(entry: dict) -> dict:
    hook = entry["hook"]
    return {
        "when": entry["when"],
        "type": hook.get("type"),
        # Where this hook lives in the configuration, so the panel can edit or
        # remove it. Without an identity a hook could only ever be added.
        "anchor": entry["anchor"],
        "index": entry["index"],
        # One line describing what this hook does, since that is what a chip shows.
        "summary": (hook.get("run") or hook.get("text") or hook.get("ref") or "").strip(),
        # The extra line a skill hook may carry alongside its name.
        "note": (hook.get("text") or "").strip() if hook.get("type") == "skill" else "",
    }


#: The order a run goes through the pipeline. `decomposed_commands` is sorted by
#: name because a build does not care, but a drawing does: alphabetical puts
#: implement before plan and auto before everything, which is the opposite of
#: what happens.
RUN_ORDER = ["specify", "plan", "tasks", "implement"]


def _sequence(commands: list) -> list:
    """Commands in run order, with anything outside the sequence after it.

    A step the project added says where it goes with `after:` in its `_order.yml`
    and is slotted in there — that is the whole point of adding one, and a review
    step drawn at the far right of the board after `auto` would read as an
    afterthought rather than as the thing that runs between implement and done.
    """
    ranked = [c for c in RUN_ORDER if c in commands]
    loose = sorted(c for c in commands if c not in RUN_ORDER)

    placed = []
    for command in loose:
        behind = assemble.runs_after(command)
        if behind and behind in ranked:
            ranked.insert(ranked.index(behind) + 1, command)
            placed.append(command)
    return ranked + [c for c in loose if c not in placed]


def build_graph(project_root: str) -> dict:
    use_project_nodes(project_root)
    build.use_project_hook_nodes(project_root)
    config = build.load_config(project_root)
    plan, warnings = build.plan_build(config)
    templates = build.plan_templates(config, project_root)
    manifest = manifest_mod.build(orders={c: e["order"] for c, e in plan.items()})

    own_steps = set(project_commands())
    steps = []
    for command in _sequence(decomposed_commands()):
        entry = plan[command]
        hooks = entry["hooks"]
        phases = entry.get("phases") or []

        pinned = assemble.movability(command, entry["order"])
        default = entry["default"]
        # Shipped nodes this step does not run by default and could — the ones a
        # project adds rather than puts back.
        add_ons = [n for n in assemble.optional_nodes(command)
                   if n not in default and os.path.isfile(node_source(command, n)[0])]
        offered = assemble.slot_variants(command)
        drawn_phases = []
        for phase in phases:
            drawn_phases.append({
                "name": phase["name"],
                "nodes": [
                    _node(command, n, hooks, pinned.get(n, ""),
                          _variants(command, n, offered))
                    for n in phase["nodes"]
                ],
                "hooks": [_hook(h) for h in hooks if h["anchor"] == phase["name"]],
            })

        order = entry["order"]
        template = templates.get(command)
        steps.append({
            "name": command,
            # Stock spec-kit's own extension hooks, which a Companion run fires
            # alongside its own. Showing only ours understated the pipeline.
            "stockHooks": build.stock_hooks(project_root, command),
            # The step's own preamble — its frontmatter and the lead-in every
            # node sits under. A step DOES have instructions of its own; they
            # were simply the one piece nothing in the panel could reach.
            "frame": {
                "source": frame_source(command)[0],
                "replaced": frame_source(command)[1],
            },
            # `auto` runs the others rather than taking a turn among them. Drawn
            # as a peer it reads like a fifth step, which it is not. A step the
            # project added takes a turn exactly when it says it does.
            "inSequence": command in RUN_ORDER or bool(assemble.runs_after(command)),
            # Whether this step is the project's own rather than one that ships.
            "own": command in own_steps,
            # The step it runs behind, for a project's own step.
            "after": assemble.runs_after(command),
            "phases": drawn_phases,
            # Hooks on the step itself — outside every phase. The one anchor a
            # regroup cannot orphan, so the panel draws it at the step's edges
            # rather than beside whichever phase happens to be first.
            "hooks": [_hook(h) for h in hooks if h["anchor"] == command],
            "decisions": entry.get("decisions") or [],
            "artifacts": manifest_mod.artifacts_for(manifest, command),
            # `sections` is what this project replaced; `sectionsAvailable` is
            # every `##` the step's template has, so the panel can offer a row
            # per section instead of only showing the ones already changed.
            "template": _template(command, template, project_root, config),
            # Everything this step could run but is not running: nodes the
            # recipe dropped, plus the shipped optional ones — add-ons and the
            # variants of a slot. These are the only nodes that can be added,
            # so the panel offers exactly these rather than a free-text box
            # that build-errors.
            "dropped": (
                [n for n in default if n not in order]
                + [n for n in add_ons if n not in order]
            ),
            # Which of those are shipped add-ons rather than nodes this project
            # took out. Both can be put back and the picker offers both, but one
            # is "put it back" and the other is "this step can also do this" —
            # a list that says neither reads as a pile of ids.
            "addOns": [n for n in add_ons if n not in order],
            "changes": {
                "added": [n for n in order if n not in default],
                "removed": [n for n in default if n not in order],
                "reordered": order != default and not set(order) ^ set(default),
                "hooks": len(hooks),
                "decisions": entry.get("decisionsChanged") or [],
                "replaced": entry.get("replaced") or [],
                "phases": entry.get("phasesChanged") or [],
            },
        })

    customised = any(
        s["changes"]["added"] or s["changes"]["removed"] or s["changes"]["reordered"]
        or s["changes"]["hooks"] or s["changes"]["decisions"] or s["changes"]["replaced"]
        or s["changes"]["phases"]
        # A template is now reported for every step that has one, so its
        # presence says nothing. What the project replaced is the change.
        or (s["template"] and s["template"]["sections"])
        for s in steps
    )
    workflows = build.available_workflows(project_root)
    choices = {
        "skills": build.available_skills(project_root),
        "nodes": build.available_hook_nodes(project_root),
        # What a template section can be pointed at. Each says which section it
        # is written for, so a picker offers only the ones that belong to the
        # row someone is editing rather than every fragment that exists.
        "fragments": template_render.shipped_fragments(),
        # Whole configurations to start a new workflow from, so the first
        # question is "which of these is closest?" rather than a blank file.
        "presets": build.available_presets(),
    }
    active = build.active_workflow(project_root)
    return {
        "steps": steps,
        "workflows": {
            # `shipped` is always offered and is never a file: it is Companion
            # with nothing changed, which is the thing you compare against.
            "available": [build.SHIPPED_WORKFLOW] + workflows,
            "active": active,
        },
        # What a hook can be pointed at in this project, so the form offers
        # names instead of asking you to remember them.
        "choices": choices,
        "configured": bool(config),
        "customised": customised,
        "warnings": warnings,
        "counts": {
            "steps": len(steps),
            "phases": sum(len(s["phases"]) for s in steps),
            "nodes": sum(len(p["nodes"]) for s in steps for p in s["phases"]),
            "hooks": sum(s["changes"]["hooks"] for s in steps),
            "stockHooks": sum(len(s["stockHooks"]) for s in steps),
        },
    }


def _repairs(project: str) -> list:
    """The ways out of a broken configuration — never at the cost of the error.

    Diagnosis reads the same file that just failed, so it can fail too. If it
    does, the panel still gets the error and its manual escape; it simply offers
    no shortcut.
    """
    try:
        import config_repair

        return config_repair.diagnose(os.path.abspath(project))
    except Exception:  # noqa: BLE001 — a diagnosis is a bonus, never a blocker
        return []


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--project", default=os.getcwd())
    args = ap.parse_args()
    try:
        graph = build_graph(os.path.abspath(args.project))
    except build.BuildError as err:
        # The builder has to be able to draw a project whose configuration is
        # broken — that is exactly when someone opens it — so the error travels
        # as data rather than as a non-zero exit with nothing to render.
        # The ways out travel with it: an error the panel can only print leaves
        # someone editing YAML by hand, which is the thing this panel replaces.
        print(json.dumps({"error": str(err), "repairs": _repairs(args.project)}))
        return 0
    print(json.dumps(graph, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
