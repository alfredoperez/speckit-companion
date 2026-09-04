#!/usr/bin/env python3
"""Adding a step from the panel — writing it, and what a build does with it.

`test_custom_steps.py` covers the capture half: a run of a step outside the
shipped set is journaled rather than refused. This is the build half, which
arrived later and was the reason the feature did nothing end to end.

`decomposed_commands()` listed only the extension's own `nodes/` directory, so a
project's `.specify/companion/nodes/<step>/` was read for replacements and never
as a step of its own. It assembled nothing, silently, and the panel had no way
to make one anyway.

Stdlib `unittest` only.
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from builder_harness import Project, Refused  # noqa: E402


class WritingTheStep(unittest.TestCase):
    """What `--new-step` puts on disk."""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)

    def add(self, name="review", label="", after="", writes=""):
        args = ["--new-step", name]
        for flag, value in (("--label", label), ("--after", after), ("--writes", writes)):
            if value:
                args += [flag, value]
        return self.project.write(*args)

    def directory(self, name="review") -> Path:
        return self.project.root / ".specify" / "companion" / "nodes" / name

    def order_file(self, name="review") -> str:
        return (self.directory(name) / "_order.yml").read_text(encoding="utf-8")

    def test_it_seeds_a_step_that_can_run(self):
        """An empty directory builds a command that tells the assistant nothing."""
        self.add(after="implement")
        for filename in ("_frame.md", "_order.yml", "review-work.md"):
            with self.subTest(file=filename):
                self.assertTrue((self.directory() / filename).is_file())

    def test_the_label_is_what_the_step_says_it_is(self):
        self.add(label="Review the change", after="implement")
        self.assertIn("Review the change",
                      (self.directory() / "_frame.md").read_text(encoding="utf-8"))

    def test_a_step_with_no_label_reads_by_its_name(self):
        self.add("code-review", after="implement")
        self.assertIn("Code review",
                      (self.directory("code-review") / "_frame.md").read_text(encoding="utf-8"))

    def test_where_it_runs_is_recorded_in_its_own_order(self):
        self.add(after="tasks")
        self.assertIn("after: tasks", self.order_file())

    def test_a_step_launched_by_hand_records_no_position(self):
        self.add()
        self.assertNotIn("after:", self.order_file())

    def test_what_it_writes_lands_on_the_node_that_writes_it(self):
        self.add(after="implement", writes="review.md")
        self.assertIn("writes: review.md",
                      (self.directory() / "review-work.md").read_text(encoding="utf-8"))

    def test_a_step_that_writes_nothing_claims_nothing(self):
        self.add(after="implement")
        self.assertNotIn("writes:",
                         (self.directory() / "review-work.md").read_text(encoding="utf-8"))


class WhatItRefuses(unittest.TestCase):
    """The name becomes a command, so a bad one produces something nobody can type."""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)

    def test_a_name_that_cannot_be_a_command_is_refused(self):
        for bad in ("Review", "review step", "2review", "", "re/view"):
            with self.subTest(name=bad), self.assertRaises(Refused):
                self.project.write("--new-step", bad)

    def test_a_name_a_shipped_step_already_has_is_refused(self):
        for taken in ("specify", "plan", "tasks", "implement", "auto"):
            with self.subTest(name=taken), self.assertRaises(Refused) as caught:
                self.project.write("--new-step", taken)
            self.assertIn("already a step", str(caught.exception))

    def test_adding_the_same_step_twice_is_refused(self):
        self.project.write("--new-step", "review", "--after", "implement")
        with self.assertRaises(Refused) as caught:
            self.project.write("--new-step", "review", "--after", "implement")
        self.assertIn("already exists", str(caught.exception))

    def test_a_position_that_is_not_a_step_is_refused(self):
        with self.assertRaises(Refused) as caught:
            self.project.write("--new-step", "review", "--after", "nowhere")
        self.assertIn("nowhere", str(caught.exception))


class WhatTheBuildDoesWithIt(unittest.TestCase):
    """The built bodies and the drawn graph — not the files that produced them."""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)

    def add(self, name="review", label="", after="", writes=""):
        args = ["--new-step", name]
        for flag, value in (("--label", label), ("--after", after), ("--writes", writes)):
            if value:
                args += [flag, value]
        self.project.write(*args)

    def drawn(self) -> dict:
        return {s["name"]: s for s in self.project.graph()["steps"]}

    def test_the_build_produces_its_command(self):
        self.add(label="Review the change", after="implement")
        self.project.build_ok()
        self.assertIn("Review the change", self.project.body("review"))
        self.assertIn("review-work", self.project.nodes_in("review"))

    def test_the_build_leaves_the_shipped_steps_alone(self):
        """A step added is a step added, not a change to the four that ship."""
        self.project.build_ok()
        before = {c: self.project.body(c) for c in ("specify", "plan", "tasks", "implement")}
        self.add(after="implement")
        self.project.build_ok()
        for command, text in before.items():
            with self.subTest(command=command):
                self.assertEqual(self.project.body(command), text)

    def test_the_step_is_drawn_where_it_says_it_goes(self):
        self.add(after="implement")
        run = [n for n, s in self.drawn().items() if s["inSequence"]]
        self.assertEqual(run.index("review"), run.index("implement") + 1)

    def test_a_step_launched_by_hand_is_drawn_outside_the_run(self):
        self.add("audit")
        self.assertFalse(self.drawn()["audit"]["inSequence"])

    def test_the_panel_can_tell_it_is_the_projects_own(self):
        self.add(after="implement")
        self.assertTrue(self.drawn()["review"]["own"])
        self.assertFalse(self.drawn()["specify"]["own"])

    def test_it_does_not_read_as_replacing_anything(self):
        """Every node in it is the project's, and none stands in for a shipped one."""
        self.add(after="implement")
        report = self.project.build_ok()
        self.assertIn("this project's own step", report)
        self.assertNotIn("review: 1 replaced", report)

    def test_what_it_writes_is_reported_as_an_artifact(self):
        self.add(after="implement", writes="review.md")
        self.assertEqual(self.drawn()["review"]["artifacts"], ["review.md"])

    def test_it_is_editable_like_any_other_step(self):
        """A step you cannot then change is a template, not a step."""
        self.add(after="implement")
        self.project.node("review", "second-pass",
                          "---\nid: second-pass\nname: Second pass\nkind: author\n"
                          "command: review\n---\nLook again.\n")
        self.project.write(
            "--command", "review", "--nodes", "review-work,second-pass",
            "--phases", json.dumps(
                [{"name": "review", "nodes": ["review-work", "second-pass"]}]))
        self.project.build_ok()
        self.assertEqual(self.project.nodes_in("review"), ["review-work", "second-pass"])

    def test_work_can_be_attached_to_it(self):
        self.add(after="implement")
        self.project.write("--command", "review", "--when", "before", "--anchor", "review",
                           "--hook", "prompt", "--text", "Read the diff first.")
        self.project.build_ok()
        self.assertIn("Read the diff first.", self.project.body("review"))

    def test_two_of_them_both_build(self):
        self.add("review", after="implement")
        self.add("audit", after="tasks")
        self.project.build_ok()
        run = [n for n, s in self.drawn().items() if s["inSequence"]]
        self.assertEqual(run.index("audit"), run.index("tasks") + 1)
        self.assertEqual(run.index("review"), run.index("implement") + 1)


class ItDoesNotMoveTheGoldens(unittest.TestCase):
    """Golden parity never points the node reader at a project, and must not start."""

    def test_the_shipped_step_list_does_not_depend_on_a_project(self):
        sys.path.insert(0, str(HERE.parent / "scripts"))
        import _command_parts as cp

        cp.use_project_nodes(None)
        self.addCleanup(cp.use_project_nodes, None)
        self.assertEqual(cp.decomposed_commands(), cp.shipped_commands())
        self.assertEqual(cp.project_commands(), [])

    def test_a_directory_of_replacements_is_not_a_new_step(self):
        """`.specify/companion/nodes/specify/` is specify's replacements, not a step."""
        sys.path.insert(0, str(HERE.parent / "scripts"))
        import _command_parts as cp

        project = Project()
        self.addCleanup(project.close)
        project.node("specify", "draft-spec", "---\nid: draft-spec\n---\nOurs.\n")

        cp.use_project_nodes(str(project.root))
        self.addCleanup(cp.use_project_nodes, None)
        self.assertNotIn("specify", cp.project_commands())


if __name__ == "__main__":
    unittest.main()
