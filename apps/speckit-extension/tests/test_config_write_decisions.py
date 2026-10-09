#!/usr/bin/env python3
"""Where a verdict routes, written from the panel.

There is exactly one real branch in this pipeline, and it was the one part of
the pipeline the panel could only read: `classify-size` decides whether a change
keeps the full path or folds toward implement, the board drew that routing, and
nothing offered a way to disagree with it. The override that changes it had
shipped the whole time.

So these are the guarantees that make it editable without a second mechanism:
the write goes into the same `commands.<step>` block hooks and phases go into,
the file around it comes through byte-identical, a change the build would ignore
is refused before the file is touched, and removal is how a verdict goes back to
the routing Companion declares.

Stdlib `unittest` only.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
sys.path.insert(0, str(HERE))

from builder_harness import Project, Refused  # noqa: E402


class WritingAVerdictsRouting(unittest.TestCase):
    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)

    def route(self, *args):
        return self.project.write("--command", "specify", "--decision",
                                  "classify-size", *args)

    def test_a_fresh_project_gets_the_whole_block(self):
        self.route("simple", "--folds", "plan,tasks")
        self.assertIn("decisions:", self.project.config_text())
        self.assertIn("classify-size:", self.project.config_text())
        self.assertIn("folds: [plan, tasks]", self.project.config_text())

    def test_both_halves_are_always_written(self):
        """A half override reads the other half from the declaration, which is half true."""
        self.route("simple", "--folds", "plan")
        self.assertIn('warns: ""', self.project.config_text())

    def test_a_second_verdict_joins_the_first(self):
        self.route("simple", "--folds", "plan")
        self.route("oversized", "--warns", "Big one")
        text = self.project.config_text()
        self.assertIn("simple:", text)
        self.assertIn("oversized:", text)
        self.assertIn('warns: "Big one"', text)

    def test_writing_a_verdict_again_replaces_it(self):
        self.route("simple", "--folds", "plan")
        self.route("simple", "--folds", "plan,tasks")
        text = self.project.config_text()
        self.assertEqual(text.count("simple:"), 1)
        self.assertIn("folds: [plan, tasks]", text)
        self.assertNotIn("folds: [plan]\n", text)

    def test_the_build_reads_what_was_written(self):
        self.route("simple", "--folds", "tasks")
        built = self.project.build_ok()
        self.assertIn("classify-size = simple → skips tasks", built)

    def test_the_graph_reports_it_as_this_projects(self):
        self.route("simple", "--folds", "tasks")
        specify = next(s for s in self.project.graph()["steps"] if s["name"] == "specify")
        self.assertEqual(specify["changes"]["decisions"], ["classify-size.simple"])
        verdict = next(v for v in specify["decisions"][0]["verdicts"]
                       if v["name"] == "simple")
        self.assertEqual(verdict["folds"], ["tasks"])


class WhatElseIsInTheFile(unittest.TestCase):
    """The configuration is a file people read and review in a pull request."""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.project.set_config(
            "# My project's pipeline.\n"
            "workflow: \"\"\n"
            "\n"
            "commands:\n"
            "  specify:\n"
            "    # A note someone wrote.\n"
            "    nodes:\n"
            "      - resolve-dir\n"
            "      - draft-spec\n"
            "      - classify-size\n"
        )

    def test_the_comments_and_the_order_survive_a_write(self):
        self.project.write("--command", "specify", "--decision", "classify-size",
                           "simple", "--folds", "plan")
        text = self.project.config_text()
        self.assertIn("# My project's pipeline.", text)
        self.assertIn("# A note someone wrote.", text)
        self.assertIn("      - draft-spec", text)

    def test_a_removal_leaves_everything_else_exactly_as_it_was(self):
        before = self.project.config_text()
        self.project.write("--command", "specify", "--decision", "classify-size",
                           "simple", "--folds", "plan")
        self.project.write("--command", "specify", "--decision", "classify-size",
                           "simple", "--restore-decision")
        self.assertEqual(self.project.config_text(), before)


class GivingAVerdictBack(unittest.TestCase):
    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)

    def test_an_absent_override_is_the_declared_routing(self):
        self.project.write("--command", "specify", "--decision", "classify-size",
                           "simple", "--folds", "tasks")
        self.project.write("--command", "specify", "--decision", "classify-size",
                           "simple", "--restore-decision")
        self.assertIn("classify-size = simple → skips plan, tasks",
                      self.project.build_ok())

    def test_the_keys_that_held_it_go_with_it(self):
        """A `decisions:` pointing at nothing is a change nobody made."""
        self.project.write("--command", "specify", "--decision", "classify-size",
                           "simple", "--folds", "tasks")
        self.project.write("--command", "specify", "--decision", "classify-size",
                           "simple", "--restore-decision")
        self.assertNotIn("decisions", self.project.config_text())
        self.assertNotIn("classify-size", self.project.config_text())

    def test_one_verdict_leaving_keeps_the_other(self):
        self.project.write("--command", "specify", "--decision", "classify-size",
                           "simple", "--folds", "tasks")
        self.project.write("--command", "specify", "--decision", "classify-size",
                           "oversized", "--warns", "Big one")
        self.project.write("--command", "specify", "--decision", "classify-size",
                           "simple", "--restore-decision")
        text = self.project.config_text()
        self.assertIn("oversized:", text)
        self.assertNotIn("simple:", text)

    def test_putting_back_what_was_never_changed_is_refused(self):
        with self.assertRaises(Refused) as caught:
            self.project.write("--command", "specify", "--decision", "classify-size",
                               "simple", "--restore-decision")
        self.assertIn("no changed routing", str(caught.exception))


class ARefusedRoutingChange(unittest.TestCase):
    """Each of these is otherwise silent — ignored by the build, or fatal to it."""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.project.write("--command", "specify", "--decision", "classify-size",
                           "simple", "--folds", "plan")
        self.before = self.project.config_text()

    def refuse(self, *args):
        with self.assertRaises(Refused) as caught:
            self.project.write(*args)
        self.assertEqual(self.project.config_text(), self.before)
        return str(caught.exception)

    def test_a_node_that_decides_nothing(self):
        said = self.refuse("--command", "specify", "--decision", "draft-spec", "simple",
                           "--folds", "plan")
        self.assertIn("decides nothing", said)
        self.assertIn("classify-size", said)

    def test_a_verdict_the_node_cannot_answer(self):
        said = self.refuse("--command", "specify", "--decision", "classify-size",
                           "enormous", "--folds", "plan")
        self.assertIn("no verdict 'enormous'", said)
        self.assertIn("simple", said)

    def test_a_step_that_makes_no_decision(self):
        said = self.refuse("--command", "plan", "--decision", "classify-size", "simple")
        self.assertIn("makes no decision", said)

    def test_skipping_a_step_that_does_not_exist(self):
        said = self.refuse("--command", "specify", "--decision", "classify-size",
                           "simple", "--folds", "deploy")
        self.assertIn("deploy", said)
        self.assertIn("not a step", said)

    def test_skipping_the_step_that_decides(self):
        said = self.refuse("--command", "specify", "--decision", "classify-size",
                           "simple", "--folds", "specify")
        self.assertIn("the step that decides", said)


if __name__ == "__main__":
    unittest.main()
