#!/usr/bin/env python3
"""Guard the Companion profile command bodies. Two checks:

1. PARITY — the opt-in namespaced /speckit.companion.{specify,plan,tasks,implement}
   command bodies must equal the companion-turbo preset bodies (frontmatter aside),
   so the per-spec opt-in path and the turbo preset path produce the same shape.
   (companion-standard has no namespaced twin — it is intentionally absent here.)

2. TIMING PARTIAL — every overridden command body in BOTH presets (and the
   namespaced commands) must embed the canonical timing block from
   presets/_shared/timing-partial.md verbatim, so timing instructions can't fork.

Exit 0 on success, 1 on drift. Stdlib only.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.dirname(HERE)  # speckit-extension/

PIPELINE = ["specify", "plan", "tasks", "implement"]
PARITY_PAIRS = [
    (f"commands/speckit.companion.{c}.md", f"presets/companion-turbo/commands/speckit.{c}.md")
    for c in PIPELINE
]
ALL_CMDS = ["specify", "clarify", "plan", "tasks", "analyze", "implement", "constitution"]
BODIES_NEEDING_PARTIAL = (
    [f"presets/companion-standard/commands/speckit.{c}.md" for c in ALL_CMDS]
    + [f"presets/companion-turbo/commands/speckit.{c}.md" for c in ALL_CMDS]
    + [f"commands/speckit.companion.{c}.md" for c in PIPELINE]
)
PARTIAL_FILE = "presets/_shared/timing-partial.md"


def read(rel: str) -> str:
    return open(os.path.join(EXT, rel), encoding="utf-8").read()


def body(rel: str) -> str:
    """File contents minus the leading --- frontmatter --- block."""
    text = read(rel)
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            text = text[end + 4:]
    return text.strip()


def main() -> int:
    problems = []

    # check 1 — parity
    for ns_rel, preset_rel in PARITY_PAIRS:
        for p in (ns_rel, preset_rel):
            if not os.path.isfile(os.path.join(EXT, p)):
                problems.append(f"missing file: {p}")
        if os.path.isfile(os.path.join(EXT, ns_rel)) and os.path.isfile(os.path.join(EXT, preset_rel)):
            if body(ns_rel) != body(preset_rel):
                problems.append(f"body drift: {ns_rel} != {preset_rel}")

    # check 2 — timing partial present
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
        f"[shape-parity] OK — {len(PARITY_PAIRS)} namespaced bodies match companion-turbo; "
        f"{len(BODIES_NEEDING_PARTIAL)} bodies carry the timing partial"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
