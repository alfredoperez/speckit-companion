"""A converge that finds nothing completes an implemented spec, with no model call."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

WRITER = Path(__file__).resolve().parents[1] / "scripts" / "write-context.py"
OLD = 1_000_000_000


class ConvergeCompletes(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name).resolve()
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)
        (self.root / ".specify").mkdir()
        (self.root / ".specify" / "feature.json").write_text(
            json.dumps({"feature_directory": "specs/001-x"}), encoding="utf-8")
        self.tasks = self.spec / "tasks.md"

    def write(self, *args):
        subprocess.run([sys.executable, str(WRITER), *args], cwd=self.root,
                       capture_output=True, text=True, check=True)

    def implemented(self, *lines):
        self.tasks.write_text("".join(f"{line}\n" for line in lines), encoding="utf-8")
        os.utime(self.tasks, (OLD, OLD))
        self.write("--step", "implement", "--kind", "start", "--status", "implementing")
        self.write("--tasks-file", str(self.tasks), "--step", "implement")

    def status(self):
        ctx = json.loads((self.spec / ".spec-context.json").read_text(encoding="utf-8"))
        return ctx.get("status"), [h for h in ctx["history"] if h.get("step") == "implement" and h.get("kind") == "complete"]

    def test_a_clean_converge_completes_by_extension(self):
        self.implemented("- [x] **T001** done")
        self.write("--hook", "start", "--step", "converge")
        self.write("--hook", "finish", "--step", "converge")
        status, completes = self.status()
        self.assertEqual(status, "completed")
        self.assertEqual({h.get("by") for h in completes}, {"extension"})

    def test_a_clean_converge_without_a_recorded_start_completes(self):
        self.implemented("- [x] **T001** done")
        self.write("--hook", "finish", "--step", "converge")
        self.assertEqual(self.status()[0], "completed")

    def test_a_converge_long_after_implement_is_not_back_dated(self):
        self.implemented("- [x] **T001** done")
        ctx = self.ctx()
        for h in ctx["history"]:
            if h.get("step") == "implement" and h.get("kind") == "complete":
                h["at"] = "2020-01-01T00:00:00.000Z"
        (self.spec / ".spec-context.json").write_text(json.dumps(ctx), encoding="utf-8")
        self.write("--hook", "finish", "--step", "converge")
        self.assertEqual(self.status()[0], "completed")
        self.assertFalse(self.ctx().get("convergePasses"))

    def test_a_model_that_advances_converge_itself_completes_the_spec(self):
        self.implemented("- [x] **T001** done")
        self.write("--hook", "start", "--step", "converge")
        self.write("--step", "converge", "--advance", "--by", "ai")
        self.assertEqual(self.status()[0], "completed")

    def test_the_hook_after_a_model_close_adds_no_second_pass(self):
        self.implemented("- [x] **T001** done")
        self.write("--hook", "start", "--step", "converge")
        self.write("--step", "converge", "--advance", "--by", "ai")
        self.write("--hook", "finish", "--step", "converge")
        self.assertEqual(self.status()[0], "completed")
        self.assertEqual(len(self.ctx()["convergePasses"]), 1)

    def test_a_converge_without_a_recorded_start_still_records_a_timed_pass(self):
        self.implemented("- [x] **T001** done")
        self.write("--hook", "finish", "--step", "converge")
        passes = self.ctx().get("convergePasses")
        self.assertEqual(len(passes), 1)
        self.assertTrue(passes[0].get("startInferred"))
        self.assertTrue(passes[0].get("finishedAt"))
        self.assertLessEqual(passes[0]["startedAt"], passes[0]["finishedAt"])

    def test_a_converge_without_a_recorded_start_that_added_and_built_tasks_completes(self):
        self.implemented("- [x] **T001** done")
        self.tasks.write_text("- [x] **T001** done\n- [x] **T002** found and built\n", encoding="utf-8")
        future = 4_000_000_000
        os.utime(self.tasks, (future, future))
        self.write("--hook", "finish", "--step", "converge")
        self.assertEqual(self.status()[0], "completed")

    def test_a_converge_that_added_tasks_stays_implemented(self):
        self.implemented("- [x] **T001** done")
        self.write("--hook", "start", "--step", "converge")
        with self.tasks.open("a", encoding="utf-8") as fh:
            fh.write("- [ ] **T002** found by converge\n")
        self.write("--hook", "finish", "--step", "converge")
        self.assertNotEqual(self.status()[0], "completed")

    def test_an_unchecked_task_blocks_completion(self):
        self.implemented("- [x] **T001** done", "- [ ] **T002** open")
        self.write("--hook", "start", "--step", "converge")
        self.write("--hook", "finish", "--step", "converge")
        self.assertNotEqual(self.status()[0], "completed")

    def test_a_spec_still_implementing_is_not_completed(self):
        self.tasks.write_text("- [ ] **T001** open\n", encoding="utf-8")
        os.utime(self.tasks, (OLD, OLD))
        self.write("--step", "implement", "--kind", "start", "--status", "implementing")
        self.write("--hook", "start", "--step", "converge")
        self.write("--hook", "finish", "--step", "converge")
        self.assertEqual(self.status()[0], "implementing")

    def test_a_converge_that_added_and_built_its_tasks_completes_in_one_pass(self):
        self.implemented("- [x] **T001** done")
        self.write("--hook", "start", "--step", "converge")
        self.tasks.write_text("- [x] **T001** done\n- [x] **T002** found and built\n", encoding="utf-8")
        self.write("--hook", "finish", "--step", "converge")
        self.assertEqual(self.status()[0], "completed")

    def test_a_task_converge_appended_leaves_the_step_at_converge(self):
        self.implemented("- [x] **T001** done")
        self.write("--hook", "start", "--step", "converge")
        self.tasks.write_text("- [x] **T001** done\n- [x] **T002** found and built\n", encoding="utf-8")
        self.write("--task", "T002", "--kind", "complete", "--by", "ai", "--did", "built", "--append")
        self.write("--hook", "finish", "--step", "converge")
        self.assertEqual((self.ctx()["status"], self.ctx()["currentStep"]), ("completed", "converge"))

    def test_an_implementing_spec_with_every_task_checked_completes(self):
        self.tasks.write_text("- [x] **T001** done\n", encoding="utf-8")
        os.utime(self.tasks, (OLD, OLD))
        self.write("--step", "implement", "--kind", "start", "--status", "implementing")
        self.write("--hook", "start", "--step", "converge")
        self.write("--hook", "finish", "--step", "converge")
        self.assertEqual(self.status()[0], "completed")

    def ctx(self):
        return json.loads((self.spec / ".spec-context.json").read_text(encoding="utf-8"))

    def test_a_converge_on_a_completed_spec_is_recorded_and_the_spec_stays_completed(self):
        self.implemented("- [x] **T001** done")
        self.write("--mark-complete")
        before = self.ctx()
        self.write("--hook", "start", "--step", "converge")
        self.write("--hook", "finish", "--step", "converge")
        after = self.ctx()
        self.assertEqual(after["status"], "completed")
        self.assertEqual(after["currentStep"], before["currentStep"])
        self.assertTrue(after.get("convergeStartedAt"))
        self.assertGreaterEqual(len(after["history"]), len(before["history"]))
        self.assertFalse([c for c in after.get("concerns") or [] if "converge appended" in str(c)])

    def test_a_converge_that_appends_tasks_on_a_completed_spec_names_the_open_count(self):
        self.implemented("- [x] **T001** done")
        self.write("--mark-complete")
        self.write("--hook", "start", "--step", "converge")
        with self.tasks.open("a", encoding="utf-8") as fh:
            fh.write("- [ ] **T002** found\n- [ ] **T003** found\n")
        self.write("--hook", "finish", "--step", "converge")
        after = self.ctx()
        self.assertEqual(after["status"], "completed")
        notes = [c.get("note") if isinstance(c, dict) else c for c in after["concerns"]]
        self.assertIn("converge appended 2 open task(s) after completion", notes)


if __name__ == "__main__":
    unittest.main()
