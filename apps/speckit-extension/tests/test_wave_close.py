"""One call closes a whole wave, and the doctor reads it as one timed unit, not a batch."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
WRITER = SCRIPTS / "write-context.py"
sys.path.insert(0, str(SCRIPTS))

from doctor_checks import check_record  # noqa: E402


class WaveClose(unittest.TestCase):
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
        (self.spec / "tasks.md").write_text(
            "".join(f"- [ ] **T00{i}** task {i}\n" for i in range(1, 6)), encoding="utf-8")
        self.write("--step", "implement", "--kind", "start", "--status", "implementing")

    def write(self, *args):
        subprocess.run([sys.executable, str(WRITER), *args], cwd=self.root,
                       capture_output=True, text=True, check=True)

    def ctx(self):
        return json.loads((self.spec / ".spec-context.json").read_text(encoding="utf-8"))

    def test_a_comma_list_closes_every_task_in_one_call(self):
        self.write("--close-task", "T001,T002,T003", "--by", "ai", "--did", "built the store")
        summaries = self.ctx()["task_summaries"]
        self.assertEqual({summaries[t]["wave"] for t in ("T001", "T002", "T003")}, {"T001-T003"})
        tasks = (self.spec / "tasks.md").read_text(encoding="utf-8")
        self.assertEqual(tasks.count("- [x]"), 3)

    def test_a_single_id_still_closes_one_task_without_a_wave(self):
        self.write("--close-task", "T004", "--by", "ai", "--did", "one task")
        self.assertNotIn("wave", self.ctx()["task_summaries"]["T004"])

    def test_the_doctor_does_not_call_a_wave_close_batching(self):
        self.write("--close-task", "T001,T002,T003,T004,T005", "--by", "ai", "--did", "the whole wave")
        _status, findings = check_record(self.spec, self.ctx())
        titles = [f.title for f in findings]
        self.assertFalse(any("journaling was batched" in t for t in titles), titles)

    def test_the_capture_eval_reads_a_wave_close_as_one_finish(self):
        from check_capture import run_checks
        self.write("--close-task", "T001,T002,T003,T004,T005", "--by", "ai", "--did", "the whole wave")
        rows = run_checks(self.spec).to_dict()["checks"]
        failed = [c["id"] for c in rows if c["status"] == "FAIL"]
        self.assertNotIn("task-cadence-span", failed)

    def test_a_batch_read_from_stdin_survives_an_apostrophe(self):
        payload = json.dumps({"set": {"intent": "the reader's waiting changes survive a reload"}})
        subprocess.run([sys.executable, str(WRITER), "--batch", "-"], cwd=self.root,
                       input=payload, capture_output=True, text=True, check=True)
        self.assertEqual(self.ctx()["intent"], "the reader's waiting changes survive a reload")

    def test_a_batch_records_the_classification(self):
        self.write("--batch", json.dumps({
            "set": {"size": "simple"},
            "classification": {"projectedFiles": 2, "projectedTasks": 3, "scopeSignal": "none", "verdict": "simple"},
        }))
        ctx = self.ctx()
        self.assertEqual(ctx["size"], "simple")
        self.assertEqual(ctx["classification"]["verdict"], "simple")


if __name__ == "__main__":
    unittest.main()
