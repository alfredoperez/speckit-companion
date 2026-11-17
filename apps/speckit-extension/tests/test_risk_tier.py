"""The review depth follows a risk tier computed from the change, and the agent may only raise it."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

WRITER = Path(__file__).resolve().parents[1] / "scripts" / "write-context.py"


class RiskTier(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "t@example.com")
        self.git("config", "user.name", "t")
        self.touch("README.md")
        self.git("add", "README.md")
        self.git("commit", "-qm", "first")
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        subprocess.run(["git", "-C", str(self.root), *args], check=True, capture_output=True)

    def touch(self, rel, text="x\n"):
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def write(self, *args):
        result = subprocess.run([sys.executable, str(WRITER), "--feature-dir", str(self.spec), *args],
                                cwd=self.root, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout + result.stderr

    def risk(self):
        return json.loads((self.spec / ".spec-context.json").read_text(encoding="utf-8"))["risk"]

    def test_a_migration_is_high_and_named(self):
        self.touch("db/migrations/001_users.sql")
        self.write("--risk")
        self.assertEqual(self.risk()["tier"], "high")
        self.assertIn("db/migrations/001_users.sql", self.risk()["reasons"][0])

    def test_docs_and_tests_alone_are_low(self):
        self.touch("docs/guide.md")
        self.touch("src/__tests__/a.test.ts")
        self.write("--risk")
        self.assertEqual(self.risk()["tier"], "low")

    def test_ordinary_code_is_normal(self):
        self.touch("src/app.ts")
        self.write("--risk")
        self.assertEqual(self.risk()["tier"], "normal")

    def test_many_files_are_high(self):
        for i in range(21):
            self.touch(f"src/f{i}.ts")
        self.write("--risk")
        self.assertEqual(self.risk()["tier"], "high")

    def test_a_project_glob_makes_a_path_high(self):
        self.touch(".specify/companion.yml", 'risk:\n  high:\n    - "src/billing/**"\n')
        self.git("add", ".specify/companion.yml")
        self.git("commit", "-qm", "config")
        self.touch("src/billing/charge.ts")
        self.write("--risk")
        self.assertEqual(self.risk()["tier"], "high")

    def test_the_spec_folders_do_not_count_and_no_change_is_not_low(self):
        self.touch("specs/001-x/spec.md")
        self.touch(".specify/feature.json", "{}")
        self.write("--risk")
        self.assertEqual(self.risk()["tier"], "normal")
        self.assertIn("no changes", self.risk()["reasons"][0])

    def test_matching_ignores_case_and_catches_auth_files(self):
        self.touch("src/AuthService.ts")
        self.write("--risk")
        self.assertEqual(self.risk()["tier"], "high")

    def test_outside_git_it_is_normal_and_says_why(self):
        with tempfile.TemporaryDirectory() as plain:
            spec = Path(plain).resolve() / "specs" / "001-x"
            spec.mkdir(parents=True)
            result = subprocess.run([sys.executable, str(WRITER), "--feature-dir", str(spec), "--risk"],
                                    cwd=plain, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            risk = json.loads((spec / ".spec-context.json").read_text(encoding="utf-8"))["risk"]
        self.assertEqual(risk["tier"], "normal")
        self.assertIn("could not be read", risk["reasons"][0])

    def test_a_raise_is_kept_through_a_recompute(self):
        self.touch("src/app.ts")
        self.write("--risk")
        self.write("--risk-raise", "high", "touches the orders query")
        self.write("--risk")
        risk = self.risk()
        self.assertEqual((risk["tier"], risk["computed"]), ("high", "normal"))
        self.assertEqual(risk["raised"]["reason"], "touches the orders query")
        self.assertEqual(risk["raised"]["by"], "ai")

    def test_a_raise_survives_a_recompute_at_the_same_tier_and_then_a_lower_one(self):
        self.touch("src/app.ts")
        self.write("--risk")
        self.write("--risk-raise", "high", "touches the orders query")
        self.touch("db/migrations/002.sql")
        self.write("--risk")
        (self.root / "db" / "migrations" / "002.sql").unlink()
        self.write("--risk")
        risk = self.risk()
        self.assertEqual((risk["tier"], risk["computed"]), ("high", "normal"))
        self.assertEqual(risk["raised"]["reason"], "touches the orders query")

    def test_a_file_with_an_unusual_name_still_matches(self):
        self.touch("db/migrations/café.sql")
        self.write("--risk")
        self.assertEqual(self.risk()["tier"], "high")

    def test_a_lower_or_equal_tier_is_refused(self):
        self.touch("src/app.ts")
        self.write("--risk")
        self.assertIn("can only be raised", self.write("--risk-raise", "low", "small change"))
        self.assertIn("can only be raised", self.write("--risk-raise", "normal", "same"))
        self.assertEqual(self.risk()["tier"], "normal")

    def test_a_raise_needs_a_reason_and_a_real_tier(self):
        self.touch("src/app.ts")
        self.write("--risk")
        self.assertIn("needs a reason", self.write("--risk-raise", "high", "  "))
        self.assertIn("is not a tier", self.write("--risk-raise", "extreme", "why"))
        self.assertNotIn("raised", self.risk())


if __name__ == "__main__":
    unittest.main()
