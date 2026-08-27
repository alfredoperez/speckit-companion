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
    node_source,
    read_node,
    use_project_nodes,
)

build = importlib.import_module("build-pipeline")
manifest_mod = importlib.import_module("manifest")


def _node(command: str, node_id: str, hooks: list) -> dict:
    meta, _body = read_node(command, node_id)
    writes = meta.get("writes")
    source, replaced = node_source(command, node_id)
    return {
        "id": node_id,
        # Where these instructions actually came from, so the builder opens the
        # file someone can edit instead of the assembled body they cannot.
        "source": source,
        "replaced": replaced,
        # The id is a handle; the name is what a person reads. A node without one
        # falls back to its id rather than showing nothing.
        "name": meta.get("name") or node_id,
        "kind": meta.get("kind") or "control",
        "reads": list(meta.get("reads") or []),
        "writes": ([writes] if isinstance(writes, str) else list(writes or [])),
        "hooks": [_hook(h) for h in hooks if h["anchor"] == node_id],
    }


def _hook(entry: dict) -> dict:
    hook = entry["hook"]
    return {
        "when": entry["when"],
        "type": hook.get("type"),
        # One line describing what this hook does, since that is what a chip shows.
        "summary": (hook.get("run") or hook.get("text") or hook.get("ref") or "").strip(),
    }


def build_graph(project_root: str) -> dict:
    use_project_nodes(project_root)
    build.use_project_hook_nodes(project_root)
    config = build.load_config(project_root)
    plan, warnings = build.plan_build(config)
    templates = build.plan_templates(config, project_root)
    manifest = manifest_mod.build(orders={c: e["order"] for c, e in plan.items()})

    steps = []
    for command in decomposed_commands():
        entry = plan[command]
        hooks = entry["hooks"]
        phases = entry.get("phases") or []

        drawn_phases = []
        for phase in phases:
            drawn_phases.append({
                "name": phase["name"],
                "nodes": [_node(command, n, hooks) for n in phase["nodes"]],
                "hooks": [_hook(h) for h in hooks if h["anchor"] == phase["name"]],
            })

        default = entry["default"]
        order = entry["order"]
        template = templates.get(command)
        steps.append({
            "name": command,
            "phases": drawn_phases,
            "decisions": entry.get("decisions") or [],
            "artifacts": manifest_mod.artifacts_for(manifest, command),
            "template": ({"file": template[0], "sections": template[2]} if template else None),
            "changes": {
                "added": [n for n in order if n not in default],
                "removed": [n for n in default if n not in order],
                "reordered": order != default and not set(order) ^ set(default),
                "hooks": len(hooks),
                "decisions": entry.get("decisionsChanged") or [],
                "replaced": entry.get("replaced") or [],
            },
        })

    customised = any(
        s["changes"]["added"] or s["changes"]["removed"] or s["changes"]["reordered"]
        or s["changes"]["hooks"] or s["changes"]["decisions"] or s["changes"]["replaced"]
        or s["template"]
        for s in steps
    )
    return {
        "steps": steps,
        "configured": bool(config),
        "customised": customised,
        "warnings": warnings,
        "counts": {
            "steps": len(steps),
            "phases": sum(len(s["phases"]) for s in steps),
            "nodes": sum(len(p["nodes"]) for s in steps for p in s["phases"]),
            "hooks": sum(s["changes"]["hooks"] for s in steps),
        },
    }


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
        print(json.dumps({"error": str(err)}))
        return 0
    print(json.dumps(graph, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
