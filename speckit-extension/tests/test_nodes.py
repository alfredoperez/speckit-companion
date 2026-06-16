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
parity = importlib.import_module("check-shape-parity")


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

        # Probe on a string unique to the constitution-check node body
        # ("Constitution Check" itself now also appears in the plan frame's
        # outline and the side-files re-check note, so it isn't node-specific).
        self.assertNotEqual(default_out, recipe_out)
        self.assertIn("Complexity Tracking", default_out)
        self.assertNotIn("Complexity Tracking", recipe_out)

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

    def test_specify_reads_chain_validates_full_and_catches_a_dropped_link(self) -> None:
        # specify has the deepest reads chain; the full order validates, and
        # dropping a mid-chain node a kept node still reads is a load-time error.
        default = asm.default_order("specify")
        cc.validate_reads(asm.node_reads_map("specify", default))  # no raise
        recipe = [n for n in default if n != "draft-spec"]  # read by quality-checklist + classify-size
        with self.assertRaises(cc.ConfigError):
            cc.validate_reads(asm.node_reads_map("specify", recipe))


class TimingFencePresenceTests(unittest.TestCase):
    """The stock carriers must keep the shared timing block as a fence, not a copy."""

    def _carriers(self) -> list:
        return [r for r in cp.GOLDEN_BODIES if r.startswith(parity.STANDARD_CARRIER_PREFIX)]

    def test_every_stock_carrier_currently_carries_the_timing_fence(self) -> None:
        carriers = self._carriers()
        self.assertTrue(carriers, "expected at least one companion-standard carrier")
        for rel in carriers:
            with self.subTest(rel=rel):
                self.assertIn("timing", cp.PART_OPEN.findall(cp.read(rel)))

    def test_guard_flags_a_carrier_that_dropped_the_timing_fence(self) -> None:
        # Exercise the REAL guard (parity.missing_timing_fence), not a re-implementation.
        rel = self._carriers()[0]
        body = cp.read(rel)
        self.assertFalse(parity.missing_timing_fence(rel, body), "an intact carrier must pass the guard")
        forked = cp.PART_FENCE.sub(lambda m: m.group(2), body)  # inline the part, drop the fence
        self.assertTrue(parity.missing_timing_fence(rel, forked), "guard must flag a dropped timing fence")
        # Carrier-scoped: a non-carrier body without a timing fence is NOT flagged.
        self.assertFalse(parity.missing_timing_fence("commands/speckit.companion.classify.md", "no fence"))


if __name__ == "__main__":
    unittest.main()
