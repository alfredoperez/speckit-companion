#!/usr/bin/env python3
"""Getting a project's pipeline readable again, from inside the panel.

The builder refuses an edit that would break the configuration, so what it
writes is always valid. That is not the same as the configuration always being
valid: a file edited by hand, one written by an older build, or one left broken
by a version that had no guard yet all land the panel on its error state — and
that state's only way out was "open companion.yml", which is the YAML editing
the builder exists to replace. Someone who never wanted to see this format was
handed it at the exact moment they were least equipped to read it.

So the recovery is offered as the panel's own actions. Each repair is a small,
named, reversible retreat toward what ships:

  drop-empty-phases:<step>  a phase with nothing in it — the common accident,
                            since dragging the last node out of a phase leaves
                            one behind. Removing it keeps every other edit.
  reset-phases:<step>       give one step back the shipped grouping
  reset-nodes:<step>        give one step back the shipped order
  reset-all                 every step back to shipped, hooks kept

They are ordered narrowest first, and each says what it will cost, because the
one thing worse than a broken pipeline is a recovery that silently discards work
somebody spent an afternoon on.

The diagnosis reads the file as text rather than through the configuration
reader. It has to: the reader is what is failing, and a repair offered only when
the file already parses would never appear when it is needed.

Stdlib only.
"""
from __future__ import annotations

import os

import config_write as cw

#: Blocks a step can carry that a reset takes back to shipped. Hooks are
#: deliberately absent — they are the project's own work, they are not what
#: breaks a build, and a "recovery" that dropped them would be a data loss
#: wearing a helpful label.
RESETTABLE = ("phases", "nodes")


def _commands_span(lines: list):
    """Where the `commands:` block sits, and the indent its steps are written at."""
    at = cw._find_key(lines, "commands", 0, len(lines), 0)
    if at is None:
        return None
    end = cw._block_end(lines, at, 0, len(lines))
    indent = next(
        (cw._indent_of(lines[i]) for i in range(at + 1, end) if not cw._is_blank(lines[i])),
        len(cw.INDENT),
    )
    return at, end, indent


def _steps(lines: list) -> list:
    """`[(name, start, end, key_indent)]` for every step the file configures."""
    span = _commands_span(lines)
    if span is None:
        return []
    at, end, indent = span
    found = []
    for i in range(at + 1, end):
        if cw._is_blank(lines[i]):
            continue
        match = cw._KEY.match(lines[i])
        if not match or cw._indent_of(lines[i]) != indent:
            continue
        name = match.group(2).strip("\"'")
        stop = cw._block_end(lines, i, indent, end)
        keys = next(
            (cw._indent_of(lines[j]) for j in range(i + 1, stop)
             if not cw._is_blank(lines[j])),
            indent * 2,
        )
        found.append((name, i, stop, keys))
    return found


def phases_in(lines: list, start: int, end: int, key_indent: int) -> list:
    """`[(name, [node…])]` read straight from the text of one step's `phases:`.

    Read from text on purpose — this runs when the configuration reader has
    already refused the file, so its answer is the only one available.
    """
    at = cw._find_key(lines, "phases", start + 1, end, key_indent)
    if at is None:
        return []
    stop = cw._block_end(lines, at, key_indent, end)

    body_lines = [i for i in range(at + 1, stop) if not cw._is_blank(lines[i])]
    if not body_lines:
        return []
    # A phase entry and a node entry are both `- something`; only the indent
    # separates them. The first item under `phases:` fixes the level a phase
    # sits at, and anything deeper belongs to the phase above it.
    item_indent = cw._indent_of(lines[body_lines[0]])

    phases: list = []
    for i in body_lines:
        indent = cw._indent_of(lines[i])
        body = lines[i].lstrip()
        starts_phase = body.startswith("- ") and indent == item_indent

        if starts_phase:
            body = body[2:].lstrip()
            phases.append(["", []])
        if not phases:
            continue

        if body.startswith("name:"):
            phases[-1][0] = body[len("name:"):].strip().strip("\"'")
        elif body.startswith("nodes:"):
            inline = body[len("nodes:"):].strip()
            if inline.startswith("[") and inline.endswith("]"):
                phases[-1][1] = [n.strip().strip("\"'")
                                 for n in inline[1:-1].split(",") if n.strip()]
        elif body.startswith("- "):
            phases[-1][1].append(body[2:].strip().strip("\"'"))
    return [(name, nodes) for name, nodes in phases]


def drop_key(text: str, command: str, key: str) -> str:
    """Return `text` with `commands.<command>.<key>` removed entirely.

    Removing the block is what hands the step back to what ships: the build
    falls through to the shipped order or grouping when the project declares
    none. Rewriting it with the shipped values instead would leave the project
    pinned to today's defaults and silently stale after an upgrade.
    """
    lines = text.splitlines()
    trailing = text.endswith("\n") or not text
    for name, start, end, key_indent in _steps(lines):
        if name != command:
            continue
        at = cw._find_key(lines, key, start + 1, end, key_indent)
        if at is None:
            return text
        # Back over the blanks and comments that trail the block: they belong to
        # whatever comes next, and a repair that eats a note somebody wrote is
        # a repair that costs more than the breakage.
        stop = cw._content_end(lines, at, cw._block_end(lines, at, key_indent, end))
        out = lines[:at] + lines[stop:]
        return "\n".join(out) + ("\n" if trailing else "")
    return text


