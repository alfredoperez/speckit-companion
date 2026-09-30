"""A step lasts from its start to its own finish; idle time before the next step belongs to no step."""

from __future__ import annotations

import importlib
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
cq = importlib.import_module("check_quality")
cc = importlib.import_module("check_capture")
from check_report import Report  # noqa: E402

QA_RECORD = [
    {"step": "specify", "substep": None, "kind": "start", "by": "extension", "at": "2026-09-30T20:23:24.574Z"},
    {"step": "specify", "substep": None, "kind": "complete", "by": "extension", "at": "2026-09-30T20:23:47.208Z"},
    {"step": "plan", "substep": None, "kind": "start", "by": "extension", "at": "2026-09-30T21:17:20.000Z"},
    {"step": "plan", "substep": None, "kind": "complete", "by": "ai", "at": "2026-09-30T21:20:18.000Z"},
    {"step": "plan", "substep": None, "kind": "complete", "by": "ai", "at": "2026-09-30T21:20:19.000Z"},
    {"step": "plan", "substep": None, "kind": "complete", "by": "ai", "at": "2026-09-30T21:20:20.000Z"},
]


def _step_timing(history: list) -> str:
    r = Report()
    cc._timing(r, history)
    return next(detail for _s, cid, detail in r.rows if cid == "step-timing")


class TrustedSpansStopAtTheStepsOwnFinish(unittest.TestCase):
    def test_specify_is_measured_to_its_own_finish_not_to_plan_start(self):
        spans = cq._derive_trusted_spans(QA_RECORD)
        self.assertAlmostEqual(spans["specify"], 22.634, places=3)

    def test_plan_opened_by_the_editor_and_closed_by_the_assistant_is_measured(self):
        self.assertEqual(cq._derive_trusted_spans(QA_RECORD)["plan"], 178.0)

    def test_a_step_with_no_finish_still_closes_at_the_next_start(self):
        spans = cq._derive_trusted_spans([QA_RECORD[0], QA_RECORD[2]])
        self.assertAlmostEqual(spans["specify"], 3235.426, places=3)

    def test_the_first_trusted_finish_closes_the_step_past_an_unknown_writer(self):
        spans = cq._derive_trusted_spans([
            {"step": "plan", "substep": None, "kind": "start", "by": "extension", "at": "2026-07-01T10:00:00Z"},
            {"step": "plan", "substep": None, "kind": "complete", "at": "2026-07-01T10:02:00Z"},
            {"step": "plan", "substep": None, "kind": "complete", "by": "ai", "at": "2026-07-01T10:03:00Z"},
            {"step": "tasks", "substep": None, "kind": "start", "by": "extension", "at": "2026-07-01T11:00:00Z"},
        ])
        self.assertEqual(spans["plan"], 180.0)


    def test_a_finish_that_lands_after_the_next_start_closes_at_that_start(self):
        spans = cq._derive_trusted_spans([
            {"step": "specify", "substep": None, "kind": "start", "by": "extension", "at": "2026-07-01T10:00:00Z"},
            {"step": "plan", "substep": None, "kind": "start", "by": "extension", "at": "2026-07-01T10:05:00Z"},
            {"step": "specify", "substep": None, "kind": "complete", "by": "cli", "at": "2026-07-01T10:06:00Z"},
            {"step": "plan", "substep": None, "kind": "complete", "by": "ai", "at": "2026-07-01T10:09:00Z"},
        ])
        self.assertEqual(spans, {"specify": 300.0, "plan": 240.0})


class StepTimingReportsDurationsNotGaps(unittest.TestCase):
    def test_specify_reads_about_23_seconds_never_53_minutes(self):
        line = _step_timing(QA_RECORD)
        self.assertIn("specify 22.6s", line)
        self.assertIn("plan 3.0m", line)
        self.assertNotIn("53.", line)

    def test_an_unmeasured_step_says_so(self):
        unknown_close = QA_RECORD[:3] + [dict(QA_RECORD[3], by=None)]
        self.assertIn("plan unmeasured", _step_timing(unknown_close))


if __name__ == "__main__":
    unittest.main()
