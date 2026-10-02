#!/usr/bin/env python3
"""Moving one hook is one write, and a refused move leaves the file byte for byte as it was."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
sys.path.insert(0, str(HERE))

from builder_harness import Project, Refused  # noqa: E402

import config_write as cw  # noqa: E402

ANNOTATED = """\
# the project's pipeline
commands:
  specify:
    hooks:
      after:
        # runs once the spec is drafted
        draft-spec:
          - { type: skill, ref: first }
          - { type: prompt, text: 'Check the "scope" line.' }
          - { type: command, run: "npm test" }

        # the handoff is last
        handoff:
          - { type: skill, ref: create-pr }
"""


class MovingAHookInTheText(unittest.TestCase):
    def test_another_anchor_takes_it_last_and_it_reads_as_written(self):
        out = cw.move_hook(ANNOTATED, "specify", "after", "draft-spec", 1,
                           "after", "handoff")
        self.assertIn("""        handoff:
          - { type: skill, ref: create-pr }
          - { type: prompt, text: 'Check the "scope" line.' }
""", out)
        self.assertEqual(out.count("scope"), 1)

    def test_a_place_up_the_same_list(self):
        out = cw.move_hook(ANNOTATED, "specify", "after", "draft-spec", 2,
                           "after", "draft-spec", 0)
        self.assertIn("""        draft-spec:
          - { type: command, run: "npm test" }
          - { type: skill, ref: first }
""", out)

    def test_a_place_down_the_same_list(self):
        out = cw.move_hook(ANNOTATED, "specify", "after", "draft-spec", 0,
                           "after", "draft-spec", 1)
        self.assertIn("""          - { type: prompt, text: 'Check the "scope" line.' }
          - { type: skill, ref: first }
          - { type: command, run: "npm test" }
""", out)

    def test_every_other_line_comes_back_unchanged(self):
        out = cw.move_hook(ANNOTATED, "specify", "after", "draft-spec", 0,
                           "after", "draft-spec", 2)
        self.assertEqual(sorted(out.splitlines()), sorted(ANNOTATED.splitlines()))

    def test_an_emptied_anchor_goes_and_the_comments_after_it_stay(self):
        out = cw.move_hook(ANNOTATED, "specify", "after", "handoff", 0,
                           "before", "draft-spec")
        self.assertNotIn("handoff:", out)
        self.assertIn("# the handoff is last", out)
        self.assertIn("# runs once the spec is drafted", out)
        self.assertIn("      before:\n        draft-spec:\n          - { type: skill, ref: create-pr }", out)

    def test_a_content_edit_rides_the_same_write(self):
        out = cw.move_hook(ANNOTATED, "specify", "after", "draft-spec", 0,
                           "after", "handoff", None, {"type": "skill", "ref": "second"})
        self.assertIn('- { type: skill, ref: "second" }', out)
        self.assertNotIn("ref: first", out)

    def test_a_block_entry_travels_with_the_comment_between_its_keys(self):
        text = ("commands:\n  specify:\n    hooks:\n      after:\n        draft-spec:\n"
                "          - type: skill\n            # which skill\n            ref: review\n"
                "        handoff:\n          - { type: skill, ref: create-pr }\n")
        out = cw.move_hook(text, "specify", "after", "draft-spec", 0, "after", "handoff")
        self.assertNotIn("draft-spec:", out)
        self.assertIn("          - { type: skill, ref: create-pr }\n          - type: skill\n"
                      "            # which skill\n            ref: review\n", out)

    def test_an_empty_inline_side_is_opened_before_the_hook_lands(self):
        text = ("commands:\n  specify:\n    hooks:\n      before: {}\n      after:\n"
                "        draft-spec:\n          - { type: skill, ref: one }\n")
        out = cw.move_hook(text, "specify", "after", "draft-spec", 0, "before", "handoff")
        self.assertIn("      before:\n        handoff:\n          - { type: skill, ref: one }", out)
        self.assertNotIn("{}", out)

    def test_a_target_written_on_one_line_is_refused(self):
        text = ("commands:\n  specify:\n    hooks:\n      after:\n"
                "        handoff: [{ type: skill, ref: x }]\n"
                "        draft-spec:\n          - { type: skill, ref: one }\n")
        with self.assertRaises(cw.ConfigWriteError):
            cw.move_hook(text, "specify", "after", "draft-spec", 0, "after", "handoff")

    def test_a_move_onto_its_own_place_is_refused(self):
        with self.assertRaises(cw.ConfigWriteError):
            cw.move_hook(ANNOTATED, "specify", "after", "draft-spec", 1,
                         "after", "draft-spec", 1)


class MovingAHookFromThePanel(unittest.TestCase):
    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        for ref in ("one", "two"):
            self.project.write("--command", "specify", "--when", "after", "--anchor",
                               "draft-spec", "--hook", "skill", "--ref", ref)
        self.before = self.project.config_text()

    def move(self, *args):
        return self.project.write("--command", "specify", *args)

    def refuse(self, *args):
        with self.assertRaises(Refused) as caught:
            self.move(*args)
        self.assertEqual(self.project.config_text(), self.before)
        return str(caught.exception)

    def test_it_runs_at_the_new_anchor_after_a_build(self):
        self.move("--move-from", "after", "draft-spec", "0",
                  "--when", "before", "--anchor", "handoff", "--boundary", "node")
        hooks = [h for h in self.project.graph()["steps"] if h["name"] == "specify"][0]
        placed = {(h["anchor"], h["when"], h["summary"])
                  for p in hooks["phases"] for n in p["nodes"] for h in n["hooks"]}
        self.assertIn(("handoff", "before", "one"), placed)
        self.assertIn(("draft-spec", "after", "two"), placed)
        self.assertNotIn(("draft-spec", "after", "one"), placed)

    def test_a_phase_is_a_target_too(self):
        self.move("--move-from", "after", "draft-spec", "1",
                  "--when", "before", "--anchor", "author", "--boundary", "phase")
        self.assertIn("author:", self.project.config_text())

    def test_an_index_that_is_not_there(self):
        self.assertIn("no hook 6", self.refuse(
            "--move-from", "after", "draft-spec", "5", "--when", "before", "--anchor", "handoff"))

    def test_an_anchor_the_step_does_not_have(self):
        self.assertIn("no node or phase", self.refuse(
            "--move-from", "after", "draft-spec", "0", "--when", "before", "--anchor", "nowhere"))

    def test_a_name_that_resolves_to_the_other_boundary(self):
        self.project.write("--command", "auto", "--when", "after", "--anchor",
                           "resolve-dir", "--hook", "skill", "--ref", "x")
        self.before = self.project.config_text()
        with self.assertRaises(Refused) as caught:
            self.project.write("--command", "auto", "--move-from", "after", "resolve-dir", "0",
                               "--when", "before", "--anchor", "orchestrate",
                               "--boundary", "phase")
        self.assertIn("runs at the node", str(caught.exception))
        self.assertEqual(self.project.config_text(), self.before)

    def test_a_place_past_the_end(self):
        self.assertIn("no place", self.refuse(
            "--move-from", "after", "draft-spec", "0", "--when", "after",
            "--anchor", "draft-spec", "--to-index", "4"))


if __name__ == "__main__":
    unittest.main()
