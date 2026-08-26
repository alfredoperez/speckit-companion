#!/usr/bin/env python3
"""The doctor's record-derived checks, against the committed fixtures.

Each fixture is frozen in one broken shape, so a failing assertion here names the
defect directly. `now` is injected wherever the in-flight grace period matters, so
these stay deterministic however long the fixtures sit on disk.
"""

import contextlib
import io
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import doctor  # noqa: E402
import doctor_checks as dc  # noqa: E402

FIXTURES = ROOT / "tests" / "fixtures" / "doctor"
FRESH = datetime(2026, 8, 1, 10, 1, tzinfo=timezone.utc)
LATER = datetime(2026, 8, 2, 10, 0, tzinfo=timezone.utc)


def load(name):
    d = FIXTURES / name
    return d, json.loads((d / ".spec-context.json").read_text(encoding="utf-8"))


def titles(findings):
    return [f.title for f in findings]


class RecordAuditTests(unittest.TestCase):
    def test_dangling_start_is_reported_with_its_step(self):
        d, ctx = load("dangling-start")
        status, findings = dc.check_record(d, ctx, now=LATER)
        self.assertEqual(status.state, "ran")
        self.assertTrue(any("`plan` started and never finished" in t for t in titles(findings)))

    def test_a_step_still_inside_the_grace_period_is_not_dangling(self):
        d, ctx = load("earliest-state")
        _status, findings = dc.check_record(d, ctx, now=FRESH)
        self.assertEqual(findings, [], "the earliest state of a run is not a defect")

    def test_the_same_record_evaluated_much_later_is_dangling(self):
        d, ctx = load("earliest-state")
        _status, findings = dc.check_record(d, ctx, now=LATER)
        self.assertTrue(any("started and never finished" in t for t in titles(findings)))

    def test_checked_tasks_without_a_journal_entry_are_named(self):
        d, ctx = load("unjournaled-tasks")
        _status, findings = dc.check_record(d, ctx, now=LATER)
        hit = [f for f in findings if "no journal entry" in f.title]
        self.assertEqual(len(hit), 1)
        self.assertEqual(hit[0].evidence["tasks"], ["T002", "T003"])

    def test_burst_journaling_is_reported_as_batched_not_as_durations(self):
        d, ctx = load("burst-journal")
        _status, findings = dc.check_record(d, ctx, now=LATER)
        hit = [f for f in findings if "journaling was batched" in f.title]
        self.assertEqual(len(hit), 1)
        self.assertEqual(hit[0].severity, "warning")
        self.assertLessEqual(hit[0].evidence["span_seconds"], dc.BURST_WINDOW_SECONDS)

    def test_an_ai_close_on_an_extension_owned_step_is_an_anomaly(self):
        d, ctx = load("attribution-anomaly")
        _status, findings = dc.check_record(d, ctx, now=LATER)
        hit = [f for f in findings if "closed by" in f.title]
        self.assertEqual(len(hit), 1)
        self.assertEqual(hit[0].evidence, {**hit[0].evidence, "step": "specify", "by": "ai"})

    def test_a_spec_with_no_record_is_a_skip_with_a_reason_not_a_clean_verdict(self):
        status, findings = dc.check_record(FIXTURES, {})
        self.assertEqual(status.state, "skipped")
        self.assertTrue(status.reason)
        self.assertEqual(findings, [])


class TriageTests(unittest.TestCase):
    def test_records_disagree_points_at_the_capture_path(self):
        d, ctx = load("records-disagree")
        status, findings = dc.check_triage(d, ctx)
        self.assertEqual(status.state, "ran")
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].severity, "problem")
        self.assertIn("Records disagree with each other", findings[0].title)

    def test_records_consistent_points_at_the_display(self):
        d, ctx = load("records-consistent")
        _status, findings = dc.check_triage(d, ctx)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].severity, "note")
        self.assertIn("suspect the display", findings[0].title)

    def test_a_status_that_asserts_no_step_completion_is_not_applicable(self):
        d, ctx = load("dangling-start")  # status: planning
        status, findings = dc.check_triage(d, ctx)
        self.assertEqual(status.state, "not-applicable")
        self.assertEqual(findings, [])


