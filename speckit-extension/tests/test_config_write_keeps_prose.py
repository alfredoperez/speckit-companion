"""What a panel write must leave alone in a file people read.

`companion.yml` is a file somebody edits by hand and reviews in a pull request,
so the notes they leave in it are part of it. Replacing a block walked past the
blank lines and comments trailing it to find the next key, and then replaced the
whole span — so a reorder from the panel quietly ate them.

Also here: seeding a new workflow takes a name, and treated anything it did not
recognise as "start from what this project runs", which produced a workflow that
was not the one asked for and said nothing about it.
"""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import config_repair as repair  # noqa: E402
import config_write as cw  # noqa: E402

ANNOTATED = """commands:
  specify:
    nodes:
      - draft-spec
      - quality-checklist

    # The doctor runs last on purpose: it reads what the others wrote.
    hooks:
      before:
        handoff:
          - { type: prompt, text: check it }
"""


class AWriteKeepsWhatSomebodyWrote(unittest.TestCase):
    def test_reordering_nodes_keeps_the_comment_after_them(self):
        out = cw.set_nodes(ANNOTATED, "specify", ["quality-checklist", "draft-spec"])
        self.assertIn("# The doctor runs last on purpose", out)
        self.assertIn("hooks:", out)
        # And the reorder itself happened.
        nodes = [l.strip() for l in out.splitlines() if l.strip().startswith("- ")]
        self.assertEqual(nodes[:2], ["- quality-checklist", "- draft-spec"])

    def test_regrouping_phases_keeps_the_comment_after_them(self):
        text = ANNOTATED.replace(
            "    nodes:\n      - draft-spec\n      - quality-checklist\n",
            "    phases:\n      - name: author\n        nodes:\n          - draft-spec\n",
        )
        out = cw.set_phases(text, "specify", [{"name": "author", "nodes": ["draft-spec"]}])
        self.assertIn("# The doctor runs last on purpose", out)

    def test_a_repair_keeps_the_comment_after_the_block_it_drops(self):
        out = repair.drop_key(ANNOTATED, "specify", "nodes")
        self.assertNotIn("- draft-spec", out)
        self.assertIn("# The doctor runs last on purpose", out)


class SeedingANewWorkflowNamesItsSource(unittest.TestCase):
    def project(self) -> str:
        root = tempfile.mkdtemp()
        os.makedirs(os.path.join(root, ".specify", "companion", "workflows"), exist_ok=True)
        return root

    def test_a_name_that_is_not_there_is_refused_rather_than_swapped(self):
        root = self.project()
        with self.assertRaises(cw.ConfigWriteError) as caught:
            cw.new_workflow(root, "bugfix", seed_from="typoed-name")
        self.assertIn("typoed-name", str(caught.exception))

    def test_a_path_cannot_be_smuggled_in_as_a_name(self):
        root = self.project()
        with self.assertRaises(cw.ConfigWriteError):
            cw.new_workflow(root, "bugfix", seed_from="../../../../etc/hosts")

    def test_shipped_and_this_are_still_the_two_it_understands(self):
        root = self.project()
        cw.new_workflow(root, "from-shipped", seed_from="shipped")
        with open(os.path.join(root, ".specify", "companion.yml"), "w") as fh:
            fh.write(ANNOTATED)
        cw.new_workflow(root, "from-this", seed_from="this")
        made = os.listdir(os.path.join(root, ".specify", "companion", "workflows"))
        self.assertIn("from-shipped.yml", made)
        self.assertIn("from-this.yml", made)


if __name__ == "__main__":
    unittest.main()
