#!/usr/bin/env python3
"""Node-assembly parity tests for the decomposed Companion commands.

Stdlib `unittest` only. Asserts the byte-parity contract of #317: every command
re-assembled from its nodes/<command>/ files equals the frozen golden capture
byte-for-byte. A drift here means a node body, the frame, or the order changed
the command's output — exactly what v1 (a pure refactor) must never do.
"""
from __future__ import annotations

import importlib
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))
asm = importlib.import_module("assemble-nodes")
cp = importlib.import_module("_command_parts")
cc = importlib.import_module("companion_config")


class NodeAssemblyParityTests(unittest.TestCase):
    def test_every_decomposed_command_matches_golden(self) -> None:
        commands = cp.decomposed_commands()
        self.assertTrue(commands, "expected at least one nodes/<command>/ dir")
        for command in commands:
            with self.subTest(command=command):
                assembled = asm.assemble_command(command)
                gpath = cp.golden_path(f"commands/speckit.companion.{command}.md")
                golden = Path(gpath).read_text(encoding="utf-8")
                self.assertEqual(assembled, golden, f"{command} assembly drifted from golden")

    def test_order_lists_only_existing_nodes(self) -> None:
        for command in cp.decomposed_commands():
            order = cp.parse_order(str(Path(cp.nodes_command_dir(command)) / "_order.yml"))
            self.assertTrue(order, f"{command}/_order.yml has no nodes")
            for node_id in order:
                with self.subTest(command=command, node=node_id):
                    meta, body = cp.read_node(command, node_id)
                    self.assertEqual(meta.get("id"), node_id, f"{command}/{node_id} id mismatch")
                    self.assertEqual(meta.get("command"), command)
                    self.assertIn(meta.get("kind"), {"investigate", "author", "gate", "control"})


class RecipeOverrideTests(unittest.TestCase):
    """A recipe's node-list override changes assembly without touching the default."""

    def test_recipe_drops_a_node_from_assembly(self) -> None:
        default = asm.default_order("plan")
        self.assertIn("constitution-check", default)
        recipe = [n for n in default if n != "constitution-check"]

        default_out = asm.assemble_command("plan", order=default)
        recipe_out = asm.assemble_command("plan", order=recipe)

        self.assertNotEqual(default_out, recipe_out)
        self.assertIn("Constitution Check", default_out)
        self.assertNotIn("Constitution Check", recipe_out)

    def test_default_assembly_still_matches_golden(self) -> None:
        golden = Path(cp.golden_path("commands/speckit.companion.plan.md")).read_text(encoding="utf-8")
        self.assertEqual(asm.assemble_command("plan", order=asm.default_order("plan")), golden)
        self.assertEqual(asm.assemble_command("plan"), golden)

    def test_valid_recipe_passes_reads_validation(self) -> None:
        recipe = [n for n in asm.default_order("plan") if n != "constitution-check"]
        cc.validate_reads(asm.node_reads_map("plan", recipe))  # no raise

    def test_recipe_dropping_a_read_dependency_errors(self) -> None:
        recipe = [n for n in asm.default_order("plan") if n != "gather-context"]
        with self.assertRaises(cc.ConfigError):
            cc.validate_reads(asm.node_reads_map("plan", recipe))


if __name__ == "__main__":
    unittest.main()
