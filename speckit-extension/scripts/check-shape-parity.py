#!/usr/bin/env python3
"""Parity gate for the Companion command bodies (Contract 2).

Two assertions, run over every tracked command body:

  (a) REGION equality — the text inside each `<!-- speckit-companion:part NAME -->`
      fence equals presets/_parts/NAME.md byte-for-byte. This is the single-source
      guarantee: a forked copy of a shared rule fails here.
      Failure: `part drift: <command>#<name>`.

  (b) GOLDEN equality — each command not intentionally changed equals its frozen
      tests/golden/commands/ capture, compared after normalizing fence-marker
      comment lines (so the timing marker rename and the part-fence convention are
      not miscounted as content changes). This proves the reshape changed no
      instruction text. Failure: `golden drift: <command>`.

Exit 0 on success, 1 on any drift. Stdlib only.
"""
import os
import sys

from _command_parts import (
    EXT,
    GOLDEN_BODIES,
    PART_FENCE,
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


def main() -> int:
    problems = []

    for rel in GOLDEN_BODIES:
        path = os.path.join(EXT, rel)
        if not os.path.isfile(path):
            problems.append(f"missing file: {rel}")
            continue
        body = read(rel)

        # (a) region equality
        for m in PART_FENCE.finditer(body):
            name = m.group(1)
            if not os.path.isfile(part_path(name)):
                problems.append(f"unknown part: {rel}#{name}")
            elif m.group(2) != part_content(name):
                problems.append(f"part drift: {rel}#{name}")

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
    print(f"[shape-parity] OK — {len(GOLDEN_BODIES)} bodies match parts and golden")
    return 0


if __name__ == "__main__":
    sys.exit(main())