def _read(project_root: str):
    """The active configuration's path and text, or `(None, "")` when there is none."""
    try:
        path = cw.config_path(project_root)
    except cw.ConfigWriteError:
        return None, ""
    if not os.path.isfile(path):
        return path, ""
    with open(path, encoding="utf-8") as fh:
        return path, fh.read()


def diagnose(project_root: str) -> list:
    """The repairs available for this project, narrowest first.

    Offered from what the file *contains*, never from the wording of the error
    that prompted it. An error message is prose meant for a person; hanging the
    recovery off matching it would put the way out one rephrasing away from
    disappearing.
    """
    path, text = _read(project_root)
    if path is None:
        return []
    lines = text.splitlines()
    steps = _steps(lines)

    repairs: list = []
    for name, start, end, key_indent in steps:
        empty = [p for p, nodes in phases_in(lines, start, end, key_indent) if not nodes]
        if not empty:
            continue
        listed = ", ".join(f"'{p}'" for p in empty if p) or "an unnamed phase"
        repairs.append({
            "id": f"drop-empty-phases:{name}",
            "label": f"Remove the empty phase from {name}",
            "detail": f"Takes out {listed}. Every other change you made is kept.",
        })

    for name, start, end, key_indent in steps:
        for key in RESETTABLE:
            if cw._find_key(lines, key, start + 1, end, key_indent) is None:
                continue
            what = "grouping" if key == "phases" else "order"
            repairs.append({
                "id": f"reset-{key}:{name}",
                "label": f"Use the shipped {'phases' if key == 'phases' else 'node order'} for {name}",
                "detail": f"Drops the {what} you set for {name}. Its hooks stay.",
            })

    if any(cw._find_key(lines, key, start + 1, end, key_indent) is not None
           for _, start, end, key_indent in steps for key in RESETTABLE):
        repairs.append({
            "id": "reset-all",
            "label": "Reset every step to the shipped pipeline",
            "detail": "Drops every node order and phase grouping in this workflow. "
                      "Your hooks are kept.",
            # The broadest retreat, and the only one that discards work across
            # every step. Marked so the panel can draw it as the last resort it
            # is, rather than as one more button the same size as the safe one.
            "destructive": True,
        })
    return repairs


def apply(project_root: str, repair_id: str) -> str:
    """Carry out one repair by id, and say what changed."""
    path, text = _read(project_root)
    if path is None:
        raise cw.ConfigWriteError(
            "this project is on \"As it ships\", so there is no configuration to repair")
    if not text:
        raise cw.ConfigWriteError("there is no configuration file to repair")

    action, _, target = repair_id.partition(":")

    if action == "reset-all":
        updated = text
        for name, *_ in _steps(updated.splitlines()):
            for key in RESETTABLE:
                updated = drop_key(updated, name, key)
        said = "every step is back to the shipped pipeline"
    elif action in ("reset-phases", "reset-nodes"):
        key = "phases" if action == "reset-phases" else "nodes"
        updated = drop_key(text, target, key)
        said = f"{target} is back to the shipped {key}"
    elif action == "drop-empty-phases":
        lines = text.splitlines()
        step = next((s for s in _steps(lines) if s[0] == target), None)
        if step is None:
            raise cw.ConfigWriteError(f"{target} is not configured here")
        _, start, end, key_indent = step
        kept = [{"name": p, "nodes": nodes}
                for p, nodes in phases_in(lines, start, end, key_indent) if nodes]
        # Every phase was empty, so there is no grouping left to write — the
        # step goes back to the shipped one rather than to a list of nothing.
        updated = (cw.set_phases(text, target, kept) if kept
                   else drop_key(text, target, "phases"))
        said = f"the empty phase is gone from {target}"
    else:
        raise cw.ConfigWriteError(f"unknown repair: {repair_id}")

    if updated == text:
        raise cw.ConfigWriteError(f"nothing to repair for {repair_id}")

    with open(path, "w", encoding="utf-8") as fh:
        fh.write(updated)
    return said


def main() -> int:
    import argparse
    import json

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--project", default=os.getcwd())
    ap.add_argument("--list", action="store_true", help="the repairs available, as JSON")
    ap.add_argument("--apply", help="carry out one repair by id")
    args = ap.parse_args()

    project = os.path.abspath(args.project)
    if args.list:
        print(json.dumps(diagnose(project)))
        return 0
    if args.apply:
        try:
            said = apply(project, args.apply)
        except cw.ConfigWriteError as err:
            print(f"[config] {err}")
            return 1
        print(f"[config] {said}")
        return 0
    ap.error("give --list or --apply")
    return 2


if __name__ == "__main__":
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    sys.exit(main())
