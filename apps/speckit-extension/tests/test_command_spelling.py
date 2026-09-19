#!/usr/bin/env python3
"""The shipped corpus never names a command in a spelling a host cannot resolve.

A slash in front of a dotted command name is a name that resolves to nothing on an
assistant that registered the dashed spelling, and the pipeline's own bodies were the
worst offender: they told the assistant what to type. Three review passes swept that by
hand and each one missed a residue, because a hand sweep checks the files it thinks of.
This pins the property over the whole corpus instead.

Stdlib `unittest` only (runs under pytest too), so the CI discover sweep picks it up.
"""
from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# A literal command name behind a slash. `/speckit.*` is a glob, not a name, and reads as one.
SLASHED_NAME = re.compile(r"`/speckit\.(?!\*)[a-z][a-z.-]*")

# What ships to an assistant. Docs are excluded on purpose: a human reading them on GitHub
# needs to know these are slash commands, and no model dispatches from them.
SHIPPED = ["commands", "nodes", "presets", "tests/golden/commands"]

# The one place both spellings are the subject rather than an example.
TEACHES_THE_RULE = "presets/_parts/command-spelling.md"


def offenders() -> list[str]:
    hits = []
    for area in SHIPPED:
        for path in sorted((ROOT / area).rglob("*.md")):
            rel = path.relative_to(ROOT).as_posix()
            for n, line in enumerate(path.read_text().splitlines(), 1):
                for m in SLASHED_NAME.finditer(line):
                    hits.append(f"{rel}:{n}: {m.group(0)}")
    return hits


class TestCommandSpelling(unittest.TestCase):
    def test_no_shipped_body_names_a_command_behind_a_slash(self):
        found = offenders()
        self.assertEqual(
            found,
            [],
            "a shipped command body names a command in a spelling Claude Code cannot resolve:\n"
            + "\n".join(found),
        )

    def test_the_rule_itself_still_carries_both_spellings(self):
        # Removing its examples would remove the lesson, so the sweep must never reach it.
        text = (ROOT / TEACHES_THE_RULE).read_text()
        self.assertIn("speckit.companion.plan", text)
        self.assertIn("speckit-companion-plan", text)

    def test_the_scan_would_catch_a_regression(self):
        # A pattern hardcoded to match nothing would pass the first case; this fails it.
        self.assertTrue(SLASHED_NAME.search("dispatch `/speckit.companion.plan` now"))
        self.assertIsNone(SLASHED_NAME.search("the `speckit.*` family"))
        self.assertIsNone(SLASHED_NAME.search("dispatch `speckit.companion.plan` now"))


if __name__ == "__main__":
    unittest.main()
