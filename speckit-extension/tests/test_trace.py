#!/usr/bin/env python3
"""The run self-trace: one line per handled call, and never a raise.

The tracer runs on paths that are already failing, so the hardest guarantee to
hold is that it cannot make things worse. These tests pin that alongside the
recording behavior.
"""

import json
import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import run_trace  # noqa: E402


class TraceWriterTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def path(self):
        return self.dir / run_trace.TRACE_NAME

    def lines(self):
        return [json.loads(x) for x in self.path().read_text(encoding="utf-8").splitlines() if x.strip()]

    def test_one_line_per_call(self):
        run_trace.record("write-context", "set", True, ms=3, feature_dir=self.dir)
        run_trace.record("write-context", "capture", True, ms=4, feature_dir=self.dir)
        self.assertEqual(len(self.lines()), 2)

    def test_a_declined_call_keeps_its_reason_verbatim(self):
        reason = "Refusing --set 'status' — lifecycle keys are managed by the capture writers."
        run_trace.record("write-context", "set", False, ms=1, feature_dir=self.dir, reason=reason)
        self.assertEqual(self.lines()[0]["reason"], reason)
        self.assertFalse(self.lines()[0]["ok"])

    def test_a_successful_call_records_no_reason(self):
        run_trace.record("write-context", "set", True, ms=1, feature_dir=self.dir,
                         reason="ignored on a success")
        self.assertIsNone(self.lines()[0]["reason"])

    def test_an_unknown_op_is_recorded_as_unknown_rather_than_invented(self):
        run_trace.record("write-context", "not-an-op", True, ms=1, feature_dir=self.dir)
        self.assertEqual(self.lines()[0]["op"], "unknown")

    def test_the_trace_ignores_itself_on_first_write(self):
        run_trace.record("write-context", "set", True, ms=1, feature_dir=self.dir)
        ignore = (self.dir / run_trace.IGNORE_NAME).read_text(encoding="utf-8")
        self.assertIn(run_trace.TRACE_NAME, ignore)

    def test_the_self_ignore_is_idempotent(self):
        for _ in range(3):
            run_trace.record("write-context", "set", True, ms=1, feature_dir=self.dir)
        body = (self.dir / run_trace.IGNORE_NAME).read_text(encoding="utf-8")
        self.assertEqual(body.count(run_trace.TRACE_NAME), 1)

    def test_an_existing_rule_is_not_duplicated(self):
        (self.dir / run_trace.IGNORE_NAME).write_text(f"{run_trace.TRACE_NAME}\n", encoding="utf-8")
        run_trace.record("write-context", "set", True, ms=1, feature_dir=self.dir)
        body = (self.dir / run_trace.IGNORE_NAME).read_text(encoding="utf-8")
        self.assertEqual(body.count(run_trace.TRACE_NAME), 1)

    def test_the_cap_rolls_old_entries_off_and_records_how_many(self):
        original = run_trace.MAX_BYTES
        run_trace.MAX_BYTES = 2048
        try:
            for i in range(200):
                run_trace.record("write-context", "set", True, ms=1, feature_dir=self.dir,
                                 reason=None, spec=f"specs/{i:03d}-x")
        finally:
            run_trace.MAX_BYTES = original
        read = run_trace.read(self.dir)
        self.assertGreater(read.truncated, 0)
        self.assertFalse(read.exact, "counts are lower bounds once entries roll off")
        self.assertLessEqual(self.path().stat().st_size, 2048)

    def test_a_call_with_no_resolvable_spec_is_not_written_to_a_guessed_location(self):
        # No repo `specs/` under a bare temp dir, so there is nowhere legitimate.
        cwd = os.getcwd()
        os.chdir(self.dir)
        try:
            run_trace.record("write-context", "unknown", False, ms=1, feature_dir=None,
                             reason="could not resolve")
        finally:
            os.chdir(cwd)
        self.assertFalse((self.dir / run_trace.TRACE_NAME).is_file())

    def test_the_tracer_never_raises_on_an_unwritable_directory(self):
        locked = self.dir / "locked"
        locked.mkdir()
        locked.chmod(stat.S_IRUSR | stat.S_IXUSR)
        try:
            run_trace.record("write-context", "set", True, ms=1, feature_dir=locked)
        finally:
            locked.chmod(stat.S_IRWXU)

    def test_the_tracer_never_raises_on_a_nonexistent_directory(self):
        run_trace.record("write-context", "set", True, ms=1, feature_dir=self.dir / "nope")


class TraceReaderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_absent_trace_reads_as_none_not_as_empty(self):
        self.assertIsNone(run_trace.read(self.dir))

    def test_an_unparseable_tail_is_counted_and_skipped(self):
        run_trace.record("write-context", "set", True, ms=1, feature_dir=self.dir)
        with (self.dir / run_trace.TRACE_NAME).open("a", encoding="utf-8") as fh:
            fh.write('{"at": "2026-08-01T00:00:00Z", "tool": "write-cont')  # crashed mid-write
        read = run_trace.read(self.dir)
        self.assertEqual(len(read.events), 1)
        self.assertEqual(read.unparseable, 1)
        self.assertFalse(read.exact)

    def test_rewrite_counts_are_per_file(self):
        for _ in range(3):
            run_trace.record("write-context", "set", True, ms=1, feature_dir=self.dir,
                             files=[".spec-context.json"], written=100)
        run_trace.record("write-context", "task-append", True, ms=1, feature_dir=self.dir,
                         files=[".spec-context.events.jsonl"], written=50)
        read = run_trace.read(self.dir)
        self.assertEqual(read.rewrites(), {".spec-context.json": 3, ".spec-context.events.jsonl": 1})
        self.assertEqual(read.bytes_written(), 350)

    def test_failures_are_separable_from_successes(self):
        run_trace.record("write-context", "set", True, ms=1, feature_dir=self.dir)
        run_trace.record("write-context", "set", False, ms=1, feature_dir=self.dir, reason="nope")
        read = run_trace.read(self.dir)
        self.assertEqual(len(read.failures()), 1)
        self.assertEqual(read.failures()[0]["reason"], "nope")

    def test_a_drift_verdict_line_is_not_mistaken_for_a_failed_call(self):
        run_trace.record("drift", "drift-compute", True, ms=5, feature_dir=self.dir)
        with (self.dir / run_trace.TRACE_NAME).open("a", encoding="utf-8") as fh:
            fh.write(json.dumps({"at": "2026-08-01T00:00:00Z", "tool": "drift",
                                 "verdict": {"checked": 3, "drifted": []}}) + "\n")
        read = run_trace.read(self.dir)
        self.assertEqual(read.failures(), [], "a verdict line carries no ok field and is not a failure")
        self.assertEqual(len(read.verdicts), 1)


if __name__ == "__main__":
    unittest.main()


class CallClassificationTests(unittest.TestCase):
    """End-to-end: run the real writer and read back what the trace says about it.

    These scripts always exit 0, so the tracer classifies from what they printed:
    a success line on stdout, a decline on stderr. Getting that wrong is not a
    cosmetic problem — a call recorded as failed sends someone hunting a bug that
    is not there.
    """

    WRITER = ROOT / "scripts" / "write-context.py"

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)
        (self.spec / ".spec-context.json").write_text(json.dumps({
            "workflow": "companion", "specName": "X", "branch": "b",
            "currentStep": "implement", "status": "implementing",
            "history": [{"step": "implement", "substep": None, "kind": "start",
                         "by": "extension", "at": "2026-08-01T11:00:00Z"}],
        }) + "\n", encoding="utf-8")
        (self.spec / "tasks.md").write_text("- [ ] **T001** First · a.py\n", encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, *args):
        import subprocess
        return subprocess.run(
            [sys.executable, str(self.WRITER), "--feature-dir", str(self.spec), *args],
            capture_output=True, text=True, cwd=self.root, check=False)

    def lines(self, where=None):
        p = (where or self.spec) / run_trace.TRACE_NAME
        if not p.is_file():
            return []
        return [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines() if x.strip()]

    def test_a_materialize_that_folded_lines_is_recorded_as_ok(self):
        self.write("--task", "T001", "--kind", "complete", "--by", "ai", "--append")
        self.write("--materialize")
        folds = [e for e in self.lines() if e["op"] == "materialize"]
        self.assertEqual(len(folds), 1)
        self.assertTrue(folds[0]["ok"],
                        "materialize prints its count on stderr; that is information, not a decline")
        self.assertIsNone(folds[0]["reason"])

    def test_a_refused_lifecycle_key_is_recorded_as_not_ok_with_its_reason(self):
        self.write("--set", "status=completed")
        sets = [e for e in self.lines() if e["op"] == "set"]
        self.assertEqual(len(sets), 1)
        self.assertFalse(sets[0]["ok"], "a refused key is a decline even alongside a success line")
        self.assertIn("Refusing", sets[0]["reason"])

    def test_an_ordinary_set_is_recorded_as_ok(self):
        self.write("--set", "last_action=done")
        sets = [e for e in self.lines() if e["op"] == "set"]
        self.assertEqual(len(sets), 1)
        self.assertTrue(sets[0]["ok"])

    def test_a_step_this_project_does_not_have_is_recorded_as_not_ok(self):
        # The guard is against a typo, which would otherwise default to
        # `specify` and journal a junk complete against the wrong step. A step
        # the project actually declares — a node directory — is accepted.
        self.write("--step", "nonsense", "--kind", "complete")
        entries = [e for e in self.lines() if not e["ok"]]
        self.assertEqual(len(entries), 1)
        self.assertIn("is not a step this project has", entries[0]["reason"])

    def test_each_operation_is_classified_by_the_flag_that_drives_it(self):
        self.write("--set", "last_action=x")
        self.write("--task", "T001", "--kind", "complete", "--by", "ai", "--append")
        self.write("--materialize")
        self.assertEqual([e["op"] for e in self.lines()],
                         ["set", "task-append", "materialize"])


