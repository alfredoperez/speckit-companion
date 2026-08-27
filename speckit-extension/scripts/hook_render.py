#!/usr/bin/env python3
"""Turn a project's configured hooks into the text a command body carries.

`merge_hooks` has always resolved a project's hooks into an ordered list, and
nothing has ever rendered that list. The hook half of the configuration format
was parsed, validated, tested — and then dropped on the floor, so a project could
declare a hook and watch it do nothing.

A hook attaches before or after a node, which is exactly where the node boundary
markers now are, so rendering is an insertion at a marker rather than a guess
about surrounding prose.

Four kinds, and each becomes what the assistant can act on:
  command — a shell line to run at that point
  prompt  — an instruction to follow at that point
  node    — another node's body, spliced in whole
  skill   — an instruction to invoke a skill the project already has

`skill` is the one that does not carry its own text. A project that has written
a skill has already written the instructions; copying them into a node would
fork them. The hook names it and the assistant loads it, the same way a person
would ask for it.

Stdlib only.
"""
from __future__ import annotations

import os
import re

HOOK_OPEN = "<!-- speckit-companion:hook {slot} -->"
HOOK_CLOSE = "<!-- /speckit-companion:hook {slot} -->"


def _slot(entry: dict) -> str:
    """A stable id for one rendered hook: `before-draft-spec-0`."""
    return f"{entry['when']}-{entry['anchor']}-{entry['index']}"


def render_hook(entry: dict, nodes_dir: str | None = None) -> str:
    """The body text for one resolved hook entry, fenced with its own marker."""
    hook = entry["hook"]
    kind = hook.get("type")
    slot = _slot(entry)

    if kind == "command":
        run = str(hook.get("run", "")).strip()
        lines = [
            f"Run this before continuing (project hook, {entry['when']} `{entry['anchor']}`):",
            "",
            "```bash",
            run,
            "```",
        ]
    elif kind == "prompt":
        text = str(hook.get("text", "")).strip()
        lines = [text]
    elif kind == "skill":
        ref = str(hook.get("ref", "")).strip()
        note = str(hook.get("text", "")).strip()
        lines = [
            f"Invoke the `{ref}` skill before continuing." if entry["when"] == "before"
            else f"Invoke the `{ref}` skill now that `{entry['anchor']}` is done.",
        ]
        if note:
            lines.append(note)
    elif kind == "node":
        import companion_config as cc

        ref = str(hook.get("ref", "")).strip()
        body = ""
        path = cc.find_node_file(ref, nodes_dir) if nodes_dir else None
        if path:
            with open(path, encoding="utf-8") as fh:
                body = _strip_frontmatter(fh.read())
        lines = [body.rstrip("\n")] if body else [f"<!-- node hook '{ref}' had no body -->"]
    else:
        return ""

    inner = "\n".join(lines).strip("\n")
    if not inner:
        return ""
    return (
        HOOK_OPEN.format(slot=slot) + "\n"
        + inner + "\n"
        + HOOK_CLOSE.format(slot=slot) + "\n"
    )


_FRONTMATTER = re.compile(r"\A---\n.*?\n---\n", re.S)


def _strip_frontmatter(text: str) -> str:
    return _FRONTMATTER.sub("", text)


def group_by_anchor(entries: list) -> dict:
    """`{(when, anchor): [entry, …]}` preserving each anchor's declared order."""
    grouped: dict = {}
    for entry in entries:
        grouped.setdefault((entry["when"], entry["anchor"]), []).append(entry)
    for key in grouped:
        grouped[key].sort(key=lambda e: e["index"])
    return grouped


def insert_hooks(body: str, entries: list, nodes_dir: str | None = None) -> str:
    """Splice every resolved hook into `body` at its node's boundary.

    `before` lands immediately above the node's opening marker and `after`
    immediately below its closing one, so a hook is always outside the node it
    attaches to — it never edits the node's own text.
    """
    grouped = group_by_anchor(entries)
    for (when, anchor), group in grouped.items():
        rendered = "".join(render_hook(entry, nodes_dir) for entry in group)
        if not rendered:
            continue
        # An anchor names a node or a phase. The design calls a phase the hook
        # boundary — the coarser place to attach, so a project can wrap a whole
        # group of nodes without naming each one. A node anchor still works, and
        # is what the finer cases need.
        for kind in ("node", "phase"):
            open_marker = f"<!-- speckit-companion:{kind} {anchor} -->\n"
            close_marker = f"<!-- /speckit-companion:{kind} {anchor} -->\n"
            marker = open_marker if when == "before" else close_marker
            if marker not in body:
                continue
            body = (body.replace(marker, rendered + marker, 1) if when == "before"
                    else body.replace(marker, marker + rendered, 1))
            break
    return body


HOOK_MARKER_LINE = re.compile(
    r"^[ \t]*<!-- /?speckit-companion:hook [\w-]+ -->[ \t]*\n?",
    re.MULTILINE,
)


def strip_hook_markers(text: str) -> str:
    """Remove hook boundary lines, leaving the hook content itself."""
    return HOOK_MARKER_LINE.sub("", text)
