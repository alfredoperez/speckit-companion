"""Closing the plan step records the plan-block check itself, so no prose has to remember to."""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
WRITER = SCRIPTS / "write-context.py"
sys.path.insert(0, str(SCRIPTS))

GOOD = "## Call paths\n\n```calls Greeting\n  greet() @ src/app.py:1\n```\n"
BAD = "## Call paths\n\n```calls Greeting\n  greet() @ src/missing.py:1\n```\n"


class ClosingThePlanStep(unittest.TestCase):
    def setUp(self):
        self.repo = Path(tempfile.mkdtemp(prefix="plan-close-"))
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)
        (self.repo / "src").mkdir()
        (self.repo / "src" / "app.py").write_text("def greet():\n    return 1\n", encoding="utf-8")
        self.fd = self.repo / "specs" / "001-x"
        self.fd.mkdir(parents=True)

    def tearDown(self):
        shutil.rmtree(self.repo, ignore_errors=True)

    def _plan(self, text):
        (self.fd / "plan.md").write_text(text, encoding="utf-8")

    def _run(self, *flags):
        return subprocess.run(
            [sys.executable, str(WRITER), "--feature-dir", str(self.fd), "--by", "ai", *flags],
            capture_output=True, text=True, cwd=self.repo)

    def _ctx(self):
        return json.loads((self.fd / ".spec-context.json").read_text(encoding="utf-8"))

    def _checks(self):
        return [v for v in self._ctx().get("verified", []) if v["what"] == "plan blocks check out"]

    def test_a_valid_block_is_recorded_with_exit_zero(self):
        self._plan(GOOD)
        self._run("--step", "plan", "--advance")
        (entry,) = self._checks()
        self.assertEqual(entry["exitCode"], 0)
        self.assertEqual(entry["source"], "derived")
        self.assertIn("check_plan.py", entry["command"])
        self.assertIn("--strict", entry["command"])
        self.assertIn("checks out", entry["result"])
        self.assertEqual(set(entry), {"what", "command", "source", "exitCode", "durationSeconds", "result"})

    def test_each_close_path_records_it(self):
        for flags in (["--step", "plan", "--kind", "complete", "--status", "planned"],
                      ["--step", "plan", "--finish"]):
            with self.subTest(flags=flags):
                (self.fd / ".spec-context.json").unlink(missing_ok=True)
                self._plan(GOOD)
                self._run(*flags)
                self.assertEqual(len(self._checks()), 1)

    def test_a_broken_block_records_exit_one_and_still_closes(self):
        self._plan(BAD)
        out = self._run("--step", "plan", "--advance")
        (entry,) = self._checks()
        self.assertEqual(entry["exitCode"], 1)
        self.assertIn("Plan blocks: 1 error(s)", out.stderr)
        log = self._ctx()["history"]
        self.assertTrue(any(h["step"] == "plan" and h["kind"] == "complete" for h in log))

    def test_a_plan_with_no_block_writes_nothing(self):
        self._plan("# Plan\n\nNothing to see.\n")
        self._run("--step", "plan", "--advance")
        self.assertEqual(self._checks(), [])

    def test_a_substep_finish_writes_nothing(self):
        self._plan(GOOD)
        self._run("--step", "plan", "--substep", "research", "--finish")
        self.assertEqual(self._checks(), [])

    def test_another_step_writes_nothing(self):
        self._plan(GOOD)
        self._run("--step", "tasks", "--advance")
        self.assertEqual(self._checks(), [])

    def test_closing_twice_keeps_the_latest_result(self):
        self._plan(BAD)
        self._run("--step", "plan", "--advance")
        self._plan(GOOD)
        self._run("--step", "plan", "--advance")
        (entry,) = self._checks()
        self.assertEqual(entry["exitCode"], 0)

    def test_a_failing_check_does_not_stop_the_close(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("write_context_under_test", WRITER)
        wc = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(wc)
        self._plan(GOOD)
        with mock.patch.object(wc, "record_plan_check", side_effect=RuntimeError("boom")), \
                mock.patch.object(sys, "argv", ["write-context.py", "--feature-dir", str(self.fd),
                                                "--step", "plan", "--advance", "--by", "ai"]):
            self.assertEqual(wc._main(), 0)
        self.assertEqual(self._checks(), [])
        self.assertTrue(any(h["step"] == "plan" and h["kind"] == "complete" for h in self._ctx()["history"]))


if __name__ == "__main__":
    unittest.main()
