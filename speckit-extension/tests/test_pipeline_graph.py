#!/usr/bin/env python3
"""The structure the builder draws.

The panel must show what a build would produce, not the shipped defaults with a
project's changes imagined on top — so the graph is resolved through the same
configuration the build command works from, and emitted from here rather than
derived a second time in TypeScript.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

graph_mod = importlib.import_module("pipeline-graph")
assemble = importlib.import_module("assemble-nodes")


def project_with(config_text: str) -> tempfile.TemporaryDirectory:
    tmp = tempfile.TemporaryDirectory()
    specify = Path(tmp.name) / ".specify"
    specify.mkdir(parents=True)
    (specify / "companion.yml").write_text(config_text, encoding="utf-8")
    return tmp


class TheGraphDescribesTheWholePipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.empty = tempfile.TemporaryDirectory()
        cls.graph = graph_mod.build_graph(cls.empty.name)

    @classmethod
    def tearDownClass(cls):
        cls.empty.cleanup()

    def test_it_carries_every_step_phase_and_node(self):
        counts = self.graph["counts"]
        self.assertEqual(counts["steps"], len(assemble.decomposed_commands()))
        self.assertEqual(
            counts["nodes"],
            sum(len(assemble.default_order(c)) for c in assemble.decomposed_commands()))
        self.assertGreater(counts["phases"], counts["steps"], "phases did not survive into the graph")

    def test_every_node_carries_a_human_name_and_its_id(self):
        for step in self.graph["steps"]:
            for phase in step["phases"]:
                for node in phase["nodes"]:
                    self.assertTrue(node["id"])
                    self.assertTrue(node["name"])
                    self.assertNotEqual(node["name"], node["id"],
                                        f"{node['id']} still shows its id as its name")

    def test_the_decision_and_its_verdicts_are_there_to_draw(self):
        specify = next(s for s in self.graph["steps"] if s["name"] == "specify")
        self.assertEqual([d["node"] for d in specify["decisions"]], ["classify-size"])
        verdicts = {v["name"] for v in specify["decisions"][0]["verdicts"]}
        self.assertEqual(verdicts, {"simple", "normal", "oversized"})

    def test_artifacts_come_from_the_manifest(self):
        specify = next(s for s in self.graph["steps"] if s["name"] == "specify")
        self.assertIn("spec.md", specify["artifacts"])

    def test_an_unconfigured_project_reports_no_customisation(self):
        self.assertFalse(self.graph["configured"])
        self.assertFalse(self.graph["customised"])
        for step in self.graph["steps"]:
            self.assertEqual(step["changes"]["added"], [])
            self.assertEqual(step["changes"]["removed"], [])
            self.assertEqual(step["changes"]["hooks"], 0)


class TheGraphFollowsTheProjectsConfiguration(unittest.TestCase):
    def test_a_dropped_node_is_absent_and_reported_as_removed(self):
        order = [n for n in assemble.default_order("specify") if n != "quality-checklist"]
        tmp = project_with("commands:\n  specify:\n    nodes: [" + ", ".join(order) + "]\n")
        self.addCleanup(tmp.cleanup)
        graph = graph_mod.build_graph(tmp.name)

        specify = next(s for s in graph["steps"] if s["name"] == "specify")
        drawn = [n["id"] for p in specify["phases"] for n in p["nodes"]]
        self.assertNotIn("quality-checklist", drawn)
        self.assertEqual(specify["changes"]["removed"], ["quality-checklist"])
        self.assertTrue(graph["customised"])

    def test_a_hook_is_attached_to_the_node_it_names(self):
        tmp = project_with(
            "commands:\n  specify:\n    hooks:\n      before:\n        draft-spec:\n"
            "          - { type: prompt, text: check the canvas }\n")
        self.addCleanup(tmp.cleanup)
        graph = graph_mod.build_graph(tmp.name)

        specify = next(s for s in graph["steps"] if s["name"] == "specify")
        draft = next(n for p in specify["phases"] for n in p["nodes"] if n["id"] == "draft-spec")
        self.assertEqual(len(draft["hooks"]), 1)
        self.assertEqual(draft["hooks"][0]["when"], "before")
        self.assertIn("check the canvas", draft["hooks"][0]["summary"])

    def test_a_skill_hook_is_summarised_by_its_skill_not_its_note(self):
        """The chip names the hook, and an edit starts from that name.

        Taking whichever field was filled meant a skill hook carrying a note was
        summarised by the note — so the board named it after the note, and
        saving an unchanged edit wrote the note into `ref`, leaving a hook
        pointing at a skill that does not exist.
        """
        tmp = project_with(
            "commands:\n  specify:\n    hooks:\n      before:\n        draft-spec:\n"
            "          - { type: skill, ref: house-check, text: mind the changelog }\n")
        self.addCleanup(tmp.cleanup)
        graph = graph_mod.build_graph(tmp.name)

        specify = next(s for s in graph["steps"] if s["name"] == "specify")
        draft = next(n for p in specify["phases"] for n in p["nodes"] if n["id"] == "draft-spec")
        self.assertEqual(draft["hooks"][0]["summary"], "house-check")
        self.assertEqual(draft["hooks"][0]["note"], "mind the changelog")

    def test_a_node_hook_is_summarised_by_the_node_it_includes(self):
        tmp = project_with(
            "commands:\n  specify:\n    hooks:\n      before:\n        draft-spec:\n"
            "          - { type: node, ref: house-review }\n")
        self.addCleanup(tmp.cleanup)
        nodes = os.path.join(tmp.name, ".specify", "companion", "nodes")
        os.makedirs(nodes, exist_ok=True)
        with open(os.path.join(nodes, "house-review.md"), "w") as fh:
            fh.write("---\nid: house-review\n---\n\nRe-read what you wrote.\n")
        graph = graph_mod.build_graph(tmp.name)

        specify = next(s for s in graph["steps"] if s["name"] == "specify")
        draft = next(n for p in specify["phases"] for n in p["nodes"] if n["id"] == "draft-spec")
        self.assertEqual(draft["hooks"][0]["summary"], "house-review")

    def test_a_hook_on_a_phase_is_attached_to_the_phase(self):
        tmp = project_with(
            "commands:\n  specify:\n    hooks:\n      after:\n        author:\n"
            "          - { type: prompt, text: re-read the draft }\n")
        self.addCleanup(tmp.cleanup)
        graph = graph_mod.build_graph(tmp.name)

        specify = next(s for s in graph["steps"] if s["name"] == "specify")
        author = next(p for p in specify["phases"] if p["name"] == "author")
        self.assertEqual(len(author["hooks"]), 1)
        self.assertEqual(author["hooks"][0]["when"], "after")

    def test_a_changed_route_is_reported(self):
        tmp = project_with(
            "commands:\n  specify:\n    decisions:\n      classify-size:\n"
            "        simple:\n          folds: [tasks]\n")
        self.addCleanup(tmp.cleanup)
        graph = graph_mod.build_graph(tmp.name)

        specify = next(s for s in graph["steps"] if s["name"] == "specify")
        self.assertEqual(specify["changes"]["decisions"], ["classify-size.simple"])
        simple = next(v for v in specify["decisions"][0]["verdicts"] if v["name"] == "simple")
        self.assertEqual(simple["folds"], ["tasks"])


class ABrokenConfigurationStillDraws(unittest.TestCase):
    def test_the_error_arrives_as_data_not_as_a_crash(self):
        # A broken configuration is exactly when someone opens the builder. A
        # panel that renders nothing is no help in fixing it.
        tmp = project_with("commands:\n  plan:\n    nodes: [plan-doc, no-such-node]\n")
        self.addCleanup(tmp.cleanup)
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "pipeline-graph.py"), "--project", tmp.name],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0)
        payload = json.loads(result.stdout)
        self.assertIn("error", payload)
        self.assertIn("no-such-node", payload["error"])

    def test_a_healthy_project_emits_parseable_json(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "pipeline-graph.py"), "--project", str(EXT.parent)],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertNotIn("error", payload)
        self.assertIn("steps", payload)


if __name__ == "__main__":
    unittest.main()
