"""Implement records the ways a change lowered the bar, through the check-recording call it already makes."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WRITER = ROOT / "scripts" / "write-context.py"
RECEIPTS = ROOT / "scripts" / "receipts.py"
sys.path.insert(0, str(ROOT / "scripts"))
import lowered_bar  # noqa: E402

# Built from pieces so this file does not trip the scan it tests.
SKIP = "it." + "skip"
ESLINT = "eslint-" + "disable-next-line"
TS_IGNORE = "@ts-" + "ignore"


class LoweredBar(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.git("init", "-q")
        self.git("config", "user.email", "t@example.com")
        self.git("config", "user.name", "t")
        self.put("app.ts", "export const one = 1;\n")
        self.put("jest.config.js", "module.exports = { coverageThreshold: { global: { lines: 90 } } };\n")
        self.git("add", "-A")
        self.git("commit", "-qm", "first")
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        subprocess.run(["git", "-C", str(self.root), *args], check=True, capture_output=True)

    def put(self, name, text):
        (self.root / name).write_text(text, encoding="utf-8")

    def record_checks(self, command="true"):
        result = subprocess.run([sys.executable, str(WRITER), "--feature-dir", str(self.spec),
                                 "--verify-run", f"Unit tests::{command}"],
                                cwd=self.root, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def concerns(self):
        return json.loads((self.spec / ".spec-context.json").read_text()).get("concerns") or []

    def notes(self):
        return [c["note"] for c in self.concerns()]

    def test_an_added_skip_ends_with_a_concern_naming_file_and_line(self):
        self.put("app.test.ts", f"import {{ one }} from './app';\n\n\n{SKIP}('adds', () => {{}});\n")
        self.record_checks()
        self.assertEqual(self.notes(), ["Lowered the bar: skipped test at `app.test.ts:4`, no reason given"])

    def test_a_clean_change_adds_no_concern(self):
        self.put("app.ts", "export const one = 1;\nexport function two() { return 2; }\nconst skipWhitespace = (s) => s.trim();\n")
        self.record_checks()
        self.assertEqual(self.concerns(), [])

    def test_a_reason_on_the_line_is_recorded_as_reasoned(self):
        self.put("app.ts", f"// {ESLINT} no-console -- CLI output\nconsole.log(1);\n// {TS_IGNORE}\nlet x: number = 'a';\n")
        self.record_checks()
        self.assertEqual(self.notes(), [
            "Lowered the bar: lint rule disabled at `app.ts:1`, reasoned: CLI output",
            "Lowered the bar: type check suppressed at `app.ts:3`, no reason given",
        ])

    def test_a_lowered_coverage_threshold_and_an_empty_stub_are_found(self):
        self.put("jest.config.js", "module.exports = { coverageThreshold: { global: { lines: 70 } } };\n")
        self.put("app.ts", "export const one = 1;\nexport function handle(event) {}\n")
        self.record_checks()
        self.assertEqual(self.notes(), [
            "Lowered the bar: empty function stub at `app.ts:2`, no reason given",
            "Lowered the bar: coverage threshold lowered (lines 90 to 70) at `jest.config.js:1`, no reason given",
        ])

    def test_implement_still_records_its_checks_on_a_hit(self):
        self.put("app.test.ts", f"{SKIP}('adds', () => {{}});\n")
        self.record_checks("exit 0")
        verified = json.loads((self.spec / ".spec-context.json").read_text())["verified"]
        self.assertEqual(verified[0]["exitCode"], 0)

    def test_a_later_scan_replaces_the_earlier_one_and_keeps_other_concerns(self):
        subprocess.run([sys.executable, str(WRITER), "--feature-dir", str(self.spec), "--concern",
                        '{"note": "Could not run the e2e suite"}'], cwd=self.root, check=True, capture_output=True)
        self.put("app.test.ts", f"{SKIP}('adds', () => {{}});\n")
        self.record_checks()
        self.put("app.test.ts", "it('adds', () => { expect(1).toBe(1); });\n")
        self.record_checks()
        self.assertEqual(self.notes(), ["Could not run the e2e suite"])

    def test_spec_folders_and_markdown_are_not_scanned(self):
        (self.spec / "notes.ts").write_text(f"{SKIP}('x', () => {{}});\n", encoding="utf-8")
        self.put("README.md", f"Use `{SKIP}(` sparingly.\n")
        self.record_checks()
        self.assertEqual(self.concerns(), [])

    def test_the_receipts_list_the_hits(self):
        self.put("app.test.ts", f"{SKIP}('adds', () => {{}});\n")
        self.record_checks()
        out = subprocess.run([sys.executable, str(RECEIPTS), "--feature-dir", str(self.spec)],
                             cwd=self.root, capture_output=True, text=True).stdout
        self.assertIn("**Lowered the bar:** skipped test at `app.test.ts:1`, no reason given.", out)

    def test_a_scan_that_cannot_run_keeps_the_last_scan(self):
        self.put("app.test.ts", f"{SKIP}('adds', () => {{}});\n")
        self.record_checks()
        (self.root / ".git").rename(self.root / ".git-away")
        result = subprocess.run([sys.executable, str(WRITER), "--feature-dir", str(self.spec),
                                 "--verify-run", "Unit tests::true"], cwd=self.root, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertNotIn("Lowered-bar", result.stderr)
        self.assertEqual(len(self.notes()), 1)

    def test_reasons_in_the_marker_count_and_plain_code_is_not_coverage(self):
        self.put("app.ts", f"export const max = {{ lines: 10 }};\n// {TS_IGNORE}: legacy typing\nlet x: number = 'a';\n")
        self.git("add", "-A")
        self.git("commit", "-qm", "second")
        self.put("app.ts", f"export const max = {{ lines: 5 }};\n// {TS_IGNORE}: legacy typing\nlet x: number = 'a';\n")
        self.put("a_test.py", "import pytest\n\n@pytest.mark." + "skip(reason='flaky upstream')\ndef test_a():\n    assert True\n")
        self.record_checks()
        self.assertEqual(self.notes(), ["Lowered the bar: skipped test at `a_test.py:3`, reasoned: flaky upstream"])

    def test_hits_past_the_cap_are_counted_not_listed(self):
        hits = [{"file": "a.ts", "line": n, "kind": "skipped test", "reason": None} for n in range(25)]
        out = lowered_bar.concerns(hits)
        self.assertEqual(len(out), lowered_bar.LIMIT + 1)
        self.assertEqual(out[-1]["note"], "Lowered the bar: 5 more hit(s) not listed")


if __name__ == "__main__":
    unittest.main()
