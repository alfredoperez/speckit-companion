#!/usr/bin/env python3
"""Parity gate for the Companion command bodies (Contract 2).

Three assertions, run over every tracked command body:

  (a) REGION equality — the text inside each `<!-- speckit-companion:part NAME -->`
      fence equals presets/_parts/NAME.md byte-for-byte. This is the single-source
      guarantee: a forked copy of a shared rule fails here.
      Failure: `part drift: <command>#<name>`.

  (b) GOLDEN equality — each command not intentionally changed equals its frozen
      tests/golden/commands/ capture, compared after normalizing fence-marker
      comment lines (so the timing marker rename and the part-fence convention are
      not miscounted as content changes). This proves the reshape changed no
      instruction text. Failure: `golden drift: <command>`.

  (c) TIMING PRESENCE — every companion-standard carrier still carries the shared
      `timing` part via a fence (not a pasted copy). This keeps the timing block
      single-sourced: a carrier that drops the fence and inlines its own copy fails
      here even though (a) only checks fences that exist. Failure: `missing timing
      fence: <command>`.

Exit 0 on success, 1 on any drift. Stdlib only.
"""
import os
import sys

from _command_parts import (
    EXT,
    GOLDEN_BODIES,
    PART_CLOSE,
    PART_FENCE,
    PART_OPEN,
    canonical,
    golden_path,
    part_content,
    part_path,
    read,
)

# Commands whose CONTENT is intentionally changed by this feature (so golden
# equality no longer applies — they still pass region equality). US2 rewrites the
# specify classification prose to single-source the sizing bar; US3 adds the
# self-advance part to the pipeline bodies. Behavior is preserved; only the text
# changes, so these are exempt from the byte-for-byte golden compare.
INTENTIONALLY_CHANGED = {
    "commands/speckit.companion.specify.md",
    "commands/speckit.companion.plan.md",
    "commands/speckit.companion.tasks.md",
    "commands/speckit.companion.implement.md",
}

# Carriers that must keep the shared timing block as a fence (single-sourced),
# never a pasted copy. Asserted by check (c).
STANDARD_CARRIER_PREFIX = "presets/companion-standard/commands/"


def missing_timing_fence(rel: str, body: str) -> bool:
    """True for a stock carrier that dropped its shared `timing` fence (and would
    thus carry an un-single-sourced copy). The single source of check (c), so a
    test can exercise the real guard instead of re-implementing the condition."""
    return rel.startswith(STANDARD_CARRIER_PREFIX) and "timing" not in PART_OPEN.findall(body)


def main() -> int:
    problems = []

    for rel in GOLDEN_BODIES:
        path = os.path.join(EXT, rel)
        if not os.path.isfile(path):
            problems.append(f"missing file: {rel}")
            continue
        body = read(rel)

        # (a0) well-formed fences — every open marker must have a matching close
        # of the same name. A malformed/unbalanced fence is skipped by PART_FENCE
        # (which only matches a complete pair), so without this guard a mismatched
        # or unclosed marker would slip past region equality and the golden
        # compare (which strips marker lines) could falsely pass.
        opens, closes = PART_OPEN.findall(body), PART_CLOSE.findall(body)
        if opens != closes:
            problems.append(f"malformed fence: {rel} (opens={opens} closes={closes})")

        # (a) region equality
        for m in PART_FENCE.finditer(body):
            name = m.group(1)
            if not os.path.isfile(part_path(name)):
                problems.append(f"unknown part: {rel}#{name}")
            elif m.group(2) != part_content(name):
                problems.append(f"part drift: {rel}#{name}")

        # (c) timing-fence presence on the stock carriers
        if missing_timing_fence(rel, body):
            problems.append(f"missing timing fence: {rel}")

        # (b) golden equality (content-frozen commands only)
        if rel in INTENTIONALLY_CHANGED:
            continue
        gpath = golden_path(rel)
        if not os.path.isfile(gpath):
            problems.append(f"missing golden: {rel}")
        elif canonical(body) != canonical(open(gpath, encoding="utf-8").read()):
            problems.append(f"golden drift: {rel}")

    if problems:
        print("[shape-parity] DRIFT")
        for p in problems:
            print("  -", p)
        return 1
    print(f"[shape-parity] OK — {len(GOLDEN_BODIES)} bodies match parts, golden, and carry the timing fence")
    return 0


if __name__ == "__main__":
    sys.exit(main())
