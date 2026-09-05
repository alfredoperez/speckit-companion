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


class TraceLostWithoutTraceFile(unittest.TestCase):
    """A run that could not write its trace at all still left evidence.

    The marker exists precisely for the case where appending to the trace failed,
    and the commonest cause of that is a directory the run could not write into —
    which is the same cause that means no trace file exists to read. A check that
    returns "nothing captured yet" before consulting the marker can never report
    the one failure the marker was built to carry.
    """

    @contextlib.contextmanager
    def _spec(self, marker_text=None, with_trace=False):
        import tempfile, run_trace
        with tempfile.TemporaryDirectory() as tmp:
            spec = Path(tmp) / "specs" / "001-x"
            spec.mkdir(parents=True)
            if marker_text is not None:
                (spec / run_trace.LOST_NAME).write_text(marker_text, encoding="utf-8")
            if with_trace:
                run_trace.record("write-context", "capture", True, ms=1, feature_dir=spec)
            yield spec

    def test_marker_without_a_trace_file_is_reported_as_a_problem(self):
        with self._spec("write-context --step plan: [Errno 13] Permission denied\n") as spec:
            status, findings = dc.check_trace(spec, {})
        self.assertEqual(status.state, "ran",
                         "a marker is trace evidence, so the check ran rather than skipped")
        lost = [f for f in findings if f.severity == "problem"]
        self.assertEqual(len(lost), 1, "exactly one finding for the unrecorded calls")
        self.assertIn("Permission denied", lost[0].detail,
                      "the marker's own reason is named verbatim")

    def test_no_marker_and_no_trace_still_skips_with_the_existing_wording(self):
        with self._spec() as spec:
            status, findings = dc.check_trace(spec, {})
        self.assertEqual(status.state, "skipped")
        self.assertIn("nothing has been captured", status.reason)
        self.assertEqual(findings, [])

    def test_a_sibling_specs_failure_is_not_reported_against_this_spec(self):
        # The shared marker is one spec's last resort and every spec's neighbour.
        # Merging it into each spec's verdict would turn one real problem into a
        # false alarm on every spec in the repo that never traced anything.
        import tempfile, run_trace
        with tempfile.TemporaryDirectory() as tmp:
            specs = Path(tmp) / "specs"
            (specs / "001-broken").mkdir(parents=True)
            quiet = specs / "002-quiet"
            quiet.mkdir()
            run_trace._note_trace_failure(specs / "001-broken", OSError("Permission denied"))
            shared = specs / run_trace.LOST_NAME
            if not shared.is_file():  # the broken spec's own dir was writable here
                shared.write_text("2026-01-01 spec=001-broken OSError: Permission denied\n",
                                  encoding="utf-8")
            self.assertEqual(dc._lost_entries(quiet), [],
                             "a sibling's line is not this spec's evidence")
            status, findings = dc.check_trace(quiet, {})
            self.assertEqual(status.state, "skipped",
                             "a spec that never traced anything still reports skipped")

    def test_a_shared_marker_line_tagged_with_this_spec_is_this_spec_s(self):
        import tempfile, run_trace
        with tempfile.TemporaryDirectory() as tmp:
            specs = Path(tmp) / "specs"
            spec = specs / "001-x"
            spec.mkdir(parents=True)
            (specs / run_trace.LOST_NAME).write_text(
                "2026-01-01 spec=001-x OSError: Permission denied\n"
                "2026-01-01 spec=002-other OSError: Permission denied\n", encoding="utf-8")
            entries = dc._lost_entries(spec)
            self.assertEqual(len(entries), 1, "only this spec's tagged line counts")
            self.assertIn("spec=001-x", entries[0])

    def test_an_empty_marker_is_indistinguishable_from_an_absent_one(self):
        with self._spec("   \n\n") as spec:
            status, findings = dc.check_trace(spec, {})
        self.assertEqual(status.state, "skipped")
        self.assertEqual(findings, [])


