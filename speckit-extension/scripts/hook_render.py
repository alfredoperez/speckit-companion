#!/usr/bin/env python3
"""Turn a project's configured hooks into the text a command body carries.

`merge_hooks` has always resolved a project's hooks into an ordered list, and
nothing has ever rendered that list. The hook half of the configuration format
was parsed, validated, tested — and then dropped on the floor, so a project could
declare a hook and watch it do nothing.

A hook attaches before or after a node, which is exactly where the node boundary
markers now are, so rendering is an insertion at a marker rather than a guess
about surrounding prose.

Three kinds, and each becomes what the assistant can act on:
  command — a shell line to run at that point
  prompt  — an instruction to follow at that point
  node    — another node's body, spliced in whole

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
    elif kind == "node":
        ref = str(hook.get("ref", "")).strip()
        body = ""
        if nodes_dir:
            path = os.path.join(nodes_dir, f"{ref}.md")
            if os.path.isfile(path):
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
        if when == "before":
            marker = f"<!-- speckit-companion:node {anchor} -->\n"
            body = body.replace(marker, rendered + marker, 1)
        else:
            marker = f"<!-- /speckit-companion:node {anchor} -->\n"
            body = body.replace(marker, marker + rendered, 1)
    return body


HOOK_MARKER_LINE = re.compile(
    r"^[ \t]*<!-- /?speckit-companion:hook [\w-]+ -->[ \t]*\n?",
    re.MULTILINE,
)


def strip_hook_markers(text: str) -> str:
    """Remove hook boundary lines, leaving the hook content itself."""
    return HOOK_MARKER_LINE.sub("", text)
