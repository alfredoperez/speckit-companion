#!/usr/bin/env python3
"""Every new spec states its non-goals, change-level rules and verification plan."""
from __future__ import annotations

import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SPECIFY = (EXT / "commands" / "speckit.companion.specify.md").read_text(encoding="utf-8")
BUGFIX = (EXT / "nodes" / "specify" / "draft-spec-bugfix.md").read_text(encoding="utf-8")


def node(body: str, node_id: str) -> str:
    start = body.index(f"<!-- speckit-companion:node {node_id} -->")
    return body[start:body.index(f"<!-- /speckit-companion:node {node_id} -->", start)]


class SpecSectionsTests(unittest.TestCase):
    def test_the_draft_asks_for_the_three_sections_and_allows_none(self) -> None:
        draft = node(SPECIFY, "draft-spec")
        for section in ("**Non-goals**", "**Change-level rules**", "**Verification plan**"):
            with self.subTest(section=section):
                self.assertIn(section, draft)
        self.assertIn('"None"', draft)

    def test_a_bug_spec_states_its_non_goals_and_verification_plan(self) -> None:
        self.assertIn("**Non-goals**", BUGFIX)
        self.assertIn("**Verification plan**", BUGFIX)

    def test_the_wrap_up_records_the_non_goals_section_and_nothing_for_none(self) -> None:
        finalize = node(SPECIFY, "finalize")
        self.assertIn("each item of the spec's **Non-goals** section", finalize)
        self.assertIn('Omit `expectations` when that section says "None"', finalize)
        self.assertNotIn("the four sections only", finalize)


if __name__ == "__main__":
    unittest.main()
