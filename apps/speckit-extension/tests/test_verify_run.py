"""A verification the script ran, rather than one the agent described.

Everything in `verified[]` was a sentence an agent typed — including the command, which was
a string it wrote rather than evidence anything ran — and the Overview drew a checkmark
beside all of it. This runs the command and records the exit code, which is the part nobody
can talk their way past.
"""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
_spec = importlib.util.spec_from_file_location("capture", SCRIPTS / "capture.py")
capture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(capture)


class RunningAVerification(unittest.TestCase):
    def test_a_passing_command_is_recorded_as_derived(self):
        v = capture.run_verification("Echo works", "echo hello")
        self.assertEqual(v["source"], "derived")
        self.assertEqual(v["exitCode"], 0)
        self.assertIn("hello", v["result"])
        self.assertNotIn("warnings", v)

    def test_a_failing_command_records_its_exit_code_rather_than_vanishing(self):
        # The failure is the finding. A run that could not prove its work should say so
        # where the reader looks, not omit the row and read as if nothing was checked.
        v = capture.run_verification("A failing check", "exit 3")
        self.assertEqual(v["exitCode"], 3)
        self.assertEqual(v["warnings"], ["exited 3"])

    def test_a_command_that_cannot_run_is_still_a_recorded_outcome(self):
        v = capture.run_verification("Missing tool", "this-command-does-not-exist-anywhere")
        self.assertEqual(v["source"], "derived")
        self.assertNotEqual(v["exitCode"], 0)

    def test_output_is_kept_as_a_tail_not_a_log(self):
        v = capture.run_verification("Chatty", "for i in $(seq 1 200); do echo line $i; done")
        self.assertLessEqual(len(v["result"]), 300)
        self.assertIn("line 200", v["result"])

    def test_it_times_out_rather_than_hanging_the_run(self):
        v = capture.run_verification("Hangs", "sleep 30", timeout=1)
        self.assertEqual(v["exitCode"], 124)
        self.assertIn("timed out", v["result"])


class AppendingThem(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="verify-run-")
        self.fd = Path(self.tmp) / "specs" / "001-a"
        self.fd.mkdir(parents=True)
        (self.fd / ".spec-context.json").write_text("{}", encoding="utf-8")

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _verified(self) -> list:
        return json.loads((self.fd / ".spec-context.json").read_text()).get("verified") or []

    def test_each_spec_runs_and_lands(self):
        target, skipped = capture.append_verification_runs(
            self.fd, ["Echo::echo hi", "Fails::exit 1"])
        self.assertIsNotNone(target)
        self.assertEqual(skipped, [])
        self.assertEqual([v["what"] for v in self._verified()], ["Echo", "Fails"])

    def test_a_check_run_again_reports_its_latest_result(self):
        capture.append_verification_runs(self.fd, ["Same::exit 1", "Other::echo hi"])
        capture.append_verification_runs(self.fd, ["Same::echo fixed"])
        verified = self._verified()
        self.assertEqual([v["what"] for v in verified], ["Same", "Other"])
        self.assertEqual(verified[0]["exitCode"], 0)

    def test_a_spec_without_a_command_is_skipped_and_named(self):
        target, skipped = capture.append_verification_runs(self.fd, ["no separator here"])
        self.assertIsNone(target)
        self.assertEqual(skipped, ["no separator here"])
        self.assertEqual(self._verified(), [])

    def test_a_command_containing_colons_survives(self):
        # `::` splits once, so a command with its own colons is not mangled.
        capture.append_verification_runs(self.fd, ["Ratio::echo 1:2:3"])
        self.assertIn("1:2:3", self._verified()[0]["result"])

    def test_re_running_the_same_check_does_not_duplicate_it(self):
        capture.append_verification_runs(self.fd, ["Echo::echo hi"])
        capture.append_verification_runs(self.fd, ["Echo::echo hi"])
        self.assertEqual(len(self._verified()), 1)


class TheCodeACheckRanOn(unittest.TestCase):
    def setUp(self):
        import subprocess
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.git = lambda *a: subprocess.run(["git", "-C", str(self.root), *a], capture_output=True, text=True, check=True).stdout.strip()
        self.git("init", "-q")
        self.git("config", "user.email", "t@example.com")
        self.git("config", "user.name", "t")
        (self.root / "a.txt").write_text("one\n", encoding="utf-8")
        self.git("add", "a.txt")
        self.git("commit", "-qm", "first")
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)

    def tearDown(self):
        self.tmp.cleanup()

    def test_records_the_commit_and_a_tree_holding_uncommitted_work(self):
        (self.root / "b.txt").write_text("new\n", encoding="utf-8")
        staged_before = self.git("diff", "--cached", "--name-only")
        v = capture.run_verification("Echo", "echo ok", at=self.spec)
        self.assertEqual(v["commit"], self.git("rev-parse", "--short", "HEAD"))
        self.assertIn("b.txt", self.git("ls-tree", "-r", "--name-only", v["tree"]).splitlines())
        self.assertEqual(self.git("diff", "--cached", "--name-only"), staged_before)

    def test_outside_git_the_check_is_recorded_without_either(self):
        with tempfile.TemporaryDirectory() as plain:
            v = capture.run_verification("Echo", "echo ok", at=Path(plain))
        self.assertEqual(v["exitCode"], 0)
        self.assertNotIn("commit", v)
        self.assertNotIn("tree", v)

    def test_a_check_with_no_location_records_neither(self):
        v = capture.run_verification("Echo", "echo ok")
        self.assertNotIn("commit", v)


if __name__ == "__main__":
    unittest.main()
