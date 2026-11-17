"""Each converge pass records the task ids it added, so a viewer can tell gaps from a clean pass."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

WRITER = Path(__file__).resolve().parents[1] / "scripts" / "write-context.py"
OLD = 1_000_000_000


class ConvergePasses(unittest.TestCase):
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
        self.ctx_path = self.spec / ".spec-context.json"

    def write(self, *args):
        return subprocess.run([sys.executable, str(WRITER), *args], cwd=self.root,
                              capture_output=True, text=True, check=True)

    def implemented(self, *lines):
        self.tasks.write_text("".join(f"{line}\n" for line in lines), encoding="utf-8")
        os.utime(self.tasks, (OLD, OLD))
        self.write("--step", "implement", "--kind", "start", "--status", "implementing")
        self.write("--tasks-file", str(self.tasks), "--step", "implement")

    def append_task(self, line):
        with self.tasks.open("a", encoding="utf-8") as fh:
            fh.write(f"{line}\n")

    def ctx(self):
        return json.loads(self.ctx_path.read_text(encoding="utf-8"))

    def passes(self):
        return self.ctx().get("convergePasses")

    def converge(self, *new_tasks):
        self.write("--hook", "start", "--step", "converge")
        for line in new_tasks:
            self.append_task(line)
        self.write("--hook", "finish", "--step", "converge")

    def test_a_pass_that_appends_tasks_records_their_ids(self):
        self.implemented("- [x] **T001** done")
        self.converge("- [ ] **T002** found", "- [ ] **T003** also found")
        [p] = self.passes()
        self.assertEqual(p["added"], ["T002", "T003"])
        self.assertNotIn("before", p)
        self.assertIn("finishedAt", p)
        self.assertNotIn("completed", p)
        self.assertNotEqual(self.ctx()["status"], "completed")

    def test_a_clean_pass_records_nothing_added_and_completes(self):
        self.implemented("- [x] **T001** done")
        self.converge()
        [p] = self.passes()
        self.assertEqual(p["added"], [])
        self.assertTrue(p["completed"])
        self.assertEqual(p["by"], "extension")
        self.assertEqual(self.ctx()["status"], "completed")

    def test_a_reworded_task_still_completes(self):
        self.implemented("- [x] **T001** done")
        self.write("--hook", "start", "--step", "converge")
        self.tasks.write_text("- [x] **T001** done, reworded\n", encoding="utf-8")
        self.write("--hook", "finish", "--step", "converge")
        self.assertEqual(self.passes()[0]["added"], [])
        self.assertEqual(self.ctx()["status"], "completed")

    def test_second_pass_after_gaps_is_its_own_row(self):
        self.implemented("- [x] **T001** done")
        self.converge("- [ ] **T002** found")
        self.write("--close-task", "T002", "--by", "ai", "--did", "built")
        self.converge()
        first, second = self.passes()
        self.assertEqual(first["added"], ["T002"])
        self.assertEqual(second["added"], [])
        self.assertTrue(second["completed"])
        self.assertEqual(self.ctx()["status"], "completed")

    def test_a_pass_with_no_snapshot_has_no_added(self):
        self.implemented("- [x] **T001** done")
        self.write("--hook", "start", "--step", "converge")
        ctx = self.ctx()
        ctx["convergePasses"][-1].pop("before")
        self.ctx_path.write_text(json.dumps(ctx), encoding="utf-8")
        self.write("--hook", "finish", "--step", "converge")
        [p] = self.passes()
        self.assertNotIn("added", p)
        self.assertIn("finishedAt", p)

    def test_a_pass_on_a_completed_spec_is_recorded_and_keeps_the_concern(self):
        self.implemented("- [x] **T001** done")
        self.converge()
        self.converge("- [ ] **T002** late")
        second = self.passes()[1]
        self.assertEqual(second["added"], ["T002"])
        self.assertNotIn("completed", second)
        ctx = self.ctx()
        self.assertEqual(ctx["status"], "completed")
        notes = [c.get("note") if isinstance(c, dict) else c for c in ctx.get("concerns", [])]
        self.assertIn("converge appended 1 open task(s) after completion", notes)

    def test_a_malformed_pass_list_never_fails_the_hook(self):
        self.implemented("- [x] **T001** done")
        self.write("--set", "convergePasses=garbage")
        self.converge("- [ ] **T002** found")
        [p] = self.passes()
        self.assertEqual(p["added"], ["T002"])

    def test_a_retried_start_keeps_the_open_pass_and_its_snapshot(self):
        self.implemented("- [x] **T001** done")
        self.write("--hook", "start", "--step", "converge")
        self.append_task("- [x] **T002** found")
        self.write("--hook", "start", "--step", "converge")
        self.write("--hook", "finish", "--step", "converge")
        [p] = self.passes()
        self.assertEqual(p["added"], ["T002"])
        # The task converge added is checked, so the pass completes the spec.
        self.assertEqual(self.ctx()["status"], "completed")

    def test_a_repeated_task_id_is_recorded_once(self):
        self.implemented("- [x] **T001** done")
        self.converge("- [ ] **T002** found", "- [ ] **T002** found again")
        self.assertEqual(self.passes()[0]["added"], ["T002"])


if __name__ == "__main__":
    unittest.main()
