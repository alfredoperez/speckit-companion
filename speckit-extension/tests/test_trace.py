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
