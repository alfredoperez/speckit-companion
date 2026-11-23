#!/usr/bin/env python3
"""Specify asks its open questions before plan, and an unattended run assumes and records them."""
from __future__ import annotations

import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SPECIFY = (EXT / "commands" / "speckit.companion.specify.md").read_text(encoding="utf-8")
BLOCKING = (EXT / "nodes" / "specify" / "quality-checklist-blocking.md").read_text(encoding="utf-8")


def node(body: str, node_id: str) -> str:
    start = body.index(f"<!-- speckit-companion:node {node_id} -->")
    return body[start:body.index(f"<!-- /speckit-companion:node {node_id} -->", start)]


class OpenQuestionsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.check = node(SPECIFY, "quality-checklist")

    def test_remaining_markers_are_asked_as_one_numbered_table(self) -> None:
        self.assertIn("| # | What is unresolved | Options |", self.check)
        self.assertIn("**Your choice**", self.check)
        self.assertNotIn("no option tables", self.check)

    def test_a_spec_with_no_markers_asks_nothing(self) -> None:
        self.assertIn("No marker left: ask nothing", self.check)

    def test_each_answer_is_a_decision_keyed_by_its_question(self) -> None:
        self.assertIn('"id": "spec-question-<n>", "by": "you"', self.check)

    def test_an_unattended_run_assumes_and_records_a_concern_per_question(self) -> None:
        for body in (self.check, BLOCKING):
            with self.subTest(node="default" if body is self.check else "blocking"):
                self.assertIn("**Unattended**", body)
                self.assertIn("under Assumptions", body)
                self.assertIn('--concern \'{"note": "Question <n>: assumed <answer> for: <question>", "step": "specify"}\'', body)

    def test_the_blocking_gate_no_longer_says_the_default_defers_to_clarify(self) -> None:
        self.assertNotIn("deferring to `clarify`", BLOCKING)


if __name__ == "__main__":
    unittest.main()
