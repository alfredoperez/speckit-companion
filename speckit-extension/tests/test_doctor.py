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


class ReviewRegressionTests(unittest.TestCase):
    """Defects the review found in the doctor's own checks."""

    def test_a_completion_failure_in_the_shared_log_is_not_blamed_on_every_spec(self):
        import tempfile, run_trace
        with tempfile.TemporaryDirectory() as tmp:
            specs = Path(tmp) / "specs"
            spec = specs / "001-x"
            spec.mkdir(parents=True)
            # An unresolvable mark-complete from a different run, long before this spec.
            run_trace.record("write-context", "mark-complete", False, ms=1,
                             feature_dir=specs, reason="could not resolve", spec=None)
            with open(specs / run_trace.TRACE_NAME, "r+", encoding="utf-8") as fh:
                body = fh.read().replace('"at":"', '"at":"2020-01-01T00:00:00Z","_at":"', 1)
                fh.seek(0); fh.write(body); fh.truncate()
            ctx = {"status": "implemented", "currentStep": "implement", "history": [
                {"step": "implement", "substep": None, "kind": "start",
                 "by": "extension", "at": "2026-08-01T11:00:00Z"},
                {"step": "implement", "substep": None, "kind": "complete",
                 "by": "extension", "at": "2026-08-01T11:30:00Z"}]}
            attempts = dc._completion_attempts(spec, ctx)
            self.assertEqual(attempts, [],
                             "another run's failure outside this spec's window is not this spec's")

    def test_the_doctor_reads_the_repo_that_owns_the_spec_not_the_cwd(self):
        import inspect
        src = inspect.getsource(doctor.main)
        self.assertIn("_repo_root_for(d)", src,
                      "resolving from the cwd scores a spec against whatever repo the shell is in")

    def test_the_report_falls_back_to_ascii_when_stdout_cannot_encode(self):
        import io, contextlib
        report = doctor.Report("specs/x")
        report.record(doctor.CheckStatus("record", "ran"),
                      [doctor.Finding("record", "problem", "a problem")])

        class AsciiOut(io.StringIO):
            encoding = "ascii"

        buf = AsciiOut()
        with contextlib.redirect_stdout(buf):
            text = doctor.render_human(report)
            self.assertNotIn("✗", text, "marks fall back to ASCII")
            doctor.safe_print(text + " \u2014 an em-dash the console cannot encode")
        self.assertIn("a problem", buf.getvalue())


class OpenStepJudgedByItsOwnCadence(unittest.TestCase):
    """A step that was recording every minute and has gone quiet for eight is stuck.

    The flat 30-minute grace read exactly that as "still running" and reported
    RECORD clean, while the spec sat at `status: tasking` with the next step
    unreachable. The grace now derives from the step's own observed cadence.
    """

    @staticmethod
    def _at(minute, second):
        return f"2026-09-05T14:{minute:02d}:{second:02d}.000Z"

    def _tasks_ctx(self):
        return {"currentStep": "tasks", "status": "tasking", "history": [
            {"step": "tasks", "substep": None, "kind": "start", "at": self._at(18, 55)},
            {"step": "tasks", "substep": "size-budget", "kind": "complete", "at": self._at(20, 9)},
            {"step": "tasks", "substep": "tasks-doc", "kind": "complete", "at": self._at(21, 15)},
            {"step": "tasks", "substep": "generate", "kind": "complete", "at": self._at(21, 27)},
            {"step": "tasks", "substep": "handoff", "kind": "complete", "at": self._at(21, 37)},
        ]}

    @staticmethod
    def _now(minute, second):
        return datetime(2026, 9, 5, 14, minute, second, tzinfo=timezone.utc)

    def test_names_the_step_that_went_quiet(self):
        dangling = dc._dangling_steps(self._tasks_ctx(), self._now(30, 10))
        self.assertEqual([s for s, _ in dangling], ["tasks"])

    def test_leaves_a_step_still_working_alone(self):
        self.assertEqual(dc._dangling_steps(self._tasks_ctx(), self._now(23, 0)), [])

    def test_keeps_the_flat_grace_when_there_is_no_cadence_to_read(self):
        ctx = {"currentStep": "implement", "status": "implementing", "history": [
            {"step": "implement", "substep": None, "kind": "start", "at": self._at(0, 0)},
        ]}
        self.assertEqual(dc._dangling_steps(ctx, self._now(10, 0)), [])
        self.assertEqual([s for s, _ in dc._dangling_steps(ctx, self._now(59, 0))], ["implement"])


class ThinBoundaryStep(unittest.TestCase):
    """A step logging one boundary for its whole span is labelled, not measured."""

    def _ctx(self, implement_substeps):
        history = []
        for step, subs in (("specify", 4), ("plan", 5), ("tasks", 4)):
            for i in range(subs):
                history.append({"step": step, "substep": f"{step}-{i}", "kind": "complete",
                                "at": "2026-09-05T14:00:00.000Z"})
        for i in range(implement_substeps):
            history.append({"step": "implement", "substep": f"impl-{i}", "kind": "complete",
                            "at": "2026-09-05T14:00:00.000Z"})
        return {"currentStep": "implement", "status": "completed", "history": history}

    def test_names_a_step_far_below_its_siblings(self):
        thin = dc._thin_boundary_steps(self._ctx(1))
        self.assertEqual([s for s, _, _ in thin], ["implement"])

    def test_says_nothing_when_every_step_recorded_a_comparable_shape(self):
        self.assertEqual(dc._thin_boundary_steps(self._ctx(4)), [])
