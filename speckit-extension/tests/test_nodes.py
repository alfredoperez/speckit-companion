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


if __name__ == "__main__":
    unittest.main()
