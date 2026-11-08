"""A mutation report marks weak each requirement whose tests caught no planted bug."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WRITER = ROOT / "scripts" / "write-context.py"
FIXTURES = ROOT / "tests" / "fixtures" / "mutation"


class MutationReport(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)
        self.write("--coverage-req", "FR-001", "--tests", "src/__tests__/save.test.ts::saves a filter")
        self.write("--coverage-req", "FR-002", "--tests", "./src/__tests__/unique.test.ts")
        self.write("--coverage-req", "FR-003", "--tests", "tests/test_api.py")

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, *args):
        result = subprocess.run([sys.executable, str(WRITER), "--feature-dir", str(self.spec), *args],
                                cwd=self.root, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout + result.stderr

    def ctx(self):
        return json.loads((self.spec / ".spec-context.json").read_text(encoding="utf-8"))

    def row(self):
        return [v for v in self.ctx().get("verified", []) if v["what"] == "Mutation check"]

    def test_stryker_marks_only_the_requirement_whose_tests_killed_nothing(self):
        out = self.write("--mutation-report", str(FIXTURES / "stryker.json"))
        coverage = self.ctx()["coverage"]
        self.assertNotIn("weak", coverage["FR-001"])
        self.assertTrue(coverage["FR-002"]["weak"])
        self.assertNotIn("weak", coverage["FR-003"])
        self.assertIn("2 of 4 caught", out)
        self.assertEqual(self.row()[0]["result"], "2 of 4 caught")
        self.assertEqual(self.row()[0]["warnings"], ["weak: FR-002"])

    def test_a_report_that_cannot_judge_keeps_earlier_marks(self):
        self.write("--mutation-report", str(FIXTURES / "stryker.json"))
        self.write("--mutation-report", str(FIXTURES / "mutmut-cicd-stats.json"))
        self.assertTrue(self.ctx()["coverage"]["FR-002"]["weak"])

    def test_a_report_without_test_attribution_marks_nothing(self):
        report = json.loads((FIXTURES / "stryker.json").read_text(encoding="utf-8"))
        del report["testFiles"]
        path = self.root / "bare.json"
        path.write_text(json.dumps(report), encoding="utf-8")
        self.write("--mutation-report", str(path))
        self.assertFalse(any(e.get("weak") for e in self.ctx()["coverage"].values()))
        self.assertEqual(self.row()[0]["result"], "2 of 4 caught")

    def test_a_test_no_mutant_faced_is_not_judged(self):
        report = json.loads((FIXTURES / "stryker.json").read_text(encoding="utf-8"))
        report["files"]["src/filters.ts"]["mutants"][1].pop("coveredBy")
        path = self.root / "uncovered.json"
        path.write_text(json.dumps(report), encoding="utf-8")
        self.write("--mutation-report", str(path))
        self.assertNotIn("weak", self.ctx()["coverage"]["FR-002"])

    def test_a_json_file_that_is_not_a_report_declines(self):
        path = self.root / "other.json"
        path.write_text(json.dumps({"files": {}}), encoding="utf-8")
        self.assertIn("was not read", self.write("--mutation-report", str(path)))

    def test_mutmut_without_a_total_counts_every_outcome(self):
        stats = json.loads((FIXTURES / "mutmut-cicd-stats.json").read_text(encoding="utf-8"))
        del stats["total"]
        path = self.root / "stats.json"
        path.write_text(json.dumps(stats), encoding="utf-8")
        self.write("--mutation-report", str(path))
        self.assertEqual(self.row()[0]["result"], "8 of 11 caught")

    def test_keys_relative_to_a_subpackage_still_match(self):
        report = json.loads((FIXTURES / "stryker.json").read_text(encoding="utf-8"))
        report["testFiles"] = {"__tests__/save.test.ts": report["testFiles"]["src/__tests__/save.test.ts"],
                               "__tests__/unique.test.ts": report["testFiles"]["src/__tests__/unique.test.ts"]}
        path = self.root / "sub.json"
        path.write_text(json.dumps(report), encoding="utf-8")
        self.write("--mutation-report", str(path))
        self.assertTrue(self.ctx()["coverage"]["FR-002"]["weak"])

    def test_a_report_of_the_wrong_shape_or_no_mutants_declines(self):
        report = json.loads((FIXTURES / "stryker.json").read_text(encoding="utf-8"))
        report["testFiles"] = ["not", "a", "map"]
        path = self.root / "shape.json"
        path.write_text(json.dumps(report), encoding="utf-8")
        self.assertIn("was not read", self.write("--mutation-report", str(path)))
        empty = self.root / "empty.json"
        empty.write_text(json.dumps({"schemaVersion": "2", "files": {}}), encoding="utf-8")
        self.assertIn("no mutants", self.write("--mutation-report", str(empty)))

    def test_new_tests_clear_a_stale_weak_mark(self):
        self.write("--mutation-report", str(FIXTURES / "stryker.json"))
        self.write("--coverage-req", "FR-002", "--tests", "src/__tests__/unique-v2.test.ts")
        self.assertNotIn("weak", self.ctx()["coverage"]["FR-002"])

    def test_mutmut_records_the_count_without_marks(self):
        self.write("--mutation-report", str(FIXTURES / "mutmut-cicd-stats.json"))
        self.assertEqual(self.row()[0]["result"], "8 of 10 caught")
        self.assertEqual(self.row()[0]["command"], "mutmut")
        self.assertFalse(any(e.get("weak") for e in self.ctx()["coverage"].values()))

    def test_a_newer_report_clears_marks_and_replaces_the_row(self):
        self.write("--mutation-report", str(FIXTURES / "stryker.json"))
        report = json.loads((FIXTURES / "stryker.json").read_text(encoding="utf-8"))
        report["files"]["src/filters.ts"]["mutants"][1].update(status="Killed", killedBy=["t2"])
        path = self.root / "newer.json"
        path.write_text(json.dumps(report), encoding="utf-8")
        self.write("--mutation-report", str(path))
        self.assertNotIn("weak", self.ctx()["coverage"]["FR-002"])
        self.assertEqual(len(self.row()), 1)
        self.assertEqual(self.row()[0]["result"], "3 of 4 caught")

    def test_an_unreadable_report_declines_without_failing(self):
        bad = self.root / "bad.json"
        bad.write_text("not json", encoding="utf-8")
        self.assertIn("was not read", self.write("--mutation-report", str(bad)))
        self.assertIn("was not read", self.write("--mutation-report", str(self.root / "missing.json")))
        self.assertEqual(self.row(), [])


if __name__ == "__main__":
    unittest.main()
