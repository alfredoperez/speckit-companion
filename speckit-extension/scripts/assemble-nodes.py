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
    DEBUG_TIMING,
    EXT,
    append_part,
    debug_on,
    decomposed_commands,
    fill_parts,
    golden_path,
    nodes_command_dir,
    parse_order,
    part_path,
    read_node,
)

ORCHESTRATOR = "orchestrator"


def assemble_command(command: str, order: list = None, debug: bool = False) -> str:
    """Return the full command body assembled from nodes/<command>/.

    With `debug`, the debug-timing part is appended after the orchestrator part.
    Without it the part is absent from the output entirely — not present and
    inactive — so an off render stays byte-identical to the frozen golden.
    """
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
        out = append_part(out, ORCHESTRATOR)
    if debug and os.path.isfile(part_path(DEBUG_TIMING)):
        out = append_part(out, DEBUG_TIMING)
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

    # `--check` always compares the OFF render against golden: debug is a local,
    # temporary switch and must never make the parity gate fail.
    debug = debug_on() and not check
    if debug:
        print("[assemble] debug: true in .specify/companion.yml — bodies carry timing instrumentation")

    drift = []
    for command in commands:
        assembled = assemble_command(command, debug=debug)
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
