#!/usr/bin/env python3
"""The pipeline's decision points, as data a project can change and a UI can draw.

There is exactly one real branch in this pipeline: `classify-size` decides
whether a change keeps the full specify → plan → tasks → implement path or folds
toward implement. That routing was written down in three places — the shared
routing part, the workflow file's switch, and the classifier's own instructions —
and expressible in none of them. A project could not change where a verdict
routes, and nothing could show the branch without re-reading the prose.

It is a declaration now: which node decides, what verdicts it can reach, and
what each verdict does. Two effects, matching the routing that already existed:

  folds — the steps this verdict skips
  warns — the notice this verdict prints before running everything

A project overrides a verdict in `companion.yml`; the build states the routing
it resolved, and renders a note into the body when the project changed it.

Stdlib only.
"""
from __future__ import annotations

import os
import re

_ITEM = re.compile(r"^\s*-\s+(.*)$")


def parse_decisions(path: str) -> list:
    """Read an `_order.yml` `decisions:` block.

    Returns `[{node, verdicts: [{name, folds: [...], warns: str}]}]`, or `[]` for
    a step that makes no decision — most of them.
    """
    decisions: list = []
    current: dict | None = None
    verdict: dict | None = None
    in_decisions = False
    in_verdicts = False

    with open(path, encoding="utf-8") as fh:
        raw_lines = fh.readlines()

    for raw in raw_lines:
        line = raw.split("#", 1)[0] if raw.lstrip().startswith("#") else raw
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("decisions:"):
            in_decisions = True
            continue
        if not in_decisions:
            continue
        # A dedent to a new top-level key ends the block.
        if not raw.startswith(" ") and not stripped.startswith("-"):
            break

        if stripped.startswith("- node:"):
            if verdict and current:
                current["verdicts"].append(verdict)
                verdict = None
            if current:
                decisions.append(current)
            current = {"node": stripped[len("- node:"):].strip(), "verdicts": []}
            in_verdicts = False
            continue
        if current is None:
            continue
        if stripped.startswith("verdicts:"):
            in_verdicts = True
            continue
        if in_verdicts and stripped.startswith("- name:"):
            if verdict:
                current["verdicts"].append(verdict)
            verdict = {"name": stripped[len("- name:"):].strip(), "folds": [], "warns": ""}
            continue
        if verdict is not None and stripped.startswith("folds:"):
            rest = stripped[len("folds:"):].strip()
            if rest.startswith("[") and rest.endswith("]"):
                inner = rest[1:-1].strip()
                verdict["folds"] = [x.strip() for x in inner.split(",")] if inner else []
            continue
        if verdict is not None and stripped.startswith("warns:"):
            verdict["warns"] = stripped[len("warns:"):].strip()
            continue

    if verdict and current:
        current["verdicts"].append(verdict)
    if current:
        decisions.append(current)
    return decisions


def apply_overrides(decisions: list, config: dict, command: str) -> tuple:
    """Fold a project's `decisions:` block over the declared ones.

    Returns `(resolved, changed)` where `changed` names the verdicts the project
    altered — the build reports those, since a routing change is the kind of
    customisation someone reading a run needs to know happened.
    """
    overrides = ((config.get("commands") or {}).get(command) or {}).get("decisions") or {}
    resolved = []
    changed = []
    for decision in decisions:
        node_override = overrides.get(decision["node"]) or {}
        verdicts = []
        for verdict in decision["verdicts"]:
            settings = node_override.get(verdict["name"])
            merged = dict(verdict)
            if isinstance(settings, dict):
                if "folds" in settings:
                    folds = settings["folds"]
                    merged["folds"] = list(folds) if isinstance(folds, list) else []
                if "warns" in settings:
                    merged["warns"] = str(settings["warns"])
                if merged != verdict:
                    changed.append(f"{decision['node']}.{verdict['name']}")
            verdicts.append(merged)
        resolved.append({"node": decision["node"], "verdicts": verdicts})
    return resolved, changed


def validate(decisions: list, known_steps: set) -> list:
    """Problems that should stop a build: a verdict folding a step that does not exist."""
    problems = []
    for decision in decisions:
        for verdict in decision["verdicts"]:
            unknown = [s for s in verdict["folds"] if s not in known_steps]
            if unknown:
                problems.append(
                    f"{decision['node']}.{verdict['name']} folds unknown step(s): "
                    f"{', '.join(unknown)}"
                )
    return problems


def render(decisions: list) -> str:
    """A human line per verdict, for the build's report."""
    lines = []
    for decision in decisions:
        for verdict in decision["verdicts"]:
            if verdict["folds"]:
                effect = f"skips {', '.join(verdict['folds'])}"
            elif verdict["warns"]:
                effect = "warns, then runs everything"
            else:
                effect = "runs everything"
            lines.append(f"  {decision['node']} = {verdict['name']} → {effect}")
    return "\n".join(lines)


def render_override_note(decisions: list, changed: list) -> str:
    """The note spliced into a body when a project changed where a verdict routes.

    Written into the command because the assistant is the thing that acts on the
    verdict, and a routing rule it cannot see is one it cannot follow.
    """
    if not changed:
        return ""
    lines = ["This project has changed how this step's verdict routes:"]
    for decision in decisions:
        for verdict in decision["verdicts"]:
            if f"{decision['node']}.{verdict['name']}" not in changed:
                continue
            if verdict["folds"]:
                lines.append(f"- `{verdict['name']}` → skip {', '.join(verdict['folds'])}.")
            elif verdict["warns"]:
                lines.append(f"- `{verdict['name']}` → warn ({verdict['warns']}), then run every step.")
            else:
                lines.append(f"- `{verdict['name']}` → run every step.")
    return "\n".join(lines)


def decisions_for(command: str, nodes_dir: str) -> list:
    path = os.path.join(nodes_dir, command, "_order.yml")
    return parse_decisions(path) if os.path.isfile(path) else []
