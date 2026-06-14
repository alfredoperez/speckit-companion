#!/usr/bin/env python3
"""Tests for the companion.yml loader, merge contract, and failure table (#317).

Stdlib `unittest` only. These prove the prose in _parts/orchestrator.md matches
the code: hooks merge in declared order, a recipe's nodes: override resolves, an
anchor outside the active recipe is warned + skipped, a missing type:node ref is a
hard error, absent config is silent defaults, and malformed config degrades + warns.
"""
from __future__ import annotations

import importlib
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
sys.path.insert(0, str(SCRIPTS))
cc = importlib.import_module("companion_config")


class YamlSubsetTests(unittest.TestCase):
    def test_parses_nested_hooks_and_flow_maps(self) -> None:
        cfg = cc.load_yaml((FIXTURES / "companion.yml").read_text())
        impl = cfg["commands"]["implement"]["hooks"]
        self.assertEqual(impl["before"]["handoff"][0], {"type": "command", "run": "npm test"})
        self.assertEqual(impl["before"]["handoff"][1]["type"], "prompt")
        self.assertEqual(impl["after"]["implement-exec"][0], {"type": "node", "ref": "review"})

    def test_recipe_node_list_is_a_flow_seq(self) -> None:
        cfg = cc.load_yaml((FIXTURES / "companion.yml").read_text())
        self.assertEqual(
            cfg["commands"]["plan"]["nodes"],
            ["gather-context", "plan-doc", "side-files", "handoff"],
        )


class MergeContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.cfg = cc.load_yaml((FIXTURES / "companion.yml").read_text())

    def test_hooks_preserve_declared_order(self) -> None:
        active = ["implement-exec", "handoff"]
        ordered, warnings = cc.merge_hooks(self.cfg, "implement", active)
        runs = [(h["when"], h["anchor"], h["index"], h["hook"]["type"]) for h in ordered]
        self.assertEqual(
            runs,
            [
                ("before", "handoff", 0, "command"),
                ("before", "handoff", 1, "prompt"),
                ("after", "implement-exec", 0, "node"),
            ],
        )
        self.assertEqual(warnings, [])

    def test_anchor_not_in_active_recipe_is_warned_and_skipped(self) -> None:
        ordered, warnings = cc.merge_hooks(self.cfg, "implement", ["implement-exec"])
        self.assertNotIn("handoff", [h["anchor"] for h in ordered])
        self.assertTrue(any("handoff" in w and "skipped" in w for w in warnings))

    def test_missing_node_ref_is_hard_error(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(cc.ConfigError):
                cc.merge_hooks(self.cfg, "implement", ["implement-exec", "handoff"], nodes_dir=d)

    def test_present_node_ref_passes(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "review.md").write_text("---\nid: review\n---\nbody\n")
            ordered, _ = cc.merge_hooks(self.cfg, "implement", ["implement-exec", "handoff"], nodes_dir=d)
            self.assertIn("review", [h["hook"].get("ref") for h in ordered])


class RecipeResolveTests(unittest.TestCase):
    def setUp(self) -> None:
        self.cfg = cc.load_yaml((FIXTURES / "companion.yml").read_text())
        self.default = ["gather-context", "plan-doc", "constitution-check", "side-files", "handoff"]

    def test_recipe_override_replaces_default_order(self) -> None:
        self.assertEqual(
            cc.resolve_order(self.cfg, "plan", self.default),
            ["gather-context", "plan-doc", "side-files", "handoff"],
        )

    def test_command_without_recipe_keeps_default(self) -> None:
        self.assertEqual(cc.resolve_order(self.cfg, "tasks", ["tasks-doc", "handoff"]),
                         ["tasks-doc", "handoff"])

    def test_reads_of_dropped_node_errors(self) -> None:
        active = {"plan-doc": ["gather-context"], "side-files": ["plan-doc"]}  # gather-context dropped
        with self.assertRaises(cc.ConfigError):
            cc.validate_reads(active)

    def test_reads_all_present_passes(self) -> None:
        active = {"gather-context": [], "plan-doc": ["gather-context"], "side-files": ["plan-doc"], "handoff": []}
        cc.validate_reads(active)  # no raise


class FailureTableTests(unittest.TestCase):
    def test_absent_config_is_silent_defaults(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            cfg, warnings = cc.load_config(str(Path(d) / "companion.yml"))
            self.assertEqual(cfg, {})
            self.assertEqual(warnings, [])

    def test_malformed_config_degrades_with_warning(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "companion.yml"
            p.write_text("commands:\n  implement:\n  bad line without colon\n")
            cfg, warnings = cc.load_config(str(p))
            self.assertEqual(cfg, {})
            self.assertTrue(warnings and "malformed" in warnings[0])


if __name__ == "__main__":
    unittest.main()
