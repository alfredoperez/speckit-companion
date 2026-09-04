#!/usr/bin/env python3
"""Decisions as data (the pipeline's one real branch).

`classify-size` decides whether a change keeps the full path or folds toward
implement. That routing was written in three places — the shared routing part,
the workflow file's switch, and the classifier's instructions — and expressible
in none of them, so a project could not change where a verdict goes and nothing
could draw the branch without re-reading prose.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import sys
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import decision_routes as d  # noqa: E402

build = importlib.import_module("build-pipeline")
assemble = importlib.import_module("assemble-nodes")

NODES = str(EXT / "nodes")


class TheBranchIsDeclared(unittest.TestCase):
    def setUp(self):
        self.decisions = d.decisions_for("specify", NODES)

    def test_specify_declares_its_classifier_as_the_decision(self):
        self.assertEqual([x["node"] for x in self.decisions], ["classify-size"])

    def test_it_declares_every_verdict_the_classifier_can_reach(self):
        names = [v["name"] for v in self.decisions[0]["verdicts"]]
        self.assertEqual(sorted(names), ["normal", "oversized", "simple"])

    def test_simple_folds_the_two_middle_steps(self):
        simple = next(v for v in self.decisions[0]["verdicts"] if v["name"] == "simple")
        self.assertEqual(simple["folds"], ["plan", "tasks"])

    def test_oversized_warns_and_skips_nothing(self):
        oversized = next(v for v in self.decisions[0]["verdicts"] if v["name"] == "oversized")
        self.assertEqual(oversized["folds"], [])
        self.assertTrue(oversized["warns"])

    def test_a_step_that_decides_nothing_declares_nothing(self):
        self.assertEqual(d.decisions_for("plan", NODES), [])

    def test_the_declared_verdicts_match_what_the_command_emits(self):
        # The classify command names the verdicts it can produce; a declaration
        # routing a verdict the classifier never emits is a branch that can
        # never be taken — the defect this repository already shipped once.
        import re
        body = (EXT / "commands" / "speckit.companion.classify.md").read_text(encoding="utf-8")
        emitted = set(re.search(r"size=<([^>]+)>", body).group(1).split("|"))
        declared = {v["name"] for v in self.decisions[0]["verdicts"]}
        self.assertEqual(declared, emitted)


class AProjectCanChangeWhereAVerdictRoutes(unittest.TestCase):
    def _override(self, settings):
        return {"commands": {"specify": {"decisions": {"classify-size": settings}}}}

    def test_a_changed_fold_is_applied_and_reported(self):
        declared = d.decisions_for("specify", NODES)
        resolved, changed = d.apply_overrides(
            declared, self._override({"simple": {"folds": ["tasks"]}}), "specify")
        simple = next(v for v in resolved[0]["verdicts"] if v["name"] == "simple")
        self.assertEqual(simple["folds"], ["tasks"])
        self.assertEqual(changed, ["classify-size.simple"])

    def test_an_untouched_verdict_is_not_reported_as_changed(self):
        declared = d.decisions_for("specify", NODES)
        _resolved, changed = d.apply_overrides(
            declared, self._override({"simple": {"folds": ["plan", "tasks"]}}), "specify")
        self.assertEqual(changed, [], "restating the default is not a change")

    def test_no_configuration_leaves_the_declaration_alone(self):
        declared = d.decisions_for("specify", NODES)
        resolved, changed = d.apply_overrides(declared, {}, "specify")
        self.assertEqual(resolved, declared)
        self.assertEqual(changed, [])


class AnImpossibleRouteStopsTheBuild(unittest.TestCase):
    def test_folding_a_step_that_does_not_exist_is_refused(self):
        declared = d.decisions_for("specify", NODES)
        resolved, _ = d.apply_overrides(
            declared,
            {"commands": {"specify": {"decisions": {"classify-size": {
                "simple": {"folds": ["no-such-step"]}}}}}},
            "specify")
        problems = d.validate(resolved, set(assemble.decomposed_commands()))
        self.assertTrue(problems)
        self.assertIn("no-such-step", problems[0])

    def test_the_build_refuses_it_too(self):
        config = {"commands": {"specify": {"decisions": {"classify-size": {
            "simple": {"folds": ["nope"]}}}}}}
        with self.assertRaises(build.BuildError) as caught:
            build.plan_build(config)
        self.assertIn("nope", str(caught.exception))


class AChangedRouteReachesTheAssistant(unittest.TestCase):
    def test_the_body_carries_a_note_naming_the_new_route(self):
        config = {"commands": {"specify": {"decisions": {"classify-size": {
            "simple": {"folds": ["tasks"]}}}}}}
        plan, _ = build.plan_build(config)
        body = build.render("specify", plan["specify"])
        self.assertIn("changed how this step's verdict routes", body)
        self.assertIn("skip tasks", body)

    def test_an_unchanged_pipeline_carries_no_note(self):
        plan, _ = build.plan_build({})
        body = build.render("specify", plan["specify"])
        self.assertNotIn("changed how this step's verdict routes", body)

    def test_the_note_follows_the_node_that_decides(self):
        config = {"commands": {"specify": {"decisions": {"classify-size": {
            "simple": {"folds": ["tasks"]}}}}}}
        plan, _ = build.plan_build(config)
        body = build.render("specify", plan["specify"])
        self.assertGreater(body.index("changed how this step's verdict routes"),
                           body.index("/speckit-companion:node classify-size"))


if __name__ == "__main__":
    unittest.main()
