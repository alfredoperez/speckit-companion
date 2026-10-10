#!/usr/bin/env python3
"""Build (or check) every Companion command body — the one entrypoint over
`_command_parts.py`.

Default mode does two passes, in order:
  1. fill every `<!-- speckit-companion:part NAME -->` region in a body that
     carries part fences but is not node-assembled (any namespaced body with
     no `nodes/<command>/` dir — e.g. classify, mark-complete) from
     `presets/_parts/NAME.md`. Replaces the former `build-commands.py`.
  2. assemble every `nodes/<command>/` into its command body, and write the
     artifact manifest. Replaces `assemble_nodes.py`'s former default mode.

No frozen snapshot backs these bodies, said plainly: a change to the assembler
or the part-filling code that rewrites the command bodies passes `--check` once
the author reruns the build and commits, because each body is compared to its
own committed copy. The net is the diff, where the changed command bodies are
visible in review.

`--check` asserts, without writing anything:
  - part-region equality for every carrier (`_command_parts.PART_CARRIERS`)
  - node-assembly equality: every decomposed command re-assembled from its
    nodes equals its OWN committed body (marker lines aside) — the committed
    body is its ground truth

Exit 0 clean, 1 on any drift. Stdlib only.
"""
from __future__ import annotations

import glob
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import _command_parts as cp  # noqa: E402
import assemble_nodes as asm  # noqa: E402
import check_shape_parity as parity  # noqa: E402

EXT = cp.EXT


def part_fill_targets() -> list:
    """Command bodies carrying part fences that are NOT node-assembled.

    Any namespaced body with no `nodes/<command>/` directory of its own
    (classify, mark-complete).
    """
    owned = {
        os.path.join(EXT, f"commands/speckit.companion.{c}.md")
        for c in cp.decomposed_commands()
    }
    pat = os.path.join(EXT, "commands/speckit.companion.*.md")
    return [p for p in sorted(glob.glob(pat)) if p not in owned]


def _fill_parts_write(debug: bool) -> int:
    """Fill every part-fence carrier that isn't node-assembled. Returns the count built."""
    built = 0
    for path in part_fill_targets():
        rel = os.path.relpath(path, EXT)
        original = open(path, encoding="utf-8").read()
        if not cp.PART_OPEN.search(original):
            continue
        assembled = cp.fill_parts(original, rel)
        if os.path.isfile(cp.part_path(cp.DEBUG_TIMING)):
            assembled = cp.apply_debug(assembled, cp.DEBUG_TIMING, debug)
        built += 1
        if assembled != original:
            open(path, "w", encoding="utf-8").write(assembled)
    return built


def node_assembly_problems() -> list:
    """Node-assembly equality: every decomposed command matches its own committed body."""
    problems = []
    for command in cp.decomposed_commands():
        rel = f"commands/speckit.companion.{command}.md"
        path = os.path.join(EXT, rel)
        if not os.path.isfile(path):
            problems.append(f"missing committed body for {command}")
            continue
        assembled = cp.strip_node_markers(asm.assemble_command(command))
        committed = cp.strip_node_markers(cp.read(rel))
        if assembled != committed:
            problems.append(f"node-assembly drift: {command}")
    return problems


def check() -> list:
    """Every disagreement `--check` exists to catch. Empty means clean."""
    return parity.check() + node_assembly_problems()


def main() -> int:
    do_check = "--check" in sys.argv[1:]
    # Opt-in per invocation, never ambient: these bodies are committed artifacts.
    debug = "--debug" in sys.argv[1:] and not do_check
    if debug:
        print("[build] --debug — bodies carry timing instrumentation (do not commit)")

    commands = cp.decomposed_commands()

    if do_check:
        problems = check()
        if problems:
            print("[build] DRIFT")
            for p in problems:
                print("  -", p)
            return 1
        print(f"[build] OK — {len(cp.PART_CARRIERS)} part carriers, "
              f"{len(commands)} node-assembled commands match their committed body")
        asm._report_budget(commands)
        asm._report_manifest(write=False)
        return 0

    filled = _fill_parts_write(debug)
    for command in commands:
        assembled = asm.assemble_command(command, debug=debug)
        open(asm.command_path(command), "w", encoding="utf-8").write(assembled)
    print(f"[build] wrote {filled} part-filled bodies and {len(commands)} node-assembled bodies")
    asm._report_budget(commands)
    asm._report_manifest(write=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
