"""Drift scoped to one branch, so an unfolded change is caught while it is still in hand.

Whole-repo drift is only ever read once it has become a backlog, and by then the flag is on
everything and means nothing. Measuring from where this work started answers the question at
the moment it can still be acted on: which capabilities did this branch touch, and did it
fold any of them.

A capability whose spec was written on this branch is folded, not drifted — that is the
whole difference between "you changed code here" and "you changed code here and said
nothing about it".
"""
from __future__ import annotations

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "speckit-extension" / "scripts"
sys.path.insert(0, str(SCRIPTS))
_spec = importlib.util.spec_from_file_location("drift", SCRIPTS / "drift.py")
drift = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(drift)

SPEC = ("# Billing\n\n## Requirements\n\n### It charges once\n"
        "<!-- touches: src/billing/** -->\n\nIt SHALL charge once.\n\n"
        "#### Scenario: a charge\n- **WHEN** asked\n- **THEN** it charges once\n")


def git(cwd, *args):
    return subprocess.run(["git", *args], cwd=cwd, check=True,
                          capture_output=True, text=True).stdout.strip()


class DriftSinceABranchPoint(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="drift-since-")
        self.root = Path(self.tmp)
        (self.root / "src" / "billing").mkdir(parents=True)
        (self.root / "src" / "billing" / "charge.ts").write_text("export {};\n")
        (self.root / "capabilities" / "billing").mkdir(parents=True)
        self.spec_rel = "capabilities/billing/billing.spec.md"
        (self.root / self.spec_rel).write_text(SPEC, encoding="utf-8")
        (self.root / "living-specs.yml").write_text(
            "enabled: true\ncapabilities:\n  - name: billing\n    match:\n"
            "      - src/billing/**\n" f"    spec: {self.spec_rel}\n", encoding="utf-8")
        git(self.tmp, "init", "-q")
        git(self.tmp, "config", "user.email", "t@t")
        git(self.tmp, "config", "user.name", "t")
        git(self.tmp, "add", "-A")
        git(self.tmp, "commit", "-qm", "baseline")
        git(self.tmp, "branch", "-M", "main")
        self.living = drift.rsp.load_living(str(self.root))

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _flagged(self, since="main") -> list:
        result = drift.compute_drift(str(self.root), self.living, since=since)
        return [c["name"] for c in result["capabilities"] if c.get("drifted")]

    def test_a_clean_branch_flags_nothing(self):
        git(self.tmp, "checkout", "-qb", "work")
        self.assertEqual(self._flagged(), [])

    def test_code_changed_without_touching_the_spec_is_flagged(self):
        git(self.tmp, "checkout", "-qb", "work")
        (self.root / "src" / "billing" / "charge.ts").write_text("export const x = 1;\n")
        git(self.tmp, "add", "-A")
        git(self.tmp, "commit", "-qm", "change the code")
        self.assertEqual(self._flagged(), ["billing"])

    def test_folding_on_the_same_branch_clears_it(self):
        git(self.tmp, "checkout", "-qb", "work")
        (self.root / "src" / "billing" / "charge.ts").write_text("export const x = 1;\n")
        (self.root / self.spec_rel).write_text(
            SPEC.replace("It SHALL charge once.", "It SHALL charge exactly once."),
            encoding="utf-8")
        git(self.tmp, "add", "-A")
        git(self.tmp, "commit", "-qm", "change the code and say so")
        self.assertEqual(self._flagged(), [])

    def test_work_already_on_the_base_is_not_this_branch_to_answer_for(self):
        # The point of measuring from the merge base: someone else's unfolded change is
        # their problem, and reporting it here is how a branch-scoped check becomes noise.
        (self.root / "src" / "billing" / "charge.ts").write_text("export const y = 2;\n")
        git(self.tmp, "add", "-A")
        git(self.tmp, "commit", "-qm", "landed on main without folding")
        git(self.tmp, "checkout", "-qb", "work")
        self.assertEqual(self._flagged(), [])

    def test_without_since_it_still_measures_from_the_specs_own_commit(self):
        git(self.tmp, "checkout", "-qb", "work")
        (self.root / "src" / "billing" / "charge.ts").write_text("export const x = 1;\n")
        git(self.tmp, "add", "-A")
        git(self.tmp, "commit", "-qm", "change the code")
        result = drift.compute_drift(str(self.root), self.living)
        self.assertEqual([c["name"] for c in result["capabilities"] if c.get("drifted")],
                         ["billing"])


if __name__ == "__main__":
    unittest.main()


class ASiblingSharingTheGlobDoesNotDrift(unittest.TestCase):
    """Two capabilities claim one folder; a requirement in one names the changed file."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="drift-sibling-")
        self.root = Path(self.tmp)
        (self.root / "src" / "billing").mkdir(parents=True)
        (self.root / "src" / "billing" / "charge.ts").write_text("export {};\n")
        (self.root / "src" / "billing" / "refund.ts").write_text("export {};\n")
        (self.root / "capabilities").mkdir()
        (self.root / "capabilities" / "charge.spec.md").write_text(
            SPEC.replace("src/billing/**", "src/billing/charge.ts"), encoding="utf-8")
        (self.root / "capabilities" / "refund.spec.md").write_text(
            "# Refund\n\n## Requirements\n\n### It refunds\n\nIt SHALL refund.\n", encoding="utf-8")
        (self.root / "living-specs.yml").write_text(
            "enabled: true\ncapabilities:\n"
            "  - name: charge\n    match:\n      - src/billing/**\n    spec: capabilities/charge.spec.md\n"
            "  - name: refund\n    match:\n      - src/billing/**\n    spec: capabilities/refund.spec.md\n",
            encoding="utf-8")
        git(self.tmp, "init", "-q")
        git(self.tmp, "config", "user.email", "t@t")
        git(self.tmp, "config", "user.name", "t")
        git(self.tmp, "add", "-A")
        git(self.tmp, "commit", "-qm", "baseline")
        self.living = drift.rsp.load_living(str(self.root))

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def drifted(self):
        report = drift._compute_drift(str(self.root), self.living, working=True)
        return {c["name"] for c in report["capabilities"] if c["drifted"]}

    def test_the_file_a_requirement_names_drifts_only_its_own_capability(self):
        (self.root / "src" / "billing" / "charge.ts").write_text("export const x = 1;\n")
        self.assertEqual(self.drifted(), {"charge"})

    def test_a_file_no_requirement_names_still_drifts_every_claimant(self):
        (self.root / "src" / "billing" / "refund.ts").write_text("export const y = 1;\n")
        self.assertEqual(self.drifted(), {"charge", "refund"})
