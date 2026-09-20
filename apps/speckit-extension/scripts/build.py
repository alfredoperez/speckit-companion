#!/usr/bin/env python3
"""Build (or check) every Companion command body — the one entrypoint over
`_command_parts.py`.

Default mode does two passes, in order:
  1. fill every `<!-- speckit-companion:part NAME -->` region in a body that
     carries part fences but is not node-assembled (the companion-standard
     presets, plus any namespaced body with no `nodes/<command>/` dir — e.g.
     classify, mark-complete) from `presets/_parts/NAME.md`. Replaces the
     former `build-commands.py`.
  2. assemble every `nodes/<command>/` into its command body, and write the
     artifact manifest. Replaces `assemble_nodes.py`'s former default mode.

`--bless` re-freezes the 7 preset goldens after a deliberate preset or part edit.
It is the only sanctioned writer of `tests/golden/commands/`.

What deleting the namespaced goldens gave up, said plainly: a change to the
assembler itself that rewrites all 7 node-assembled bodies now passes `--check`
once the author reruns the build and commits, because each body is compared to
its own committed copy. The net moved from a gate to the diff, where 7 changed
command bodies are visible in review. The preset goldens still catch the same
class of regression in the shared part-filling code, which is why they stayed.

`--check` asserts, without writing anything:
  - part-region equality for all 14 carriers (`_command_parts.PART_CARRIERS`)
  - timing-fence presence on the 7 stock carriers
  - golden equality for the 7 preset carriers (`GOLDEN_CARRIERS`) — the one
    hand-kept fork with no generator to re-derive it from
  - node-assembly equality: every decomposed command re-assembled from its
    nodes equals its OWN committed body (marker lines aside) — the 7
    namespaced bodies have no golden; the committed body is their ground truth

Exit 0 clean, 1 on any drift. Stdlib only.
"""
from __future__ import annotations

import glob
import os
import sys
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import _command_parts as cp  # noqa: E402
import assemble_nodes as asm  # noqa: E402
import check_shape_parity as parity  # noqa: E402

EXT = cp.EXT


def part_fill_targets() -> list:
    """Command bodies carrying part fences that are NOT node-assembled.

    The companion-standard presets, plus any namespaced body with no
    `nodes/<command>/` directory of its own (classify, mark-complete).
    """
    owned = {
        os.path.join(EXT, f"commands/speckit.companion.{c}.md")
        for c in cp.decomposed_commands()
    }
    pats = [
        "presets/companion-standard/commands/speckit.*.md",
        "commands/speckit.companion.*.md",
    ]
    out = []
    for pat in pats:
        out.extend(p for p in sorted(glob.glob(os.path.join(EXT, pat))) if p not in owned)
    return out


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


def bless() -> int:
    """Re-freeze the 7 preset goldens after a deliberate preset or part edit.

    The namespaced bodies need no such step: each is its own baseline. The preset
    carriers have no generator to re-derive them from, so their frozen snapshot is
    the only independent copy, and an intentional edit has to move it on purpose.
    Run this in its own commit so the re-freeze is visible as a separate act.
    """
    _fill_parts_write(debug=False)
    for rel in cp.GOLDEN_CARRIERS:
        dest = Path(cp.golden_path(rel))
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(cp.strip_node_markers(cp.read(rel)), encoding="utf-8")
    print(f"[build] re-froze {len(cp.GOLDEN_CARRIERS)} preset goldens — commit this on its own")
    return 0


def main() -> int:
    if "--bless" in sys.argv[1:]:
        return bless()
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
              f"{len(cp.GOLDEN_CARRIERS)} match golden, "
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