class LedgerTests(unittest.TestCase):
    def test_a_skipped_check_must_carry_a_reason(self):
        with self.assertRaises(ValueError):
            doctor.CheckStatus("record", "skipped")

    def test_a_check_that_raises_becomes_a_skip_not_a_crash(self):
        report = doctor.Report("specs/x")

        def boom():
            raise RuntimeError("kaboom")

        doctor.run_check(report, "record", boom)
        self.assertEqual(report.statuses["record"].state, "skipped")
        self.assertIn("kaboom", report.statuses["record"].reason)

    def test_findings_are_ordered_most_severe_first(self):
        report = doctor.Report("specs/x")
        report.record(doctor.CheckStatus("record", "ran"), [
            doctor.Finding("record", "note", "a note"),
            doctor.Finding("record", "problem", "a problem"),
            doctor.Finding("record", "warning", "a warning"),
        ])
        self.assertEqual([f.severity for f in report.ordered()],
                         ["problem", "warning", "note"])

    def test_a_check_that_did_not_run_never_renders_as_clean(self):
        report = doctor.Report("specs/x")
        report.record(doctor.CheckStatus("record", "skipped", "no record"))
        text = doctor.render_human(report)
        self.assertIn("skipped — no record", text)
        self.assertNotIn("RECORD      clean", text)

    def test_the_doctor_never_exits_non_zero(self):
        with contextlib.redirect_stdout(io.StringIO()):
            code = doctor.main(["--feature-dir", str(FIXTURES / "dangling-start")])
        self.assertEqual(code, 0)

    def test_an_unresolvable_spec_reports_and_still_exits_zero(self):
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(doctor.main(["--feature-dir", "does/not/exist"]), 0)

    def test_the_doctor_modifies_nothing_it_examines(self):
        target = FIXTURES / "unjournaled-tasks"
        before = {p.name: p.read_bytes() for p in sorted(target.iterdir())}
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            doctor.main(["--feature-dir", str(target)])
        after = {p.name: p.read_bytes() for p in sorted(target.iterdir())}
        self.assertEqual(before, after, "the doctor is read-only")


if __name__ == "__main__":
    unittest.main()


class CompletionTests(unittest.TestCase):
    """Four outcomes, kept strictly distinct — collapsing them is what strands a spec."""

    def check(self, name):
        d, ctx = load(name)
        report = doctor.Report(str(d))
        status, findings = dc.check_completion(d, ctx, report)
        return status, findings, report.completion

    def test_a_spec_that_landed_reports_completed_with_no_finding(self):
        status, findings, verdict = self.check("completion-landed")
        self.assertEqual(status.state, "ran")
        self.assertEqual(verdict["outcome"], "completed")
        self.assertEqual(findings, [])

    def test_a_refused_write_reports_the_writers_own_reason(self):
        _status, findings, verdict = self.check("stuck-completion")
        self.assertEqual(verdict["outcome"], "refused")
        self.assertIn("refusing to mark complete", verdict["reason"])
        self.assertEqual(findings[0].severity, "problem")

    def test_a_write_that_reported_success_but_never_landed_is_named_as_such(self):
        _status, findings, verdict = self.check("completion-never-arrived")
        self.assertEqual(verdict["outcome"], "never-arrived")
        self.assertIn("never landed", findings[0].title)

    def test_never_attempted_is_not_reported_as_a_failure(self):
        _status, findings, verdict = self.check("completion-not-attempted")
        self.assertEqual(verdict["outcome"], "not-attempted")
        self.assertFalse(verdict["attempted"])
        self.assertTrue(all(f.severity == "note" for f in findings),
                        "a step that never ran is not a failed write")

    def test_the_four_outcomes_never_collapse(self):
        outcomes = {self.check(n)[2]["outcome"] for n in (
            "completion-landed", "stuck-completion",
            "completion-never-arrived", "completion-not-attempted")}
        self.assertEqual(outcomes,
                         {"completed", "refused", "never-arrived", "not-attempted"})


class TemplateFidelityTests(unittest.TestCase):
    def check(self, name):
        return dc.check_template(FIXTURES / name)

    def test_an_intact_task_file_passes(self):
        status, findings = self.check("template-intact")
        self.assertEqual(status.state, "ran")
        self.assertEqual(findings, [])

    def test_a_flattened_file_is_flagged_and_its_headings_are_named(self):
        _status, findings = self.check("flattened-tasks")
        hit = [f for f in findings if "replaced by top-level wave headings" in f.title]
        self.assertEqual(len(hit), 1)
        self.assertEqual(hit[0].evidence["headings"], ["## Wave 1", "## Wave 2"])

    def test_removing_the_join_lines_is_reported(self):
        _status, findings = self.check("template-no-joins")
        self.assertTrue(any("join lines were removed" in f.title for f in findings))

    def test_a_single_user_story_file_is_not_mistaken_for_a_flattened_one(self):
        _status, findings = self.check("template-single-story")
        self.assertEqual(findings, [])

    def test_a_spec_with_no_task_file_is_not_applicable_not_a_failure(self):
        status, findings = self.check("dangling-start")
        self.assertEqual(status.state, "not-applicable")
        self.assertEqual(findings, [])