class VerificationCheck(unittest.TestCase):
    """A step that closed having executed nothing says so.

    The requirement to run the project's own checks is prompt text, and prompt
    text has no observer. `verified[]` is already written by the capture runtime;
    until something reads it, a run can write code, check off a task named "add a
    test", and close with nothing having been proven to work.
    """

    @contextlib.contextmanager
    def _spec(self, ctx):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            spec = Path(tmp) / "specs" / "001-x"
            spec.mkdir(parents=True)
            (spec / ".spec-context.json").write_text(json.dumps(ctx), encoding="utf-8")
            yield spec

    def _closed(self, **extra):
        ctx = {"currentStep": "implement", "status": "completed", "history": [
            {"step": "implement", "substep": None, "kind": "start",
             "by": "extension", "at": "2026-09-05T11:00:00Z"},
            {"step": "implement", "substep": None, "kind": "complete",
             "by": "ai", "at": "2026-09-05T11:30:00Z"}]}
        ctx.update(extra)
        return ctx

    def test_implement_closed_with_nothing_verified_is_a_problem(self):
        with self._spec(self._closed()) as spec:
            status, findings = dc.check_verification(spec, self._closed())
        self.assertEqual(status.state, "ran")
        self.assertEqual(len(findings), 1, "exactly one finding names the unverified step")
        self.assertEqual(findings[0].severity, "problem")

    def test_one_recorded_verification_is_enough(self):
        ctx = self._closed(verified=[{"what": "test suite", "result": "38/38 pass"}])
        with self._spec(ctx) as spec:
            status, findings = dc.check_verification(spec, ctx)
        self.assertEqual(status.state, "ran")
        self.assertEqual(findings, [])

    def test_a_malformed_verified_list_degrades_to_the_finding_never_a_crash(self):
        for bad in (None, [], "ran the tests", {"what": "x"}):
            ctx = self._closed(verified=bad)
            with self._spec(ctx) as spec:
                status, findings = dc.check_verification(spec, ctx)
            self.assertEqual(status.state, "ran", f"{bad!r} is judged, not crashed on")
            self.assertEqual(len(findings), 1, f"{bad!r} counts as nothing verified")

    def test_a_spec_that_never_reached_implement_reports_no_record(self):
        ctx = {"currentStep": "plan", "status": "planned", "history": [
            {"step": "plan", "substep": None, "kind": "complete",
             "by": "ai", "at": "2026-09-05T11:00:00Z"}]}
        with self._spec(ctx) as spec:
            status, findings = dc.check_verification(spec, ctx)
        self.assertEqual(status.state, "skipped", "no record is not a problem")
        self.assertEqual(findings, [])

    def test_an_empty_history_takes_the_shared_no_record_skip(self):
        ctx = {"currentStep": "implement", "history": []}
        with self._spec(ctx) as spec:
            status, findings = dc.check_verification(spec, ctx)
        self.assertEqual(status.state, "skipped")
        self.assertEqual(findings, [])

    def test_a_legacy_from_to_entry_counts_as_implement_closing(self):
        # These are the already-on-disk runs the report exists for. Reading `kind`
        # raw instead of through _entry_kind skips every one of them silently.
        ctx = {"currentStep": "implement", "status": "completed", "history": [
            {"step": "implement", "substep": None,
             "from": {"step": "implement", "substep": None},
             "to": {"step": "implement", "substep": None},
             "by": "ai", "at": "2026-09-05T11:30:00Z"}]}
        with self._spec(ctx) as spec:
            status, findings = dc.check_verification(spec, ctx)
        self.assertEqual(status.state, "ran", "a legacy completion is still a completion")
        self.assertEqual(len(findings), 1)

    def test_the_check_is_registered_so_the_report_actually_runs_it(self):
        self.assertIn("verification", doctor.CHECKS)


