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


class EngineRunStoresTheUsersWords(unittest.TestCase):
    """The Overview quotes the stored request, so the engine's step marker must not land in it."""

    WORDS = "Let a todo carry an optional note (shown under its title)."

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        (self.root / "specs" / "001-x").mkdir(parents=True)
        subprocess.run(["git", "init", "-q", "."], cwd=self.root, check=True)

    def _specify_args(self):
        sys.path.insert(0, str(SCRIPT.parent))
        import companion_config as cc
        wf = cc.load_yaml((SCRIPT.parents[1] / "workflows" / "speckit-companion.workflow.yml").read_text())
        args = next(s for s in wf["steps"] if s["id"] == "specify")["input"]["args"]
        return args.replace("{{ inputs.spec }}", self.WORDS)

    def test_the_stored_request_is_exactly_what_the_user_typed(self):
        args = self._specify_args()
        self.assertNotEqual(args, self.WORDS, "the workflow no longer marks its steps; this test guards nothing")
        subprocess.run([sys.executable, str(SCRIPT.parent / "write-context.py"), "--feature-dir", "specs/001-x",
                        "--request", "-"], cwd=self.root, input=args, capture_output=True, text=True, check=True)
        stored = json.loads((self.root / "specs" / "001-x" / ".spec-context.json").read_text())["request"]
        self.assertEqual(stored, self.WORDS)


if __name__ == "__main__":
    unittest.main()
