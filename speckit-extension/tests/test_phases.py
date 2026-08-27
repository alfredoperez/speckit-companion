#!/usr/bin/env python3
"""Phases — the middle block (step ⊃ phase ⊃ node).

The design has had three levels since it was written and the data model had two:
a step went straight to a flat list of nodes. So a hook could only attach to a
single node, and there was nothing between a step and its nodes for a builder to
show or a project to reorganise.

A phase is a hook boundary, not a dispatch boundary — a step is still one
dispatched command, which is what keeps the instruction budget from multiplying.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import os
import sys
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import _command_parts as cp  # noqa: E402
import hook_render  # noqa: E402

assemble = importlib.import_module("assemble-nodes")
build = importlib.import_module("build-pipeline")


class EveryCommandIsGroupedIntoPhases(unittest.TestCase):
    def test_each_command_declares_phases(self):
        for command in assemble.decomposed_commands():
            with self.subTest(command=command):
                phases = cp.parse_phases(
                    os.path.join(cp.nodes_command_dir(command), "_order.yml"))
                self.assertTrue(phases, f"{command} has no phases")

    def test_the_phases_hold_exactly_the_ordered_nodes(self):
        # The flat order stays the authority on sequence. A phase list that
        # drifted from it would put a node in a group it does not run in.
        for command in assemble.decomposed_commands():
            with self.subTest(command=command):
                phases = cp.parse_phases(
                    os.path.join(cp.nodes_command_dir(command), "_order.yml"))
                flattened = [node for phase in phases for node in phase["nodes"]]
                self.assertEqual(flattened, assemble.default_order(command))

    def test_phase_names_are_unique_within_a_command(self):
        for command in assemble.decomposed_commands():
            with self.subTest(command=command):
                names = [p["name"] for p in cp.parse_phases(
                    os.path.join(cp.nodes_command_dir(command), "_order.yml"))]
                self.assertEqual(len(names), len(set(names)))


class PhasesAppearInTheAssembledCommand(unittest.TestCase):
    def test_each_phase_opens_and_closes_around_its_nodes(self):
        body = assemble.assemble_command("specify")
        for phase in assemble.phases_for("specify", assemble.default_order("specify")):
            fenced = {m.group(1): m.group(2) for m in cp.PHASE_FENCE.finditer(body)}
            self.assertIn(phase["name"], fenced)
            for node in phase["nodes"]:
                self.assertIn(f"speckit-companion:node {node}", fenced[phase["name"]])

    def test_the_markers_are_additive(self):
        # Same guarantee the node boundaries carry: the golden bodies predate
        # phases, so stripping the markers has to reproduce them exactly.
        for command in assemble.decomposed_commands():
            with self.subTest(command=command):
                marked = assemble.assemble_command(command)
                golden = Path(cp.golden_path(f"commands/speckit.companion.{command}.md"))
                self.assertEqual(cp.strip_node_markers(marked),
                                 golden.read_text(encoding="utf-8"))

    def test_phases_are_balanced(self):
        for command in assemble.decomposed_commands():
            with self.subTest(command=command):
                body = assemble.assemble_command(command)
                self.assertEqual(cp.PHASE_OPEN.findall(body), cp.PHASE_CLOSE.findall(body))


class APhaseFollowsTheRecipe(unittest.TestCase):
    def test_a_dropped_node_leaves_its_phase(self):
        order = [n for n in assemble.default_order("specify") if n != "quality-checklist"]
        phases = assemble.phases_for("specify", order)
        author = next(p for p in phases if p["name"] == "author")
        self.assertEqual(author["nodes"], ["draft-spec"])

    def test_a_phase_emptied_by_a_recipe_is_dropped_rather_than_rendered_empty(self):
        order = [n for n in assemble.default_order("specify")
                 if n not in ("draft-spec", "quality-checklist")]
        names = [p["name"] for p in assemble.phases_for("specify", order)]
        self.assertNotIn("author", names)

    def test_a_node_no_phase_claims_still_runs(self):
        # Order is the authority. A recipe naming a node outside every phase must
        # not silently drop it.
        order = assemble.default_order("specify") + ["review-gaps"]
        phases = assemble.phases_for("specify", order)
        flattened = [n for p in phases for n in p["nodes"]]
        self.assertIn("review-gaps", flattened)


class AHookCanAttachToAPhase(unittest.TestCase):
    def test_an_after_hook_lands_outside_the_whole_group(self):
        body = assemble.assemble_command("specify")
        entries = [{"when": "after", "anchor": "author", "index": 0,
                    "hook": {"type": "prompt", "text": "re-read the draft"}}]
        out = hook_render.insert_hooks(body, entries)
        self.assertGreater(out.index("re-read the draft"),
                           out.index("/speckit-companion:phase author"))

    def test_a_before_hook_lands_above_the_whole_group(self):
        body = assemble.assemble_command("specify")
        entries = [{"when": "before", "anchor": "author", "index": 0,
                    "hook": {"type": "prompt", "text": "check the canvas"}}]
        out = hook_render.insert_hooks(body, entries)
        self.assertLess(out.index("check the canvas"),
                        out.index("speckit-companion:phase author"))

    def test_the_build_accepts_a_phase_as_an_anchor(self):
        config = {"commands": {"specify": {"hooks": {"after": {
            "author": [{"type": "prompt", "text": "phase hook"}]}}}}}
        plan, warnings = build.plan_build(config)
        self.assertEqual(warnings, [], "a phase anchor was treated as unknown")
        self.assertTrue(plan["specify"]["hooks"])
        self.assertIn("phase hook", build.render("specify", plan["specify"]))

    def test_an_anchor_that_is_neither_node_nor_phase_is_warned_about(self):
        config = {"commands": {"specify": {"hooks": {"after": {
            "not-a-thing": [{"type": "prompt", "text": "x"}]}}}}}
        _plan, warnings = build.plan_build(config)
        self.assertTrue(any("not-a-thing" in w for w in warnings))


if __name__ == "__main__":
    unittest.main()
