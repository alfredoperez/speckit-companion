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

    def test_a_second_clean_converge_completes_after_the_first_added_tasks(self):
        self.implemented("- [x] **T001** done")
        self.write("--hook", "start", "--step", "converge")
        self.tasks.write_text("- [x] **T001** done\n- [x] **T002** found and built\n", encoding="utf-8")
        self.write("--hook", "finish", "--step", "converge")
        self.assertNotEqual(self.status()[0], "completed")
        os.utime(self.tasks, (OLD, OLD))
        self.write("--hook", "start", "--step", "converge")
        self.write("--hook", "finish", "--step", "converge")
        self.assertEqual(self.status()[0], "completed")

    def test_an_implementing_spec_with_every_task_checked_completes(self):
        self.tasks.write_text("- [x] **T001** done\n", encoding="utf-8")
        os.utime(self.tasks, (OLD, OLD))
        self.write("--step", "implement", "--kind", "start", "--status", "implementing")
        self.write("--hook", "start", "--step", "converge")
        self.write("--hook", "finish", "--step", "converge")
        self.assertEqual(self.status()[0], "completed")

    def test_a_completed_spec_is_unchanged(self):
        self.implemented("- [x] **T001** done")
        self.write("--mark-complete")
        before = (self.spec / ".spec-context.json").read_bytes()
        self.write("--hook", "finish", "--step", "converge")
        self.assertEqual((self.spec / ".spec-context.json").read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
