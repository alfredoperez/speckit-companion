#!/usr/bin/env python3
"""Implement checks the requirements against the code by default, above simple size."""
from __future__ import annotations

import unittest
from pathlib import Path

from builder_harness import Project

EXT = Path(__file__).resolve().parent.parent
IMPLEMENT = (EXT / "commands" / "speckit.companion.implement.md").read_text(encoding="utf-8")


def node(node_id: str) -> str:
    start = IMPLEMENT.index(f"<!-- speckit-companion:node {node_id} -->")
    return IMPLEMENT[start:IMPLEMENT.index(f"<!-- /speckit-companion:node {node_id} -->", start)]


class RequirementsCheckByDefault(unittest.TestCase):
    def test_it_runs_after_the_build_and_before_the_verified_record(self) -> None:
        at = IMPLEMENT.index
        self.assertLess(at("speckit-companion:node implement-exec"), at("speckit-companion:node check-requirements"))
        self.assertLess(at("speckit-companion:node check-requirements"), at("speckit-companion:node record-verified"))

    def test_it_skips_a_simple_run_and_treats_a_missing_size_as_normal(self) -> None:
        gate = node("check-requirements")
        self.assertIn("a missing value means `normal`", gate)
        self.assertIn("At `simple` size, skip this check", gate)

    def test_it_never_stops_for_a_person_and_works_without_subagents(self) -> None:
        check = node("check-requirements")
        self.assertNotIn("wait for", check.lower())
        self.assertIn("On a host without subagents", check)

    def test_the_panel_no_longer_offers_it_as_an_add_on(self) -> None:
        project = Project()
        self.addCleanup(project.close)
        implement = next(s for s in project.graph()["steps"] if s["name"] == "implement")
        self.assertEqual(implement["addOns"], ["verify-manually"])


if __name__ == "__main__":
    unittest.main()
