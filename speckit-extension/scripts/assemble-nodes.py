#!/usr/bin/env python3
"""Assemble a namespaced Companion command body from its node files.

A command under nodes/<command>/ is composed of:
  1. `_frame.md`  — the non-reorderable preamble (command frontmatter + User Input
                    block + the `## Outline` lead-in). Verbatim, no node frontmatter.
  2. the nodes named in `_order.yml` (or a recipe override), each a markdown file
     with YAML frontmatter (id/kind/command/writes/reads) + a body; bodies are
     concatenated in order.
Then the assembled text passes the existing part-fence step (shared with
build-commands.py) so inner ``<!-- speckit-companion:part NAME -->`` fences fill,
and — when present — the orchestrator part is appended.

This is a behavior-preserving refactor: the output must equal the frozen golden
(tests/golden/commands/) byte-for-byte. Default mode writes each command body;
`--check` re-assembles in memory and exits 1 + a diff on any drift from golden.
Stdlib only.
"""
import difflib
import os
import sys

from _command_parts import (
    EXT,
    decomposed_commands,
    fill_parts,
    golden_path,
    nodes_command_dir,
    parse_order,
    part_path,
    read_node,
)

ORCHESTRATOR = "orchestrator"


def assemble_command(command: str, order: list = None) -> str:
    """Return the full command body assembled from nodes/<command>/."""
    cdir = nodes_command_dir(command)
    frame_path = os.path.join(cdir, "_frame.md")
    out = ""
    if os.path.isfile(frame_path):
        with open(frame_path, encoding="utf-8") as fh:
            out = fh.read()

    ids = order if order is not None else parse_order(os.path.join(cdir, "_order.yml"))
    for node_id in ids:
        _, body = read_node(command, node_id)
        out += body

    rel = f"commands/speckit.companion.{command}.md"
    out = fill_parts(out, rel)

    if os.path.isfile(part_path(ORCHESTRATOR)):
        from _command_parts import part_content
        block = part_content(ORCHESTRATOR)
        out = (
            f"{out}\n<!-- speckit-companion:part {ORCHESTRATOR} -->\n"
            f"{block}\n<!-- /speckit-companion:part {ORCHESTRATOR} -->\n"
        )
    return out


def default_order(command: str) -> list:
    return parse_order(os.path.join(nodes_command_dir(command), "_order.yml"))


def node_reads_map(command: str, order: list) -> dict:
    """{node_id: reads_list} for every node in an order — input to validate_reads."""
    return {nid: (read_node(command, nid)[0].get("reads") or []) for nid in order}


def command_path(command: str) -> str:
    return os.path.join(EXT, "commands", f"speckit.companion.{command}.md")


def main() -> int:
    check = "--check" in sys.argv[1:]
    commands = decomposed_commands()
    if not commands:
        print("[assemble] no nodes/<command>/ dirs — nothing to assemble")
        return 0

    drift = []
    for command in commands:
        assembled = assemble_command(command)
        gpath = golden_path(f"commands/speckit.companion.{command}.md")
        if check:
            if not os.path.isfile(gpath):
                drift.append((command, f"missing golden for {command}"))
                continue
            golden = open(gpath, encoding="utf-8").read()
            if assembled != golden:
                diff = "".join(
                    difflib.unified_diff(
                        golden.splitlines(keepends=True),
                        assembled.splitlines(keepends=True),
                        fromfile=f"{command} (golden)",
                        tofile=f"{command} (assembled)",
                    )
                )
                drift.append((command, diff))
        else:
            open(command_path(command), "w", encoding="utf-8").write(assembled)

    if check and drift:
        print("[assemble] DRIFT — assembled bodies differ from golden:")
        for command, diff in drift:
            print(f"  - {command}")
            print(diff)
        return 1
    verb = "checked" if check else "assembled"
    print(f"[assemble] OK — {verb} {len(commands)} command bodies from nodes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