class ReviewRegressionTests(unittest.TestCase):
    """Each of these reproduces a defect the review found in the tracer."""

    WRITER = ROOT / "scripts" / "write-context.py"

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)
        (self.spec / ".spec-context.json").write_text(json.dumps({
            "workflow": "companion", "specName": "X", "branch": "b",
            "currentStep": "implement", "status": "implementing",
            "history": [{"step": "implement", "substep": None, "kind": "start",
                         "by": "extension", "at": "2026-08-01T11:00:00Z"}],
        }) + "\n", encoding="utf-8")
        (self.spec / "tasks.md").write_text(
            "- [x] **T001** First · a.py\n- [ ] **T002** Second · b.py\n", encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, *args, spec=None):
        import subprocess
        return subprocess.run(
            [sys.executable, str(self.WRITER), "--feature-dir", str(spec or self.spec), *args],
            capture_output=True, text=True, cwd=self.root, check=False)

    def lines(self, where=None):
        p = (where or self.spec) / run_trace.TRACE_NAME
        return ([json.loads(x) for x in p.read_text(encoding="utf-8").splitlines() if x.strip()]
                if p.is_file() else [])

    def test_a_successful_tasks_file_sync_is_not_traced_as_a_failure(self):
        # sync_tasks reports success on stderr and is excluded from the stdout
        # block, so text inference recorded every sync as a failed call.
        self.write("--tasks-file", str(self.spec / "tasks.md"), "--by", "ai")
        syncs = [e for e in self.lines() if e["op"] == "tasks-sync"]
        self.assertEqual(len(syncs), 1)
        self.assertTrue(syncs[0]["ok"], f"traced as failed with reason {syncs[0]['reason']!r}")

    def test_an_informational_warning_on_a_successful_capture_is_not_a_failure(self):
        # The capture lands; the skipped lifecycle flag is only advisory.
        r = self.write("--decision", "chose A", "--materialize")
        self.assertIn("not applied", r.stderr)
        caps = [e for e in self.lines() if e["op"] == "capture"]
        self.assertEqual(len(caps), 1)
        self.assertTrue(caps[0]["ok"], "the decision was recorded; the call succeeded")

    def test_the_equals_form_of_a_flag_is_classified_and_resolved(self):
        self.write(f"--task=T002", "--kind=complete", "--by=ai", "--append")
        entries = self.lines()
        self.assertEqual([e["op"] for e in entries], ["task-append"],
                         "--flag=value must not read as an unknown op")

    def test_the_equals_form_of_feature_dir_traces_to_the_right_spec(self):
        import subprocess
        other = self.root / "specs" / "002-y"
        other.mkdir(parents=True)
        (other / ".spec-context.json").write_text('{"history": []}\n', encoding="utf-8")
        subprocess.run([sys.executable, str(self.WRITER), f"--feature-dir={other}",
                        "--set", "last_action=x"], capture_output=True, text=True,
                       cwd=self.root, check=False)
        self.assertTrue(self.lines(other), "the trace must land in the spec that was written")
        self.assertFalse(self.lines(self.spec), "and not in some other spec")

    def test_a_refused_key_alongside_a_success_line_is_still_a_failure(self):
        self.write("--set", "status=completed")
        sets = [e for e in self.lines() if e["op"] == "set"]
        self.assertFalse(sets[0]["ok"])
        self.assertIn("Refusing", sets[0]["reason"])

    def test_a_close_task_whose_fold_is_a_noop_still_reports_the_append(self):
        import subprocess
        r = subprocess.run(
            [sys.executable, str(self.WRITER), "--feature-dir", str(self.spec),
             "--close-task", "T002", "--by", "ai", "--did", "did it"],
            capture_output=True, text=True, cwd=self.root, check=False)
        self.assertIn("[companion]", r.stdout, "a landed write must report itself")
        closes = [e for e in self.lines() if e["op"] == "task-close"]
        self.assertEqual(len(closes), 1)
        self.assertTrue(closes[0]["ok"])
