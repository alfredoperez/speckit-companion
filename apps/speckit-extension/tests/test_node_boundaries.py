#!/usr/bin/env python3
"""Node boundaries in the assembled commands (R001), and the proof they changed
nothing (R002).

Until now the assembled command was one undifferentiated body: nothing could
point at a node, so a hook or a replacement had no place to attach except by
matching the prose around it. Each node's contribution is fenced with its id now.

The guarantee that matters is that this is additive. The golden bodies are kept
marker-free, and assembly is compared to them with the markers stripped, so a
marker that shifted a line, ate a blank one, or reordered anything fails the
build. These tests hold the property directly as well.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import re
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import _command_parts as cp  # noqa: E402

assemble = importlib.import_module("assemble-nodes")


class MarkersAreAdditive(unittest.TestCase):
    """R002 — the same work, in the same order."""

    def test_stripping_the_markers_reproduces_the_body_exactly(self):
        for command in assemble.decomposed_commands():
            with self.subTest(command=command):
                marked = assemble.assemble_command(command)
                plain = assemble.assemble_command(command, markers=False)
                self.assertEqual(cp.strip_node_markers(marked), plain)

    def test_stripping_the_markers_reproduces_the_frozen_golden(self):
        # The goldens predate the markers. This is the contract: whatever the
        # boundaries do, the instructions the assistant receives are unchanged.
        for command in assemble.decomposed_commands():
            with self.subTest(command=command):
                marked = assemble.assemble_command(command)
                golden = Path(cp.golden_path(f"commands/speckit.companion.{command}.md"))
                self.assertEqual(cp.strip_node_markers(marked), golden.read_text(encoding="utf-8"))

    def test_the_markers_add_only_whole_lines(self):
        for command in assemble.decomposed_commands():
            with self.subTest(command=command):
                marked = assemble.assemble_command(command)
                for line in marked.splitlines():
                    if "speckit-companion:node" in line:
                        self.assertRegex(
                            line,
                            r"^<!-- /?speckit-companion:node [\w-]+ -->$",
                            "a node marker shares its line with content",
                        )


class TheSanctionedRebless(unittest.TestCase):
    """`capture-golden.py` is the documented way to re-bless after an intentional
    command change. It has to produce goldens the parity tests accept.

    It froze the shipped bodies raw, and those carry the boundary markers now, so
    running it blessed the markers into the baseline and broke every parity test
    that compares through `strip_node_markers` — the one tool for the job left the
    build red.
    """

    def _freeze_into(self, tmp: Path) -> dict:
        """Run the real script with its output redirected, and read back what it wrote."""
        capture = importlib.import_module("capture-golden")
        written = {}

        def fake_path(rel: str) -> str:
            path = tmp / Path(cp.golden_path(rel)).name
            written[rel] = path
            return str(path)

        original = capture.golden_path
        capture.golden_path = fake_path
        try:
            self.assertEqual(capture.main(), 0)
        finally:
            capture.golden_path = original
        return {rel: path.read_text(encoding="utf-8") for rel, path in written.items()}

    def test_it_writes_what_the_parity_check_expects(self):
        with tempfile.TemporaryDirectory() as tmp:
            frozen = self._freeze_into(Path(tmp))
        for command in assemble.decomposed_commands():
            with self.subTest(command=command):
                rel = f"commands/speckit.companion.{command}.md"
                self.assertEqual(
                    frozen[rel], cp.strip_node_markers(assemble.assemble_command(command)),
                    "capture-golden froze a body the parity check rejects")

    def test_the_frozen_body_carries_no_boundary_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            frozen = self._freeze_into(Path(tmp))
        for rel, body in frozen.items():
            with self.subTest(body=rel):
                self.assertNotIn("speckit-companion:node", body)
                self.assertNotIn("speckit-companion:phase", body)


class EveryNodeIsAddressable(unittest.TestCase):
    """R001 — a hook or a replacement can name an exact point."""

    def test_each_ordered_node_opens_and_closes_exactly_once(self):
        for command in assemble.decomposed_commands():
            with self.subTest(command=command):
                body = assemble.assemble_command(command)
                for node_id in assemble.default_order(command):
                    self.assertEqual(
                        len(re.findall(rf"<!-- speckit-companion:node {node_id} -->", body)), 1)
                    self.assertEqual(
                        len(re.findall(rf"<!-- /speckit-companion:node {node_id} -->", body)), 1)

    def test_the_fence_yields_the_nodes_own_body(self):
        command = assemble.decomposed_commands()[0]
        order = assemble.default_order(command)
        body = assemble.assemble_command(command)
        found = {m.group(1): m.group(2) for m in cp.NODE_FENCE.finditer(body)}
        self.assertEqual(list(found), order, "fenced ids do not match the order")
        for node_id, fenced in found.items():
            # The fenced text is the node's body after its part fences are
            # filled, so it is compared against the node's own opening line
            # rather than the unfilled source.
            _, own = cp.read_node(command, node_id)
            opening = next(line for line in own.splitlines() if line.strip())
            self.assertIn(opening, fenced, f"{node_id}'s fence does not hold its own content")

    def test_boundaries_are_balanced(self):
        for command in assemble.decomposed_commands():
            with self.subTest(command=command):
                body = assemble.assemble_command(command)
                self.assertEqual(cp.NODE_OPEN.findall(body), cp.NODE_CLOSE.findall(body))


class TheNamespaceIsSeparateFromParts(unittest.TestCase):
    def test_a_node_marker_is_never_read_as_a_part_fence(self):
        # `fill_parts` exits on an unknown part name, so a node marker sharing
        # the `part` namespace would abort assembly rather than be ignored.
        body = assemble.assemble_command(assemble.decomposed_commands()[0])
        for name in cp.PART_OPEN.findall(body):
            self.assertFalse(name.startswith("node"), f"part fence named like a node: {name}")

    def test_the_golden_comparison_strips_node_markers_too(self):
        marked = "<!-- speckit-companion:node x -->\nbody\n<!-- /speckit-companion:node x -->\n"
        self.assertEqual(cp.canonical(marked), "body\n")


class EveryStepStampsItsStartFirst(unittest.TestCase):
    """A step's recorded window has to contain the work it claims.

    The stamp used to sit inside a content node, so the extension hooks — and in
    plan, the first node too — ran outside the window the step later reported. On
    the measured run in #622 half the elapsed clock belonged to no step at all.
    """

    STEPS = ("specify", "plan", "tasks", "implement")

    def _frame(self, command):
        return (EXT / "nodes" / command / "_frame.md").read_text(encoding="utf-8")

    def test_every_step_frame_carries_the_step_start_part(self):
        for command in self.STEPS:
            with self.subTest(command=command):
                self.assertIn("speckit-companion:part step-start", self._frame(command),
                              "this step never stamps its own start")

    def test_the_stamp_sits_above_the_hooks_fence(self):
        # A `before_plan` git commit is not the plan step's work, and on a dirty
        # repo it is not fast either. The window opens before anything runs for it.
        for command in self.STEPS:
            with self.subTest(command=command):
                body = self._frame(command)
                self.assertLess(body.index("speckit-companion:part step-start"),
                                body.index("speckit-companion:part speckit-hooks"),
                                "the hooks run inside the step's window, not before it")

    def test_the_part_text_is_identical_across_every_command(self):
        bodies = {c: assemble.assemble_command(c) for c in self.STEPS}
        regions = {}
        for command, body in bodies.items():
            m = re.search(r"<!-- speckit-companion:part step-start -->\n(.*?)"
                          r"<!-- /speckit-companion:part step-start -->", body, re.S)
            self.assertIsNotNone(m, f"{command} has no filled step-start region")
            regions[command] = m.group(1)
        self.assertEqual(len(set(regions.values())), 1,
                         "four copies that can drift is what the parity gate exists to catch")


if __name__ == "__main__":
    unittest.main()
