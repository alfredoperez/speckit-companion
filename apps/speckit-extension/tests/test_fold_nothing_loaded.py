"""A configured project that resolves no capability says so where someone will see it.

The fold already told three stories apart — unaccounted capabilities, correctly nothing,
and nothing loaded — and told all of them to stderr, which nobody reads. The third is the
one that matters: on a project with living specs turned on, nothing loaded means the run
was briefed on nothing and wrote nothing back, which is the state living specs exist to
prevent. It is also the one state the accountability check cannot see, because it has no
loaded capability to hold to account, so it returns "all accounted for" by definition.
"""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "speckit-extension" / "scripts"
sys.path.insert(0, str(SCRIPTS))
_spec = importlib.util.spec_from_file_location("living_spec_fold", SCRIPTS / "living_spec_fold.py")
lsf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lsf)


class NothingLoadedIsRecorded(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="fold-nothing-")
        self.root = Path(self.tmp)
        self.feature_dir = self.root / "specs" / "001-a-feature"
        self.feature_dir.mkdir(parents=True)
        (self.feature_dir / ".spec-context.json").write_text("{}", encoding="utf-8")

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _concerns(self) -> str:
        return json.dumps(
            json.loads((self.feature_dir / ".spec-context.json").read_text()).get("concerns") or [])

    def test_a_configured_project_records_it(self):
        (self.root / "living-specs.yml").write_text("enabled: true\ncapabilities: []\n", encoding="utf-8")
        lsf._note_nothing_loaded(self.feature_dir, self.root)
        self.assertIn("resolved no living-spec capability", self._concerns())

    def test_it_names_both_causes_so_the_reader_can_tell_them_apart(self):
        # Belonging to no capability yet and being claimed by one that describes nothing
        # look identical from here, and the fix differs.
        (self.root / "living-specs.yml").write_text("enabled: true\ncapabilities: []\n", encoding="utf-8")
        lsf._note_nothing_loaded(self.feature_dir, self.root)
        text = self._concerns()
        self.assertIn("belong to no capability", text)
        self.assertIn("no requirement describes", text)

    def test_a_project_not_using_living_specs_stays_quiet(self):
        lsf._note_nothing_loaded(self.feature_dir, self.root)
        self.assertEqual(self._concerns(), "[]")

    def test_recording_twice_does_not_duplicate(self):
        (self.root / "living-specs.yml").write_text("enabled: true\ncapabilities: []\n", encoding="utf-8")
        lsf._note_nothing_loaded(self.feature_dir, self.root)
        lsf._note_nothing_loaded(self.feature_dir, self.root)
        entries = json.loads((self.feature_dir / ".spec-context.json").read_text())["concerns"]
        self.assertEqual(len(entries), 1)

    def test_it_never_fails_the_host_command(self):
        (self.root / "living-specs.yml").write_text("enabled: true\n", encoding="utf-8")
        lsf._note_nothing_loaded(Path("/nonexistent/nowhere"), self.root)


if __name__ == "__main__":
    unittest.main()
