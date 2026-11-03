"""The writer finds the project and the spec the way spec-kit does."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

WRITER = Path(__file__).resolve().parents[1] / "scripts" / "write-context.py"


class ProjectRoot(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.repo = Path(self._tmp.name).resolve()
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)

    def member(self, rel, *specs):
        root = self.repo / rel
        (root / ".specify").mkdir(parents=True)
        for name in specs:
            (root / "specs" / name).mkdir(parents=True)
        return root

    def point(self, root, spec):
        (root / ".specify" / "feature.json").write_text(json.dumps({"feature_directory": f"specs/{spec}"}), encoding="utf-8")

    def write(self, cwd, *args, env=None):
        full = {k: v for k, v in os.environ.items() if not k.startswith("SPECIFY_")}
        full.update(env or {})
        return subprocess.run([sys.executable, str(WRITER), *args], cwd=cwd, env=full,
                              capture_output=True, text=True)

    def recorded(self, spec_dir):
        path = spec_dir / ".spec-context.json"
        return path.is_file() and bool(json.loads(path.read_text(encoding="utf-8")).get("history"))

    def test_a_monorepo_member_records_when_run_from_its_folder(self):
        web = self.member("apps/web", "001-a")
        self.point(web, "001-a")
        self.write(web, "--step", "specify", "--status", "specifying", "--kind", "start")
        self.assertTrue(self.recorded(web / "specs" / "001-a"))

    def test_specify_init_dir_names_the_project_from_anywhere(self):
        web = self.member("apps/web", "001-a")
        self.point(web, "001-a")
        self.write(self.repo, "--step", "specify", "--status", "specifying", "--kind", "start",
                   env={"SPECIFY_INIT_DIR": str(web)})
        self.assertTrue(self.recorded(web / "specs" / "001-a"))

    def test_an_init_dir_without_specify_records_nothing_and_says_why(self):
        web = self.member("apps/web", "001-a")
        self.point(web, "001-a")
        empty = self.repo / "nothing"
        empty.mkdir()
        run = self.write(web, "--step", "specify", "--status", "specifying", "--kind", "start",
                         env={"SPECIFY_INIT_DIR": str(empty)})
        self.assertEqual(run.returncode, 0)
        self.assertIn("SPECIFY_INIT_DIR", run.stderr)
        self.assertFalse(self.recorded(web / "specs" / "001-a"))

    def test_a_bad_init_dir_records_nothing_even_when_a_label_matches(self):
        stray = self.repo / "stray"
        (stray / "specs" / "001-a").mkdir(parents=True)
        self.write(self.repo, "--step", "specify", "--status", "specifying", "--kind", "start",
                   env={"SPECIFY_INIT_DIR": str(stray), "SPECIFY_FEATURE": "001-a"})
        self.assertFalse(self.recorded(stray / "specs" / "001-a"))

    def test_the_walk_stops_at_the_repository_top(self):
        outer = Path(self._tmp.name).resolve() / "outer"
        (outer / ".specify").mkdir(parents=True)
        (outer / "specs" / "001-a").mkdir(parents=True)
        (outer / ".specify" / "feature.json").write_text(json.dumps({"feature_directory": "specs/001-a"}), encoding="utf-8")
        inner = outer / "repo"
        inner.mkdir()
        subprocess.run(["git", "init", "-q"], cwd=inner, check=True)
        self.write(inner, "--step", "specify", "--status", "specifying", "--kind", "start")
        self.assertFalse(self.recorded(outer / "specs" / "001-a"))

    def test_the_pointer_outranks_the_feature_label(self):
        web = self.member("apps/web", "001-a", "002-b")
        self.point(web, "002-b")
        run = self.write(web, "--step", "specify", "--status", "specifying", "--kind", "start",
                         env={"SPECIFY_FEATURE": "001-a"})
        self.assertTrue(self.recorded(web / "specs" / "002-b"))
        self.assertFalse(self.recorded(web / "specs" / "001-a"))
        self.assertNotIn("SPECIFY_FEATURE=", run.stderr)

    def test_the_label_is_used_without_a_pointer_and_says_so(self):
        web = self.member("apps/web", "001-a", "002-b")
        run = self.write(web, "--step", "specify", "--status", "specifying", "--kind", "start",
                         env={"SPECIFY_FEATURE": "001-a"})
        self.assertTrue(self.recorded(web / "specs" / "001-a"))
        self.assertEqual(run.stderr.count("SPECIFY_FEATURE=001-a"), 1)

    def test_an_explicit_feature_dir_wins_over_label_and_pointer(self):
        web = self.member("apps/web", "001-a", "002-b", "003-c")
        self.point(web, "002-b")
        self.write(web, "--feature-dir", str(web / "specs" / "003-c"), "--step", "specify",
                   "--status", "specifying", "--kind", "start", env={"SPECIFY_FEATURE": "001-a"})
        self.assertTrue(self.recorded(web / "specs" / "003-c"))


if __name__ == "__main__":
    unittest.main()
