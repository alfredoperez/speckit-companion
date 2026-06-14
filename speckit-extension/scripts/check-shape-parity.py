#!/usr/bin/env python3
"""Guard the Companion command bodies.

TIMING PARTIAL — every overridden command body in the companion-standard preset
(and the namespaced /speckit.companion.* commands) must embed the canonical timing
block from presets/_shared/timing-partial.md verbatim, so timing instructions
can't fork.

Exit 0 on success, 1 on drift. Stdlib only.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.dirname(HERE)  # speckit-extension/

PIPELINE = ["specify", "plan", "tasks", "implement"]
ALL_CMDS = ["specify", "clarify", "plan", "tasks", "analyze", "implement", "constitution"]
BODIES_NEEDING_PARTIAL = (
    [f"presets/companion-standard/commands/speckit.{c}.md" for c in ALL_CMDS]
    + [f"commands/speckit.companion.{c}.md" for c in PIPELINE]
)
PARTIAL_FILE = "presets/_shared/timing-partial.md"


def read(rel: str) -> str:
    return open(os.path.join(EXT, rel), encoding="utf-8").read()


def main() -> int:
    problems = []

    try:
        partial = read(PARTIAL_FILE).strip()
    except OSError:
        print(f"[shape-parity] DRIFT — missing {PARTIAL_FILE}")
        return 1
    for rel in BODIES_NEEDING_PARTIAL:
        if not os.path.isfile(os.path.join(EXT, rel)):
            problems.append(f"missing file: {rel}")
        elif partial not in read(rel):
            problems.append(f"timing partial missing/forked: {rel}")

    if problems:
        print("[shape-parity] DRIFT")
        for p in problems:
            print("  -", p)
        return 1
    print(
        f"[shape-parity] OK — {len(BODIES_NEEDING_PARTIAL)} bodies carry the timing partial"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
