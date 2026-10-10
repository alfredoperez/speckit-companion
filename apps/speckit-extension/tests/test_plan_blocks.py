#!/usr/bin/env python3
"""Tests for the plan step's block picker (plan-blocks.py)."""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parents[1]
SCRIPT = EXT / "scripts" / "plan-blocks.py"
PARTS = EXT / "presets" / "_parts"
CHECK = "check_plan.py --feature-dir <feature_directory>"
LINK = "end that state's line with `shows <screen-name>`"


def part(name):
    return (PARTS / f"{name}.md").read_text(encoding="utf-8").strip()


class ThePicker(unittest.TestCase):
    def setUp(self):
        self.repo = Path(tempfile.mkdtemp(prefix="plan-blocks-"))
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)
        self.fd = self.repo / "specs" / "001-x"
        self.fd.mkdir(parents=True)
        (self.fd / ".spec-context.json").write_text("{}", encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.repo, ignore_errors=True)

    def run_it(self, *names, feature="specs/001-x"):
        return subprocess.run([sys.executable, str(SCRIPT), "--feature-dir", feature, *names],
                              capture_output=True, text=True, cwd=self.repo)

    def recorded(self):
        return json.loads((self.fd / ".spec-context.json").read_text(encoding="utf-8")).get("planBlocks")

    def test_only_the_chosen_grammars_print_in_a_fixed_order(self):
        out = self.run_it("screens", "calls").stdout
        self.assertIn(part("call-paths"), out)
        self.assertIn(part("screens"), out)
        self.assertLess(out.index(part("call-paths")), out.index(part("screens")))
        self.assertNotIn(part("states"), out)
        self.assertNotIn(part("code-pins"), out)

    def test_none_prints_one_short_line_and_records_an_empty_list(self):
        done = self.run_it("none")
        self.assertEqual(len(done.stdout.strip().splitlines()), 1)
        self.assertNotIn("check_plan.py", done.stdout)
        self.assertEqual(self.recorded(), [])

    def test_a_bad_call_exits_2_and_prints_nothing(self):
        for names in (("bogus",), ("none", "calls"), ()):
            with self.subTest(names=names):
                done = self.run_it(*names)
                self.assertEqual((done.returncode, done.stdout), (2, ""))
                self.assertIn("calls, code, states, screens, none", done.stderr)
        self.assertIsNone(self.recorded())

    def test_the_link_line_needs_both_states_and_screens(self):
        both = self.run_it("states", "screens").stdout
        self.assertEqual(both.count(LINK), 1)
        self.assertLess(both.index(LINK), both.index(part("states")))
        self.assertLess(both.index(LINK), both.index(part("screens")))
        self.assertIn("shows reviewer", both)
        self.assertNotIn(LINK, self.run_it("states").stdout)
        self.assertNotIn(LINK, self.run_it("screens").stdout)

    def test_the_check_prints_once(self):
        self.assertEqual(self.run_it("calls", "code", "states", "screens").stdout.count(CHECK), 1)

    def test_the_choice_is_recorded_and_replaced(self):
        self.run_it("calls", "states", "screens")
        self.assertEqual(self.recorded(), ["calls", "states", "screens"])
        self.run_it("code")
        self.assertEqual(self.recorded(), ["code"])

    def test_a_project_copy_of_a_part_wins(self):
        nodes = self.repo / ".specify" / "companion" / "nodes"
        nodes.mkdir(parents=True)
        (nodes / "states.md").write_text("## Mine\n\nProject grammar.\n", encoding="utf-8")
        out = self.run_it("states").stdout
        self.assertIn("Project grammar.", out)
        self.assertNotIn(part("states"), out)

    def test_an_unresolvable_spec_still_prints(self):
        done = self.run_it("calls", feature="specs/missing")
        self.assertEqual(done.returncode, 0)
        self.assertIn(part("call-paths"), done.stdout)
        self.assertEqual(done.stderr.count("[companion] Warning:"), 1)


if __name__ == "__main__":
    unittest.main()
