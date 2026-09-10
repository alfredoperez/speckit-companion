"""A spec that is still true can say so, and stop drifting.

Drift is measured from the spec's last commit, so a spec nobody needs to change drifts
further every week and there is no way to record that it was read and found correct. Left
alone every capability ends up flagged, and a flag on everything is a flag on nothing —
which is the state that made this worth adding.

The record is a line in the spec rather than a field elsewhere, because committing it is
what moves the baseline. A note kept anywhere else would need its own bookkeeping to stay
true, which is the problem it was meant to solve.
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

SPEC = "# A capability\n\n## Requirements\n\n### It does a thing\n\nIt SHALL do the thing.\n"


class AcceptingASpec(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="drift-accept-")
        self.root = Path(self.tmp)
        (self.root / "capabilities" / "thing").mkdir(parents=True)
        self.rel = "capabilities/thing/thing.spec.md"
        (self.root / self.rel).write_text(SPEC, encoding="utf-8")
        subprocess.run(["git", "init", "-q"], cwd=self.tmp, check=True)
        subprocess.run(["git", "config", "user.email", "t@t"], cwd=self.tmp, check=True)
        subprocess.run(["git", "config", "user.name", "t"], cwd=self.tmp, check=True)
        subprocess.run(["git", "add", "-A"], cwd=self.tmp, check=True)
        subprocess.run(["git", "commit", "-qm", "first"], cwd=self.tmp, check=True)
        self.living = {"capabilities": [{"name": "thing", "match": ["src/**"], "spec": self.rel}]}

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _text(self) -> str:
        return (self.root / self.rel).read_text(encoding="utf-8")

    def test_it_records_the_commit_it_was_read_against(self):
        self.assertEqual(drift.accept(str(self.root), self.living, ["thing"]), 0)
        self.assertRegex(self._text(), r"<!-- reviewed: [0-9a-f]{7,40} -->")

    def test_the_note_goes_under_the_title_not_above_it(self):
        drift.accept(str(self.root), self.living, ["thing"])
        lines = self._text().splitlines()
        self.assertTrue(lines[0].startswith("# "), "the title must still come first")
        self.assertIn("reviewed:", "\n".join(lines[1:3]))

    def test_accepting_twice_replaces_rather_than_stacks(self):
        drift.accept(str(self.root), self.living, ["thing"])
        drift.accept(str(self.root), self.living, ["thing"])
        self.assertEqual(self._text().count("<!-- reviewed:"), 1)

    def test_the_requirements_are_untouched(self):
        drift.accept(str(self.root), self.living, ["thing"])
        self.assertIn("### It does a thing", self._text())
        self.assertIn("It SHALL do the thing.", self._text())

    def test_an_unknown_capability_changes_nothing_and_reports_it(self):
        before = self._text()
        self.assertEqual(drift.accept(str(self.root), self.living, ["nope"]), 1)
        self.assertEqual(self._text(), before)

    def test_it_never_writes_on_its_own(self):
        # Reviewing is a claim a person makes. Computing the report must not record one.
        result = drift.compute_drift(str(self.root), {"enabled": True, **self.living})
        self.assertNotIn("reviewed:", self._text())
        self.assertIsInstance(result, dict)


if __name__ == "__main__":
    unittest.main()