class ArtifactManifestCheck(unittest.TestCase):
    """A step that closed without the file it declared it would write says so.

    Every author node already declared its output in `writes:`, and the build
    collects those into `commands/.manifest.json`. Nothing compared that against
    the disk, so a step that quietly stopped writing its document closed exactly
    like one that wrote it. Reported, never blocking — and every way of not
    knowing has to read as "no record", or a report nobody trusts is a report
    nobody reads.
    """

    SPECIFY = {"commands": {"specify": [
        {"artifact": "spec.md", "node": "draft-spec", "conditional": False},
        {"artifact": "checklists/requirements.md", "node": "quality-checklist",
         "conditional": False},
    ]}}

    @contextlib.contextmanager
    def _run(self, manifest, files=("spec.md",), ctx=None):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            spec = Path(tmp) / "specs" / "001-x"
            spec.mkdir(parents=True)
            spec.joinpath(".spec-context.json").write_text(
                json.dumps(ctx if ctx is not None else self._closed()), encoding="utf-8")
            for name in files:
                target = spec / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("x", encoding="utf-8")
            path = Path(tmp) / ".manifest.json"
            if manifest is not None:
                path.write_text(manifest if isinstance(manifest, str) else json.dumps(manifest),
                                encoding="utf-8")
            yield spec, path

    def _closed(self, step="specify"):
        return {"currentStep": step, "status": "specified", "history": [
            {"step": step, "substep": None, "kind": "start",
             "by": "extension", "at": "2026-09-05T11:00:00Z"},
            {"step": step, "substep": None, "kind": "complete",
             "by": "extension", "at": "2026-09-05T11:30:00Z"}]}

    def test_a_step_that_closed_without_its_declared_file_is_reported(self):
        with self._run(self.SPECIFY) as (spec, path):
            status, findings = dc.check_artifact(spec, self._closed(), manifest_path=path)
        self.assertEqual(status.state, "ran")
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].severity, "warning", "reported, never blocking")
        self.assertIn("checklists/requirements.md", findings[0].title)
        self.assertEqual(findings[0].evidence["node"], "quality-checklist",
                         "an artifact nobody can attribute is a report nobody can act on")

    def test_a_step_that_produced_everything_it_declared_is_clean(self):
        with self._run(self.SPECIFY,
                       files=("spec.md", "checklists/requirements.md")) as (spec, path):
            status, findings = dc.check_artifact(spec, self._closed(), manifest_path=path)
        self.assertEqual(status.state, "ran")
        self.assertEqual(findings, [])

    def test_a_step_that_never_closed_is_not_judged(self):
        ctx = {"currentStep": "specify", "history": [
            {"step": "specify", "substep": None, "kind": "start",
             "by": "extension", "at": "2026-09-05T11:00:00Z"}]}
        with self._run(self.SPECIFY, ctx=ctx) as (spec, path):
            status, findings = dc.check_artifact(spec, ctx, manifest_path=path)
        self.assertEqual(status.state, "skipped", "an open step has not promised anything yet")
        self.assertEqual(findings, [])

    def test_a_legacy_from_to_entry_still_counts_as_the_step_closing(self):
        ctx = {"currentStep": "specify", "history": [
            {"step": "specify", "substep": None,
             "from": {"step": "specify", "substep": None},
             "to": {"step": "specify", "substep": None},
             "by": "ai", "at": "2026-09-05T11:30:00Z"}]}
        with self._run(self.SPECIFY, ctx=ctx) as (spec, path):
            status, findings = dc.check_artifact(spec, ctx, manifest_path=path)
        self.assertEqual(status.state, "ran", "the already-on-disk runs are the point")
        self.assertEqual(len(findings), 1)

    # ---- every way of not knowing reads as "no record" ---------------------- #

    def test_a_missing_manifest_is_no_record(self):
        with self._run(None) as (spec, path):
            status, findings = dc.check_artifact(spec, self._closed(), manifest_path=path)
        self.assertEqual(status.state, "skipped")
        self.assertIn("manifest", status.reason)
        self.assertEqual(findings, [])

    def test_an_unparseable_manifest_is_no_record_not_a_crash(self):
        with self._run("{ not json") as (spec, path):
            status, findings = dc.check_artifact(spec, self._closed(), manifest_path=path)
        self.assertEqual(status.state, "skipped")
        self.assertEqual(findings, [])

    def test_a_manifest_of_the_wrong_shape_is_no_record(self):
        for bad in ([], {"commands": []}, {"commands": "specify"}, {}, "null"):
            with self._run(bad) as (spec, path):
                status, findings = dc.check_artifact(spec, self._closed(), manifest_path=path)
            self.assertEqual(status.state, "skipped", f"{bad!r} is judged as no record")
            self.assertEqual(findings, [])

    def test_a_step_declaring_no_artifact_is_no_record(self):
        with self._run({"commands": {"specify": []}}) as (spec, path):
            status, findings = dc.check_artifact(spec, self._closed(), manifest_path=path)
        self.assertEqual(status.state, "skipped")
        self.assertEqual(findings, [])

    def test_a_step_the_manifest_does_not_mention_is_no_record(self):
        ctx = self._closed(step="plan")
        with self._run(self.SPECIFY, ctx=ctx) as (spec, path):
            status, findings = dc.check_artifact(spec, ctx, manifest_path=path)
        self.assertEqual(status.state, "skipped")
        self.assertEqual(findings, [])

    def test_a_run_that_produced_none_of_it_predates_this_pipeline(self):
        # A stock spec-kit run, or one older than the node that writes the file.
        # Reporting every artifact of a pipeline it never executed is the manifest
        # crying wolf on a spec that never made the promise.
        with self._run(self.SPECIFY, files=()) as (spec, path):
            status, findings = dc.check_artifact(spec, self._closed(), manifest_path=path)
        self.assertEqual(status.state, "skipped")
        self.assertEqual(findings, [])

    def test_a_may_write_artifact_the_budget_folded_away_is_not_a_finding(self):
        manifest = {"commands": {"specify": [
            {"artifact": "spec.md", "node": "draft-spec", "conditional": False},
            {"artifact": "research.md", "node": "side-files", "conditional": True},
        ]}}
        with self._run(manifest) as (spec, path):
            status, findings = dc.check_artifact(spec, self._closed(), manifest_path=path)
        self.assertEqual(status.state, "ran")
        self.assertEqual(findings, [], "a size budget doing its job is not a defect")

    def test_a_spec_with_no_record_at_all_takes_the_shared_skip(self):
        for ctx in ({}, {"currentStep": "specify", "history": []}):
            with self._run(self.SPECIFY, ctx=ctx) as (spec, path):
                status, findings = dc.check_artifact(spec, ctx, manifest_path=path)
            self.assertEqual(status.state, "skipped")
            self.assertEqual(findings, [])

    def test_a_directory_artifact_counts_as_produced_when_the_directory_exists(self):
        manifest = {"commands": {"plan": [
            {"artifact": "plan.md", "node": "plan-doc", "conditional": False},
            {"artifact": "contracts/", "node": "side-files", "conditional": False},
        ]}}
        ctx = self._closed(step="plan")
        with self._run(manifest, files=("plan.md", "contracts/api.md"), ctx=ctx) as (spec, path):
            status, findings = dc.check_artifact(spec, ctx, manifest_path=path)
        self.assertEqual(status.state, "ran")
        self.assertEqual(findings, [], "a declared directory is produced when it is there")

    def test_the_shipped_manifest_is_where_the_doctor_looks_for_it(self):
        # The build writes it beside the command bodies; both the source tree and
        # an installed extension put scripts/ next to commands/. A moved file is a
        # check that silently skips forever.
        self.assertTrue(dc.MANIFEST_PATH.is_file(), f"{dc.MANIFEST_PATH} is not there")
        self.assertIsNotNone(dc._declared_artifacts())

    def test_the_check_is_registered_so_the_report_actually_runs_it(self):
        self.assertIn("artifact", doctor.CHECKS)
