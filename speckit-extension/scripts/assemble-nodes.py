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
import importlib
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


def _report_budget(commands) -> None:
    """Print each assembled command's directive count, own vs shared.

    Printed here because assembly is the moment the number changes, and so the
    only moment anyone is placed to act on it. Measured-but-unreported is how a
    command reached seventy-five directives unremarked — and how it went unnoticed
    that most of that load is the shared parts, which every additional dispatch
    would re-pay.

    Never fails the build. This reports; `instruction-budget.py --strict` gates.
    """
    try:
        budget = importlib.import_module("instruction-budget")
    except Exception:  # noqa: BLE001 — reporting must never break assembly
        return
    rows = []
    for command in commands:
        path = command_path(command)
        if os.path.isfile(path):
            rows.append(budget.measure(path))
    if not rows:
        return
    rows.sort(key=lambda r: -r["total"])
    parts = []
    for r in rows:
        name = r["command"]
        if name.startswith("speckit.companion."):
            name = name[len("speckit.companion."):]
        if name.endswith(".md"):
            name = name[: -len(".md")]
        parts.append(f"{name} {r['total']} ({r['own']} own)")
    print("[assemble] directives — " + ", ".join(parts))


def main() -> int:
    check = "--check" in sys.argv[1:]
    commands = decomposed_commands()
    if not commands:
        print("[assemble] no nodes/<command>/ dirs — nothing to assemble")
        return 0

    # Opt-in per invocation, never from ambient config: these bodies are committed,
    # gated artifacts, and `--check` always compares the OFF render.
    debug = "--debug" in sys.argv[1:] and not check
    if debug:
        print("[assemble] --debug — bodies carry timing instrumentation (do not commit)")

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
    _report_budget(commands)
    return 0


if __name__ == "__main__":
    sys.exit(main())
