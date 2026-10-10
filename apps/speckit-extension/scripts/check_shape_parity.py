#!/usr/bin/env python3
"""Parity gate for the Companion command bodies (Contract 2).

REGION equality — over every part-fence carrier (`PART_CARRIERS`, the seven
namespaced bodies), the text inside each `<!-- speckit-companion:part NAME -->`
fence equals presets/_parts/NAME.md byte-for-byte. This is the single-source
guarantee: a forked copy of a shared rule fails here.
Failure: `part drift: <command>#<name>`.

Exit 0 on success, 1 on any drift. Stdlib only.
"""
import os
import sys

from _command_parts import (
    EXT,
    PART_CARRIERS,
    PART_CLOSE,
    PART_FENCE,
    PART_OPEN,
    part_content,
    part_path,
    read,
)


def check() -> list:
    """Every disagreement the region check finds. Empty means clean."""
    problems = []

    for rel in PART_CARRIERS:
        path = os.path.join(EXT, rel)
        if not os.path.isfile(path):
            problems.append(f"missing file: {rel}")
            continue
        body = read(rel)

        # PART_FENCE only matches a complete pair, so an unbalanced marker would slip past region equality.
        opens, closes = PART_OPEN.findall(body), PART_CLOSE.findall(body)
        if opens != closes:
            problems.append(f"malformed fence: {rel} (opens={opens} closes={closes})")

        for m in PART_FENCE.finditer(body):
            name = m.group(1)
            if not os.path.isfile(part_path(name)):
                problems.append(f"unknown part: {rel}#{name}")
            elif m.group(2) != part_content(name):
                problems.append(f"part drift: {rel}#{name}")

    return problems


def main() -> int:
    problems = check()
    if problems:
        print("[shape-parity] DRIFT")
        for p in problems:
            print("  -", p)
        return 1
    print(f"[shape-parity] OK — {len(PART_CARRIERS)} bodies match parts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
