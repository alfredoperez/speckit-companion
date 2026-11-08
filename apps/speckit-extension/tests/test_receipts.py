"""The pull request's Receipts section is built from the run record, not typed."""
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECEIPTS = ROOT / "scripts" / "receipts.py"
WRITER = ROOT / "scripts" / "write-context.py"


class Receipts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.git("init", "-q")
        self.git("config", "user.email", "t@example.com")
        self.git("config", "user.name", "t")
        (self.root / "app.ts").write_text("one\n", encoding="utf-8")
        self.git("add", "app.ts")
        self.git("commit", "-qm", "first")
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        subprocess.run(["git", "-C", str(self.root), *args], check=True, capture_output=True)

    def write(self, *args):
        result = subprocess.run([sys.executable, str(WRITER), "--feature-dir", str(self.spec), *args],
                                cwd=self.root, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def receipts(self):
        result = subprocess.run([sys.executable, str(RECEIPTS), "--feature-dir", str(self.spec)],
                                cwd=self.root, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout

    def row(self, text, what):
        return next(line for line in text.splitlines() if line.startswith(f"| {what} |"))

    def test_a_run_check_shows_its_command_and_exit_code(self):
        self.write("--verify-run", "Unit tests::true")
        out = self.receipts()
        self.assertIn("## Receipts", out)
        self.assertIn("Recorded by the run, not typed by the agent, except where marked.", out)
        self.assertRegex(self.row(out, "Unit tests"), r"\| `true` \| exit 0 · [0-9.]+ s \|")

    def test_a_claimed_check_is_labelled(self):
        self.write("--verified", '{"what": "Empty state by hand", "result": "looked fine"}')
        self.assertIn("claimed by the agent, not run", self.row(self.receipts(), "Empty state by hand"))

    def test_a_check_goes_out_of_date_when_code_changes_and_not_for_spec_edits(self):
        self.write("--verify-run", "Unit tests::true")
        (self.spec / "notes.md").write_text("spec edit\n", encoding="utf-8")
        self.assertNotIn("out of date", self.row(self.receipts(), "Unit tests"))
        (self.root / "app.ts").write_text("two\n", encoding="utf-8")
        self.assertRegex(self.row(self.receipts(), "Unit tests"), r"exit 0 at [0-9a-f]+ · out of date")

    def test_mutation_review_depth_and_assumptions_are_listed(self):
        self.write("--coverage-req", "FR-004", "--tests", "a.test.ts")
        self.write("--assumes", "FR-005", "relies on the orders index")
        self.write("--risk")
        self.write("--risk-raise", "high", "touches the orders query")
        fixture = ROOT / "tests" / "fixtures" / "mutation" / "mutmut-cicd-stats.json"
        self.write("--mutation-report", str(fixture))
        out = self.receipts()
        self.assertIn("8 of 10 caught", self.row(out, "Mutation check"))
        self.assertIn('**Review depth:** high, raised by the agent: "touches the orders query"', out)
        self.assertIn("**Assumed, not tested:** FR-005 relies on the orders index.", out)

    def test_table_breaking_characters_are_escaped(self):
        self.write("--verified", '{"what": "Pipes | and\\nbreaks", "command": "a | b", "result": "ok"}')
        line = next(l for l in self.receipts().splitlines() if l.startswith("| Pipes"))
        self.assertIn("Pipes \\| and breaks", line)
        self.assertIn("`a \\| b`", line)
        self.assertEqual(len(re.findall(r"(?<!\\)\|", line)), 4)

    def test_a_backslash_before_a_pipe_does_not_split_the_cell(self):
        self.write("--verified", '{"what": "a\\\\|b", "command": "x\\\\|y", "result": "ok"}')
        line = next(l for l in self.receipts().splitlines() if l.startswith("| a"))
        cells, escaped = 0, False
        for ch in line:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == "|":
                cells += 1
        self.assertEqual(cells, 4)

    def test_a_tested_requirement_is_not_listed_as_untested(self):
        self.write("--coverage-req", "FR-001", "--tests", "a.test.ts")
        self.write("--assumes", "FR-001", "uses the index")
        self.assertNotIn("Assumed, not tested", self.receipts())

    def test_missing_arguments_still_exit_zero(self):
        result = subprocess.run([sys.executable, str(RECEIPTS)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)

    def test_a_check_whose_tree_is_gone_says_freshness_unknown(self):
        self.write("--verify-run", "Unit tests::true")
        ctx_path = self.spec / ".spec-context.json"
        ctx = json.loads(ctx_path.read_text(encoding="utf-8"))
        ctx["verified"][0]["tree"] = "0" * 40
        ctx_path.write_text(json.dumps(ctx), encoding="utf-8")
        self.assertIn("freshness unknown", self.row(self.receipts(), "Unit tests"))

    def test_a_raise_the_computed_tier_caught_up_with_is_not_shown(self):
        (self.spec / ".spec-context.json").write_text(json.dumps({"risk": {
            "tier": "high", "computed": "high", "reasons": ["touches the writer"],
            "raised": {"tier": "normal", "reason": "touches auth", "by": "ai"}}}), encoding="utf-8")
        out = self.receipts()
        self.assertIn("**Review depth:** high (touches the writer)", out)
        self.assertNotIn("raised by", out)

    def test_mentions_do_not_notify_and_a_string_verified_is_ignored(self):
        self.write("--verified", '{"what": "cc @someone", "result": "ok"}')
        self.assertNotRegex(self.receipts(), r"@someone")
        (self.spec / ".spec-context.json").write_text(json.dumps({"verified": "abc"}), encoding="utf-8")
        self.assertIn("No checks were recorded.", self.receipts())

    def test_the_lead_flags_uncommitted_code_but_not_spec_edits(self):
        self.write("--verify-run", "Unit tests::true")
        self.assertRegex(self.receipts(), r"Code at `[0-9a-f]+`\.")
        (self.root / "app.ts").write_text("two\n", encoding="utf-8")
        self.assertIn("plus uncommitted changes.", self.receipts())

    def test_an_empty_record_says_so_and_succeeds(self):
        self.assertIn("No checks were recorded.", self.receipts())


if __name__ == "__main__":
    unittest.main()
