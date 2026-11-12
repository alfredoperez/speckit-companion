"""#933 — the engine's route step prints the size specify recorded, or nothing."""
import json, subprocess, sys, tempfile, unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "status-context.py"


class SizeStepPrintsTheRecordedSize(unittest.TestCase):

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        (self.root / ".specify").mkdir()
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)
        subprocess.run(["git", "init", "-q", "."], cwd=self.root, check=True)

    def _point(self):
        (self.root / ".specify" / "feature.json").write_text(json.dumps({"feature_directory": "specs/001-x"}))

    def _run(self):
        return subprocess.run([sys.executable, str(SCRIPT), "--size"], cwd=self.root, capture_output=True, text=True)

    def test_prints_the_size_of_the_spec_feature_json_points_at(self):
        self._point()
        (self.spec / ".spec-context.json").write_text(json.dumps({"size": "simple"}))
        r = self._run()
        self.assertEqual((r.returncode, r.stdout), (0, "simple\n"))

    def test_prints_nothing_without_a_record(self):
        self._point()
        r = self._run()
        self.assertEqual((r.returncode, r.stdout), (0, ""))

    def test_prints_nothing_without_feature_json(self):
        r = self._run()
        self.assertEqual((r.returncode, r.stdout), (0, ""))

    def test_prints_nothing_for_an_unknown_size(self):
        self._point()
        (self.spec / ".spec-context.json").write_text(json.dumps({"size": "huge"}))
        self.assertEqual(self._run().stdout, "")


if __name__ == "__main__":
    unittest.main()
