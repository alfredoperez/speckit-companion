#!/usr/bin/env python3
"""Freeze the current Companion command bodies as the proof-of-no-change golden.

Run ONCE before extracting any part (Contract 3). Snapshots every tracked
command body into tests/golden/commands/ as flat files. Re-running after an
*intentional* command change is the sanctioned, explicit way to re-bless the
golden — never call this from inside the build. Stdlib only.
"""
import os
import sys

from _command_parts import EXT, GOLDEN_BODIES, GOLDEN_DIR, golden_path, read


def main() -> int:
    os.makedirs(os.path.join(EXT, GOLDEN_DIR), exist_ok=True)
    captured = 0
    for rel in GOLDEN_BODIES:
        if not os.path.isfile(os.path.join(EXT, rel)):
            print(f"[capture-golden] missing body: {rel}")
            return 1
        with open(golden_path(rel), "w", encoding="utf-8") as fh:
            fh.write(read(rel))
        captured += 1
    print(f"[capture-golden] froze {captured} command bodies into {GOLDEN_DIR}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
