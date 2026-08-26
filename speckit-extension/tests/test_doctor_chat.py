#!/usr/bin/env python3
"""The `--chat` deep audit, against a committed synthetic transcript.

The real transcript format carries no compatibility promise, so the fixture pins
the shapes the audit reads and every test here also pins the degradation path:
whatever goes wrong, the audit reports one line and exits successfully.
"""

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import doctor  # noqa: E402
import doctor_chat as dch  # noqa: E402

FIXTURE = ROOT / "tests" / "fixtures" / "doctor" / "chat" / "session.jsonl"

WINDOW_CTX = {
    "currentStep": "implement",
    "status": "implemented",
    "history": [
        {"step": "implement", "substep": None, "kind": "start", "by": "extension",
         "at": "2026-08-01T10:00:00Z"},
        {"step": "implement", "substep": None, "kind": "complete", "by": "extension",
         "at": "2026-08-01T10:02:00Z"},
    ],
}


def audit(ctx=None, report=None, override=str(FIXTURE)):
    return dch.check_chat(ROOT.parent, ROOT, ctx if ctx is not None else WINDOW_CTX,
                          report, override=override)


class CauseTests(unittest.TestCase):
    def test_failures_and_retries_are_reported_together(self):
        status, findings = audit()
        self.assertEqual(status.state, "ran")
        hit = [f for f in findings if "failed during this run" in f.title]
        self.assertEqual(len(hit), 1)
        self.assertEqual(hit[0].evidence["failures"], 2)
        self.assertEqual(hit[0].evidence["retries"], 1, "the repeated pytest call is the retry")

    def test_work_outside_the_run_window_is_not_counted(self):
        _status, findings = audit()
        note = [f for f in findings if "assistant turns" in f.title][0]
        self.assertEqual(note.evidence["tool_calls"], 6,
                         "the later call sits outside the window")

    def test_a_step_that_stopped_is_distinguished_from_one_still_running(self):
        stalled = {"currentStep": "plan", "status": "planning", "history": [
            {"step": "specify", "substep": None, "kind": "start", "by": "extension",
             "at": "2026-08-01T10:00:00Z"},
            {"step": "plan", "substep": None, "kind": "start", "by": "extension",
             "at": "2026-08-01T10:01:00Z"},
        ]}
        _status, findings = audit(stalled)
        stopped = [f.evidence["step"] for f in findings if "never attempted again" in f.title]
        self.assertEqual(stopped, ["specify"], "plan is in flight, not stalled")

    def test_repeated_rewrites_of_one_file_are_quantified(self):
        _status, findings = audit()
        churn = [f for f in findings if f.title == "Files rewritten repeatedly"]
        self.assertEqual(len(churn), 1)
        self.assertEqual(churn[0].evidence["churn"], {"/repo/src/thing.py": 3})

    def test_an_unreadable_transcript_tail_is_skipped_not_fatal(self):
        _status, findings = audit()
        note = [f for f in findings if "assistant turns" in f.title][0]
        self.assertIn("could not be read", note.detail)


class ContradictionTests(unittest.TestCase):
    def test_a_drift_claim_contradicted_by_recomputation_is_surfaced(self):
        report = doctor.Report("specs/x")
        report.drift = [{"capability": "x", "class": "real",
                         "claim": {"source": "verified[]", "text": "living specs in sync",
                                   "at": "2026-08-01T10:01:00Z"}}]
        _status, findings = audit(report=report)
        hit = [f for f in findings if "contradicts" in f.title]
        self.assertEqual(len(hit), 1)
        self.assertIn("living specs in sync", hit[0].detail)

    def test_a_completion_that_never_arrived_is_surfaced_as_a_contradiction(self):
        report = doctor.Report("specs/x")
        report.completion = {"attempted": True, "outcome": "never-arrived", "reason": "x"}
        _status, findings = audit(report=report)
        self.assertTrue(any("contradicts" in f.title for f in findings))

    def test_a_clean_run_surfaces_no_contradiction(self):
        report = doctor.Report("specs/x")
        _status, findings = audit(report=report)
        self.assertEqual([f for f in findings if "contradicts" in f.title], [])


class DegradationTests(unittest.TestCase):
    """However it fails, it reports one line and the command still exits 0."""

    def test_no_transcript_is_a_skip_with_a_reason(self):
        with tempfile.TemporaryDirectory() as tmp:
            status, findings = dch.check_chat(tmp, Path(tmp), WINDOW_CTX,
                                              override=str(Path(tmp) / "nope.jsonl"))
        self.assertEqual(status.state, "skipped")
        self.assertIn("no session transcript", status.reason)
        self.assertEqual(findings, [])

    def test_a_transcript_outside_the_window_is_a_skip_with_its_own_reason(self):
        far = {"currentStep": "implement", "status": "implemented", "history": [
            {"step": "implement", "substep": None, "kind": "start", "by": "extension",
             "at": "2020-01-01T00:00:00Z"},
            {"step": "implement", "substep": None, "kind": "complete", "by": "extension",
             "at": "2020-01-01T00:05:00Z"},
        ]}
        status, _findings = audit(far)
        self.assertEqual(status.state, "skipped")
        self.assertIn("time window", status.reason)

    def test_a_transcript_it_cannot_parse_at_all_degrades_rather_than_raising(self):
        with tempfile.TemporaryDirectory() as tmp:
            junk = Path(tmp) / "junk.jsonl"
            junk.write_text("not json at all\nnor this\n", encoding="utf-8")
            status, findings = dch.check_chat(tmp, Path(tmp), WINDOW_CTX, override=str(junk))
        self.assertEqual(status.state, "skipped")
        self.assertEqual(findings, [])

    def test_the_project_key_matches_how_transcripts_are_filed(self):
        self.assertEqual(dch.project_key("/Users/x/dev/repo"), "-Users-x-dev-repo")


if __name__ == "__main__":
    unittest.main()
