"""The health check must not hide the failures it exists to find (#622)."""
import json
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "speckit-extension" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import doctor_bleed  # noqa: E402
import doctor_checks  # noqa: E402

WRITER = SCRIPTS / "write-context.py"


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


class BurstsAreJudgedPerCluster(unittest.TestCase):
    """Batching is local. Measuring first-to-last across the run missed the worst cases."""

    def _ctx(self, groups):
        base = datetime(2026, 8, 26, 12, 0, 0, tzinfo=timezone.utc)
        history, n = [], 0
        for offset, count in groups:
            for _ in range(count):
                n += 1
                history.append({"step": "implement", "task": f"T{n:03d}", "kind": "complete",
                                "by": "ai", "at": iso(base + timedelta(seconds=offset))})
        return {"currentStep": "implement", "status": "implemented", "history": history}

    def _warned(self, ctx):
        # check_record skips outright when the context file is absent, so the
        # fixture has to exist on disk for the burst logic to be reached at all.
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name)
        (d / ".spec-context.json").write_text(json.dumps(ctx))
        _status, findings = doctor_checks.check_record(d, ctx)
        return [f for f in findings if "batched" in f.title]

    def test_four_tasks_at_one_instant_warn_even_when_the_run_is_long(self):
        # The exact shape that produced zero warnings: 3 clusters of 4, 30s apart.
        ctx = self._ctx([(0, 4), (30, 4), (60, 4)])
        warned = self._warned(ctx)
        self.assertTrue(warned, "identical-timestamp clusters must warn")
        ev = warned[0].evidence
        self.assertEqual(ev["batches"], 3)
        self.assertEqual(ev["largest_batch"], 4)
        self.assertEqual(len(ev["tasks"]), 12)

    def test_tasks_spread_across_real_time_do_not_warn(self):
        self.assertFalse(self._warned(self._ctx([(0, 1), (60, 1), (120, 1), (180, 1)])))

    def test_one_tight_cluster_still_warns(self):
        self.assertTrue(self._warned(self._ctx([(0, 3)])))


class ElapsedTimeIsTheDenominator(unittest.TestCase):
    """Shares said 'of the run' while dividing by the sum of step spans."""

    def _ctx(self):
        base = datetime(2026, 8, 26, 12, 0, 0, tzinfo=timezone.utc)
        def at(sec):
            return iso(base + timedelta(seconds=sec))
        # 100s elapsed; steps account for 40s. 60% belongs to no step.
        return {"currentStep": "implement", "status": "implemented", "history": [
            {"step": "specify", "kind": "start", "by": "extension", "at": at(0)},
            {"step": "specify", "kind": "complete", "by": "extension", "at": at(30)},
            {"step": "implement", "kind": "start", "by": "extension", "at": at(90)},
            {"step": "implement", "kind": "complete", "by": "extension", "at": at(100)},
        ]}

    def test_the_share_is_measured_against_elapsed_time(self):
        share = doctor_bleed._time_share(self._ctx())
        self.assertIsNotNone(share)
        # specify is 30s of 100s elapsed, not 30s of the 40s of step spans.
        self.assertAlmostEqual(share["share"], 0.30, places=2)
        self.assertAlmostEqual(share["elapsed_seconds"], 100, places=0)
        self.assertAlmostEqual(share["step_span_seconds"], 40, places=0)

    def test_time_belonging_to_no_step_is_reported(self):
        gap = doctor_bleed._elapsed_gap(self._ctx())
        self.assertAlmostEqual(gap["unattributed_share"], 0.60, places=2)

    def test_a_run_with_no_gap_reports_none(self):
        base = datetime(2026, 8, 26, 12, 0, 0, tzinfo=timezone.utc)
        def at(sec):
            return iso(base + timedelta(seconds=sec))
        ctx = {"currentStep": "implement", "status": "implemented", "history": [
            {"step": "specify", "kind": "start", "by": "extension", "at": at(0)},
            {"step": "specify", "kind": "complete", "by": "extension", "at": at(50)},
            {"step": "implement", "kind": "start", "by": "extension", "at": at(50)},
            {"step": "implement", "kind": "complete", "by": "extension", "at": at(100)},
        ]}
        self.assertLess(doctor_bleed._elapsed_gap(ctx)["unattributed_share"], 0.01)


class AStepStartLeavesStatusAlone(unittest.TestCase):
    """Opening a step used to be indistinguishable from asking for 'specified'."""

    def _cell(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name)
        (d / "specs" / "001-x").mkdir(parents=True)
        subprocess.run(["git", "init", "-q", "."], cwd=d, check=True)
        return d

    def _status(self, d):
        ctx = json.loads((d / "specs" / "001-x" / ".spec-context.json").read_text())
        return ctx["currentStep"], ctx["status"]

    def _write(self, d, *args):
        return subprocess.run([sys.executable, str(WRITER), "--feature-dir", "specs/001-x", *args],
                              cwd=d, capture_output=True, text=True)

    def test_a_start_carries_the_step_without_rewinding_status(self):
        d = self._cell()
        self._write(d, "--step", "tasks", "--status", "ready-to-implement", "--kind", "complete")
        self.assertEqual(self._status(d), ("tasks", "ready-to-implement"))
        self._write(d, "--step", "implement", "--kind", "start", "--by", "extension")
        self.assertEqual(self._status(d), ("implement", "ready-to-implement"))

    def test_an_explicit_status_on_a_start_is_still_honoured(self):
        d = self._cell()
        self._write(d, "--step", "specify", "--status", "specifying", "--kind", "start")
        self.assertEqual(self._status(d), ("specify", "specifying"))

    def test_a_complete_still_sets_its_status(self):
        d = self._cell()
        self._write(d, "--step", "plan", "--status", "planned", "--kind", "complete")
        self.assertEqual(self._status(d), ("plan", "planned"))


if __name__ == "__main__":
    unittest.main()
