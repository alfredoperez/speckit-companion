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


CHECKER = SCRIPTS / "check_plan.py"
PLAN_CODE = GOOD + "\n```ts src/app.py:1-2\ndef greet():\n    return 1\n```\n"


class RunningTheChecker(unittest.TestCase):
    setUp = ClosingThePlanStep.setUp
    tearDown = ClosingThePlanStep.tearDown
    _plan = ClosingThePlanStep._plan
    _run = ClosingThePlanStep._run
    _ctx = ClosingThePlanStep._ctx
    _checks = ClosingThePlanStep._checks

    def _check(self, *flags):
        return subprocess.run([sys.executable, str(CHECKER), "--feature-dir", str(self.fd), *flags],
                              capture_output=True, text=True, cwd=self.repo)

    def _seed(self, **fields):
        (self.fd / ".spec-context.json").write_text(json.dumps(fields), encoding="utf-8")

    def test_a_stale_failed_record_becomes_passed(self):
        self._plan(BAD)
        self._run("--step", "plan", "--advance")
        self.assertEqual(self._checks()[0]["exitCode"], 1)
        self._plan(GOOD)
        self._check()
        (entry,) = self._checks()
        self.assertEqual(entry["exitCode"], 0)
        self._run("--step", "plan", "--finish")
        self.assertEqual(len(self._checks()), 1)

    def test_no_record_and_plan_write_nothing(self):
        self._plan(GOOD)
        self._check("--no-record")
        self._check("--plan", str(self.fd / "plan.md"))
        self.assertFalse((self.fd / ".spec-context.json").exists())

    def test_a_plan_with_no_block_writes_nothing(self):
        self._plan("# Plan\n")
        self._check()
        self.assertFalse((self.fd / ".spec-context.json").exists())

    def test_plan_blocks_follow_the_plan_and_the_pick_is_kept(self):
        self._seed(planBlocks=["calls", "code", "states"], planBlocksPicked=["calls", "code", "states"])
        self._plan(GOOD)
        out = self._check()
        ctx = self._ctx()
        self.assertEqual((ctx["planBlocks"], ctx["planBlocksPicked"]), (["calls"], ["calls", "code", "states"]))
        self.assertIn("picked code but the plan has no code block", out.stderr)
        self.assertIn("picked states but the plan has no states block", self._checks()[0]["result"])
        self.assertEqual(out.returncode, 0)

    def test_a_block_that_was_not_picked_is_said(self):
        self._seed(planBlocks=["calls"], planBlocksPicked=["calls"])
        self._plan(PLAN_CODE)
        out = self._check()
        self.assertEqual(self._ctx()["planBlocks"], ["calls", "code"])
        self.assertIn("the plan has a code block that was not picked", out.stderr)

    def test_the_stock_path_sets_plan_blocks_and_says_nothing(self):
        self._plan(GOOD)
        out = self._check()
        ctx = self._ctx()
        self.assertEqual(ctx["planBlocks"], ["calls"])
        self.assertNotIn("planBlocksPicked", ctx)
        self.assertNotIn("picked", out.stderr)

    def test_no_block_but_a_pick_empties_plan_blocks(self):
        self._seed(planBlocks=["code"], planBlocksPicked=["code"])
        self._plan("# Plan\n")
        self._check()
        self.assertEqual(self._ctx()["planBlocks"], [])
        self.assertEqual(self._checks(), [])

    def test_a_recording_failure_changes_neither_exit_code_nor_stdout(self):
        self._plan(GOOD)
        import contextlib
        import io

        import capture
        import check_plan
        argv = ["--feature-dir", str(self.fd), "--strict"]
        runs = []
        for patched in (False, True):
            out, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err), \
                    mock.patch.object(capture, "record_plan_report", side_effect=RuntimeError("boom") if patched else capture.record_plan_report):
                runs.append((check_plan.main(argv + ["--no-record"] if not patched else argv), out.getvalue(), err.getvalue()))
        self.assertEqual(runs[0][:2], runs[1][:2])
        self.assertIn("[companion] Warning: could not record the plan check (boom)", runs[1][2])


if __name__ == "__main__":
    unittest.main()
