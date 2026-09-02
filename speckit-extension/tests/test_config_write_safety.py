#!/usr/bin/env python3
"""What a refused write must not do to the file it refused.

Two ways to lose a project's whole configuration, both reachable from the panel
by ordinary use, and both silent about it:

  A write shaped `with open(path, "w") as fh: fh.write(f(existing))` truncates
  the moment it opens. When `f` raised — a stale hook index from a panel drawn
  before someone edited the file by hand — the message said "there is no hook 6"
  and the file was already zero bytes.

  Removing the last hook under an anchor looked the anchor up again from the top
  of the file. `handoff` is a node in every step, so `specify` and `plan` both
  have one. Removing plan's took specify's block, hooks and all.

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


class ARefusedWriteLeavesTheFileAlone(unittest.TestCase):
    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.project.write("--command", "specify", "--when", "after", "--anchor",
                           "handoff", "--hook", "skill", "--ref", "create-pr")
        self.before = self.project.config_text()
        self.assertTrue(self.before.strip(), "the fixture wrote nothing")

    def refuse(self, *args):
        with self.assertRaises(Refused) as caught:
            self.project.write(*args)
        return str(caught.exception)

    def test_a_hook_index_that_is_not_there(self):
        self.refuse("--command", "specify", "--when", "after", "--anchor", "handoff",
                    "--remove-index", "5")
        self.assertEqual(self.project.config_text(), self.before)

    def test_an_anchor_that_has_no_hooks(self):
        self.refuse("--command", "specify", "--when", "before", "--anchor", "draft-spec",
                    "--remove-index", "0")
        self.assertEqual(self.project.config_text(), self.before)

    def test_a_hook_edit_at_an_index_that_is_not_there(self):
        self.refuse("--command", "specify", "--when", "after", "--anchor", "handoff",
                    "--hook", "prompt", "--text", "x", "--edit-index", "9")
        self.assertEqual(self.project.config_text(), self.before)

    def test_a_hook_whose_text_the_format_cannot_carry(self):
        self.refuse("--command", "specify", "--when", "after", "--anchor", "handoff",
                    "--hook", "prompt", "--text", "it's \"both\" quotes")
        self.assertEqual(self.project.config_text(), self.before)

    def test_a_template_section_the_template_does_not_have(self):
        self.project.template("spec-template.md", "Requirements")
        self.refuse("--command", "specify", "--template-section", "Invented",
                    "--fragment", "outcomes")
        self.assertEqual(self.project.config_text(), self.before)

    def test_an_order_the_phases_cannot_express(self):
        self.refuse("--command", "specify", "--nodes", "handoff,draft-spec")
        self.assertEqual(self.project.config_text(), self.before)

    def test_a_grouping_that_leaves_a_node_homeless(self):
        import json
        self.refuse("--command", "specify", "--phases",
                    json.dumps([{"name": "all", "nodes": ["draft-spec"]}]))
        self.assertEqual(self.project.config_text(), self.before)


class RemovingTheLastHookAtAnAnchor(unittest.TestCase):
    """An anchor name is a node id, and node ids repeat across steps."""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)

    def hook(self, command, when, anchor, ref):
        self.project.write("--command", command, "--when", when, "--anchor", anchor,
                           "--hook", "skill", "--ref", ref)

    def test_another_steps_hooks_at_the_same_anchor_survive(self):
        self.hook("specify", "after", "handoff", "keep-me")
        self.hook("plan", "after", "handoff", "remove-me")
        self.project.write("--command", "plan", "--when", "after", "--anchor", "handoff",
                           "--remove-index", "0")
        text = self.project.config_text()
        self.assertIn("keep-me", text)
        self.assertNotIn("remove-me", text)

    def test_the_other_side_of_the_same_anchor_survives(self):
        self.hook("specify", "before", "draft-spec", "keep-me")
        self.hook("specify", "after", "draft-spec", "remove-me")
        self.project.write("--command", "specify", "--when", "after", "--anchor",
                           "draft-spec", "--remove-index", "0")
        text = self.project.config_text()
        self.assertIn("keep-me", text)
        self.assertNotIn("remove-me", text)

    def test_the_emptied_anchor_is_taken_with_it(self):
        """A key pointing at nothing is debris a later write has to reason about."""
        self.hook("specify", "after", "handoff", "only-one")
        self.project.write("--command", "specify", "--when", "after", "--anchor",
                           "handoff", "--remove-index", "0")
        self.assertNotIn("handoff:", self.project.config_text())

    def test_a_sibling_hook_at_the_same_anchor_keeps_its_place(self):
        self.hook("specify", "after", "handoff", "first")
        self.hook("specify", "after", "handoff", "second")
        self.project.write("--command", "specify", "--when", "after", "--anchor",
                           "handoff", "--remove-index", "0")
        text = self.project.config_text()
        self.assertNotIn("first", text)
        self.assertIn("second", text)

    def test_the_configuration_still_builds_afterwards(self):
        self.hook("specify", "after", "handoff", "keep-me")
        self.hook("plan", "after", "handoff", "remove-me")
        self.project.write("--command", "plan", "--when", "after", "--anchor", "handoff",
                           "--remove-index", "0")
        self.project.build_ok()
        self.assertIn("keep-me", self.project.body("specify"))


if __name__ == "__main__":
    unittest.main()
