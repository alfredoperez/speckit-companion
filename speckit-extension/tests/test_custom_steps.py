#!/usr/bin/env python3
"""A step a project added itself.

The pipeline's steps were a fixed five. A project could add nodes, replace them,
regroup them and hook them — but the set of steps was the extension's, so
"review the change before it counts as done" had to become a node hiding inside
implement, or nothing.

A step is a directory of nodes. That was already true for the shipped ones —
`decomposed_commands()` has always been a directory listing — so a project's own
`.specify/companion/nodes/<step>/` assembles the same way. What refused it was
the capture layer: the step vocabulary was a hardcoded set, and a run of a step
outside it was journaled nowhere, leaving no record that a phase which genuinely
happened had happened.

The guard those checks exist for is a TYPO, not an unfamiliar name. So the
vocabulary is now what the project declares — a node directory — and a
misspelling is still refused, by name, against the steps that do exist.

Stdlib `unittest` only.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from builder_harness import SCRIPTS

sys.path.insert(0, str(SCRIPTS))

import spec_context as sc  # noqa: E402

NODE = """\
---
id: review-code
name: Review the change
kind: gate
---

Re-read the diff against the spec and report what does not match.
"""

ORDER = """\
order:
  - review-code

phases:
  - name: check
    nodes: [review-code]
"""


class AProjectCanAddAStep(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="custom-step-")
        self.root = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

        step = self.root / ".specify" / "companion" / "nodes" / "review"
        step.mkdir(parents=True)
        (step / "review-code.md").write_text(NODE, encoding="utf-8")
        (step / "_order.yml").write_text(ORDER, encoding="utf-8")

        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)

    def context(self, **over) -> None:
        base = {"specName": "x", "currentStep": "implement",
                "status": "implemented", "history": []}
        base.update(over)
        (self.spec / ".spec-context.json").write_text(json.dumps(base), encoding="utf-8")

    def write(self, *args) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(SCRIPTS / "write-context.py"),
             "--feature-dir", str(self.spec), *args],
            capture_output=True, text=True)

    def read(self) -> dict:
        return json.loads((self.spec / ".spec-context.json").read_text(encoding="utf-8"))

    # ── what makes a step real ─────────────────────────────

    def test_a_node_directory_is_the_declaration(self):
        self.assertIn("review", sc.known_steps(self.spec))

    def test_the_shipped_steps_are_still_there(self):
        known = sc.known_steps(self.spec)
        for step in ("specify", "plan", "tasks", "implement"):
            self.assertIn(step, known)

    def test_a_project_with_no_steps_of_its_own_knows_only_the_shipped_ones(self):
        with tempfile.TemporaryDirectory() as bare:
            self.assertNotIn("review", sc.known_steps(Path(bare) / "specs" / "001-y"))

    # The hook form of a step-start carries no `--feature-dir` — it is a bare
    # `--step <name> --kind start`. Deriving the project only from that argument
    # consulted the extension's own steps and nothing else, so a project's own
    # step had its finish journaled and its START refused: a history ending in a
    # completion that never began, and `currentStep` never leaving implement.
    def test_a_step_is_still_this_projects_when_no_feature_dir_is_named(self):
        cwd = os.getcwd()
        os.chdir(self.root)
        self.addCleanup(os.chdir, cwd)
        self.assertIn("review", sc.known_steps())

    def test_a_misspelling_is_still_refused_when_no_feature_dir_is_named(self):
        """The guard is against a typo, which would journal against the wrong step."""
        cwd = os.getcwd()
        os.chdir(self.root)
        self.addCleanup(os.chdir, cwd)
        self.assertNotIn("reveiw", sc.known_steps())

    # ── journaling ─────────────────────────────────────────

    def test_it_can_be_recorded_like_any_other_step(self):
        self.context()
        self.write("--step", "review", "--kind", "start", "--by", "extension")
        recorded = self.read()
        self.assertEqual(recorded["currentStep"], "review")
        self.assertEqual([h["step"] for h in recorded["history"]], ["review"])

    def test_running_after_implement_is_not_read_as_going_backwards(self):
        # The ordering guard ranks the canonical steps. A step the project
        # added has no rank, so ranking it against `implement` would refuse
        # exactly the case people add one for.
        self.context(status="implemented")
        self.write("--step", "review", "--kind", "start", "--by", "extension")
        self.assertEqual(self.read()["currentStep"], "review")

    def test_a_finished_spec_stays_finished(self):
        self.context(status="completed")
        self.write("--step", "review", "--kind", "start", "--by", "extension")
        self.assertEqual(self.read()["currentStep"], "implement")

    def test_a_misspelling_is_still_refused_and_names_what_exists(self):
        self.context()
        done = self.write("--step", "reveiw", "--kind", "start", "--by", "extension")
        self.assertIn("not a step this project has", done.stderr)
        self.assertIn("review", done.stderr)
        self.assertEqual(self.read()["currentStep"], "implement")


if __name__ == "__main__":
    unittest.main()
