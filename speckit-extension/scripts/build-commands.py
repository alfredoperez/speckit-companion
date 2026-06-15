#!/usr/bin/env python3
"""Assemble shared parts into whole command bodies (Contract 1).

Default mode rewrites every `<!-- speckit-companion:part NAME -->…<!-- /…NAME -->`
region in every command body with the content of presets/_parts/NAME.md, so the
committed files stay whole and self-contained. `--check` assembles in memory and
exits 1 + diff if any region has drifted from its part.

Deterministic and idempotent. A missing part file, an unclosed fence, or a fence
naming an unknown part is a hard error (exit 1), never a silent no-op. Stdlib only.
"""
import difflib
import glob
import os
import sys

from _command_parts import (
    EXT,
    PART_OPEN,
    decomposed_commands,
    fill_parts,
)


def command_files() -> list:
    """Every shipped command body that may carry part fences.

    Excludes the namespaced commands now assembled from node files — those are
    generated (and part-filled) by assemble-nodes.py, which owns their bodies.
    """
    pats = [
        "presets/companion-standard/commands/speckit.*.md",
        "commands/speckit.companion.*.md",
    ]
    owned = {
        os.path.join(EXT, f"commands/speckit.companion.{c}.md")
        for c in decomposed_commands()
    }
    out = []
    for pat in pats:
        out.extend(p for p in sorted(glob.glob(os.path.join(EXT, pat))) if p not in owned)
    return out


def assemble(text: str, rel: str) -> str:
    """Return text with every part region filled from its part file."""
    return fill_parts(text, rel)


def main() -> int:
    check = "--check" in sys.argv[1:]
    drift = []
    built = 0
    for path in command_files():
        rel = os.path.relpath(path, EXT)
        original = open(path, encoding="utf-8").read()
        if not PART_OPEN.search(original):
            continue
        assembled = assemble(original, rel)
        built += 1
        if assembled == original:
            continue
        if check:
            diff = "".join(
                difflib.unified_diff(
                    original.splitlines(keepends=True),
                    assembled.splitlines(keepends=True),
                    fromfile=f"{rel} (committed)",
                    tofile=f"{rel} (parts)",
                )
            )
            drift.append((rel, diff))
        else:
            open(path, "w", encoding="utf-8").write(assembled)

    if check and drift:
        print("[build] DRIFT — committed bodies differ from their parts:")
        for rel, diff in drift:
            print(f"  - {rel}")
            print(diff)
        return 1
    verb = "checked" if check else "assembled"
    print(f"[build] OK — {verb} {built} bodies from parts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
