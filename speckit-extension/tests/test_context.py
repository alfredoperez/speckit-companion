#!/usr/bin/env python3
"""Regression tests for the companion lifecycle capture + derive fallback.

Stdlib `unittest` only — run with:

    python3 -m unittest discover speckit-extension/tests

Covers the write contract the GUI depends on: append-only transitions,
no-backward-clobber, unknown-key preservation, per-task idempotency, and a
derive-from-files round-trip.
"""

from __future__ import annotations

import importlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))
wc = importlib.import_module("write-context")
derive_mod = importlib.import_module("derive-from-files")


def _ctx(feature_dir: Path) -> dict:
    return json.loads((feature_dir / ".spec-context.json").read_text())


def _tasks(*lines: str) -> str:
    return "\n".join(lines) + "\n"


class LifecycleCaptureTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fd = Path(self._tmp.name) / "specs" / "_zzz-test"
        self.fd.mkdir(parents=True)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_history_is_append_only(self) -> None:
        wc.update_context(self.fd, "specify", "specified", "extension")
        h1 = _ctx(self.fd)["history"]
        n1 = len(h1)
        specify_entry = dict(h1[0])  # snapshot the prior entry before the next write
        wc.update_context(self.fd, "plan", "planned", "extension")
        h2 = _ctx(self.fd)["history"]
        self.assertGreater(len(h2), n1)
        # Append-only: the prior specify entry survives BYTE-FOR-BYTE untouched
        # (not just its step) and the new plan start lands at the tail (current
        # shape has no `from` key — #138).
        self.assertEqual(h2[0], specify_entry)
        self.assertEqual([e["step"] for e in h2], ["specify", "plan"])
        self.assertEqual(h2[-1]["step"], "plan")
        self.assertEqual(h2[-1]["kind"], "start")

    def test_duplicate_same_step_start_is_deduped(self) -> None:
        # GUI startStep + the after_specify hook both firing must not append two
        # specify starts — the second collapses (Issue 2: duplicate start).
        wc.update_context(self.fd, "specify", "specified", "extension")
        wc.update_context(self.fd, "specify", "specified", "extension")
        starts = [h for h in _ctx(self.fd)["history"] if h["step"] == "specify" and h["kind"] == "start"]
        self.assertEqual(len(starts), 1)

    def test_next_step_start_still_appends_after_a_deduped_start(self) -> None:
        wc.update_context(self.fd, "specify", "specified", "extension")
        wc.update_context(self.fd, "specify", "specified", "extension")  # deduped
        wc.update_context(self.fd, "plan", "planned", "extension")
        h = _ctx(self.fd)["history"]
        # The dedup collapsed the duplicate specify start, but the next step's
        # start still appends — exactly one specify start, then the plan start.
        specify_starts = [e for e in h if e["step"] == "specify" and e["kind"] == "start"]
        self.assertEqual(len(specify_starts), 1)
        self.assertEqual(h[-1]["step"], "plan")
        self.assertEqual(h[-1]["kind"], "start")

    def test_after_tasks_settles_status_to_ready_to_implement(self) -> None:
        # #491: the after_tasks hook is what flips tasking -> ready-to-implement.
        # Lock that the writer settles the top-level status so the panel can
        # unlock — the hook path (currentStep=tasks) must land at the settled
        # status, not linger at tasking.
        wc.update_context(self.fd, "tasks", "ready-to-implement", "extension")
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["status"], "ready-to-implement")
        self.assertEqual(ctx["currentStep"], "tasks")

    def test_writes_canonical_history_not_legacy_keys(self) -> None:
        wc.update_context(self.fd, "specify", "specified", "extension")
        ctx = _ctx(self.fd)
        self.assertIn("history", ctx)
        self.assertNotIn("transitions", ctx)
        self.assertNotIn("stepHistory", ctx)

    def test_legacy_transitions_migrated_into_history(self) -> None:
        # A file written by an older extension carried `transitions[]`; the next
        # write must fold it into `history[]` and drop the legacy key so the GUI
        # (which prefers history) and the extension share one array.
        target = self.fd / ".spec-context.json"
        target.write_text(json.dumps({
            "workflow": "speckit", "specName": "x", "branch": "main",
            "currentStep": "specify", "status": "specified",
            "transitions": [{"step": "specify", "substep": None, "from": None,
                             "by": "extension", "at": "2026-01-01T00:00:00.000Z"}],
        }))
        wc.update_context(self.fd, "plan", "planned", "extension")
        ctx = _ctx(self.fd)
        self.assertNotIn("transitions", ctx)
        steps = [e["step"] for e in ctx["history"]]
        self.assertEqual(steps, ["specify", "plan"])  # prior entry preserved + new one

    def test_no_backward_clobber(self) -> None:
        wc.update_context(self.fd, "implement", "implemented", "extension")
        before = _ctx(self.fd)
        result = wc.update_context(self.fd, "specify", "specified", "extension")
        self.assertIsNone(result)
        self.assertEqual(_ctx(self.fd), before)

    def test_unknown_keys_preserved(self) -> None:
        wc.update_context(self.fd, "specify", "specified", "extension")
        target = self.fd / ".spec-context.json"
        ctx = _ctx(self.fd)
        ctx["reviewComments"] = [{"id": "rc1", "comment": "keep me"}]
        target.write_text(json.dumps(ctx))
        wc.update_context(self.fd, "plan", "planned", "extension")
        self.assertEqual(_ctx(self.fd)["reviewComments"], [{"id": "rc1", "comment": "keep me"}])

    def test_per_task_writes_single_finish_per_task(self) -> None:
        # Finish-only: the backstop journals each fresh task as ONE `complete`
        # event (no start+complete pair → no 0s tick).
        (self.fd / "tasks.md").write_text(
            _tasks("- [x] **T001** a", "- [x] **T002** b", "- [ ] **T003** c")
        )
        tasks_md = self.fd / "tasks.md"
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        distinct = list(dict.fromkeys(t["task"] for t in _ctx(self.fd)["history"] if t.get("task")))
        self.assertEqual(distinct, ["T001", "T002"])
        for tid in ("T001", "T002"):
            kinds = [t["kind"] for t in _ctx(self.fd)["history"] if t.get("task") == tid]
            self.assertEqual(kinds, ["complete"])
        self.assertEqual(_ctx(self.fd)["status"], "implementing")
        self.assertEqual(_ctx(self.fd)["currentTask"], "T003")
        # Idempotent: a second sync adds nothing.
        before = len(_ctx(self.fd)["history"])
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        self.assertEqual(len(_ctx(self.fd)["history"]), before)

    def test_journal_task_finish_single_event_and_idempotent(self) -> None:
        # Live path: one finish event per task, no per-task start; re-running is a no-op.
        wc.update_context(self.fd, "implement", "implementing", "extension")
        wc.journal_task_finish(self.fd, "T001", "ai")
        wc.journal_task_finish(self.fd, "T001", "ai")  # idempotent
        t001 = [t for t in _ctx(self.fd)["history"] if t.get("task") == "T001"]
        self.assertEqual([t["kind"] for t in t001], ["complete"])
        self.assertEqual(t001[0]["by"], "ai")
        self.assertEqual(_ctx(self.fd)["currentTask"], "T001")

    def test_journal_task_writes_activity_panel_task_summary(self) -> None:
        # #256: the script must write `task_summaries.<id>` (the field the Activity
        # panel's Tasks card reads) in the same call that journals the finish — so the
        # panel is populated without a skippable hand-authored .spec-context.json edit.
        # Shape must match TaskSummary { status; did?; files? } keyed by task id, the
        # contract verified against specs/138-harden-capture-shape.
        wc.update_context(self.fd, "implement", "implementing", "extension")
        wc.journal_task_finish(
            self.fd, "T001", "ai",
            did="Added X to the writer",
            files=["src/a.ts", "src/b.ts"],
        )
        ctx = _ctx(self.fd)
        # 1. task_summaries entry has the exact reader shape, keyed by task id.
        self.assertIn("task_summaries", ctx)
        self.assertEqual(set(ctx["task_summaries"].keys()), {"T001"})
        self.assertEqual(
            ctx["task_summaries"]["T001"],
            {"status": "DONE", "did": "Added X to the writer",
             "files": ["src/a.ts", "src/b.ts"]},
        )
        # 2. The history finish event is still recorded (no regression to journaling).
        t001 = [t for t in ctx["history"] if t.get("task") == "T001"]
        self.assertEqual([t["kind"] for t in t001], ["complete"])

    def test_journal_task_summary_idempotent_and_preserves_other_keys(self) -> None:
        # Re-journaling updates the single keyed entry (never a duplicate key) and
        # leaves other tasks' summaries untouched; a finish with no did/files still
        # records a {status} entry so the task at least appears in the panel.
        wc.update_context(self.fd, "implement", "implementing", "extension")
        wc.journal_task_finish(self.fd, "T001", "ai", did="first", files=["a.ts"])
        wc.journal_task_finish(self.fd, "T002", "ai")  # no did/files
        # Re-run T001 — single history finish stays single; summary upserts in place.
        wc.journal_task_finish(self.fd, "T001", "ai", did="second", files=["a.ts", "c.ts"])
        ctx = _ctx(self.fd)
        self.assertEqual(set(ctx["task_summaries"].keys()), {"T001", "T002"})
        self.assertEqual(ctx["task_summaries"]["T001"]["did"], "second")
        self.assertEqual(ctx["task_summaries"]["T002"], {"status": "DONE"})
        t001 = [t for t in ctx["history"] if t.get("task") == "T001"]
        self.assertEqual(len(t001), 1, "history finish must stay single on re-journal")

    def test_journal_task_summary_merge_is_non_destructive(self) -> None:
        # #256 review (Copilot): a re-journal must MERGE, not replace. Re-running a
        # task without --did/--files must NOT erase previously-recorded did/files, and
        # a hand-authored `concerns` field (which the panel reads) must survive.
        wc.update_context(self.fd, "implement", "implementing", "extension")
        wc.journal_task_finish(self.fd, "T001", "ai", did="did the thing", files=["a.ts"])
        # Simulate a hand-authored concerns note on the same entry.
        target = self.fd / ".spec-context.json"
        ctx0 = json.loads(target.read_text())
        ctx0["task_summaries"]["T001"]["concerns"] = ["watch perf"]
        target.write_text(json.dumps(ctx0))
        # Re-journal with NO did/files — prior fields must be preserved, not erased.
        wc.journal_task_finish(self.fd, "T001", "ai")
        entry = _ctx(self.fd)["task_summaries"]["T001"]
        self.assertEqual(entry["did"], "did the thing", "did must not be erased on bare re-journal")
        self.assertEqual(entry["files"], ["a.ts"], "files must not be erased on bare re-journal")
        self.assertEqual(entry["concerns"], ["watch perf"], "hand-authored concerns must survive")
        self.assertEqual(entry["status"], "DONE")

    def test_backstop_journals_after_implement_self_closed(self) -> None:
        # Same-step guard: status already "implemented" must NOT block per-task
        # journaling (the backstop fills the journal regardless of AI behavior).
        target = self.fd / ".spec-context.json"
        wc.update_context(self.fd, "implement", "implementing", "extension")
        wc.journal_task_finish(self.fd, "T001", "ai")  # one task live-journaled
        ctx = _ctx(self.fd)
        ctx["status"] = "implemented"  # AI self-closed before the rest were journaled
        target.write_text(json.dumps(ctx))
        tasks_md = self.fd / "tasks.md"
        tasks_md.write_text(_tasks("- [x] **T001** a", "- [x] **T002** b", "- [x] **T003** c"))
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        distinct = list(dict.fromkeys(t["task"] for t in _ctx(self.fd)["history"] if t.get("task")))
        self.assertEqual(distinct, ["T001", "T002", "T003"])  # backstop filled T002, T003
        t001 = [t for t in _ctx(self.fd)["history"] if t.get("task") == "T001"]
        self.assertEqual(len(t001), 1, "live T001 must not be duplicated by the backstop")

    def test_cross_step_terminal_blocks_per_task(self) -> None:
        # A genuinely shipped spec (completed/archived) is never resurrected.
        target = self.fd / ".spec-context.json"
        wc.update_context(self.fd, "implement", "implementing", "extension")
        ctx = _ctx(self.fd)
        ctx["status"] = "completed"
        target.write_text(json.dumps(ctx))
        wc.journal_task_finish(self.fd, "T009", "ai")
        self.assertFalse(any(t.get("task") == "T009" for t in _ctx(self.fd)["history"]))

    def test_parse_task_markers_accepts_plain_and_bold(self) -> None:
        # The standard tasks-template writes plain `- [x] T001`; the turbo/companion
        # bodies write bold `- [x] **T001**`. Both formats must be detected, and a
        # checkbox without a task id is ignored.
        (self.fd / "tasks.md").write_text(_tasks(
            "- [x] T001 plain done",
            "- [ ] T002 plain pending",
            "- [x] **T003** bold done",
            "- [x] Setup something (no id, ignored)",
        ))
        all_ids, done_ids = wc.parse_task_markers(self.fd / "tasks.md")
        self.assertEqual(all_ids, ["T001", "T002", "T003"])
        self.assertEqual(done_ids, ["T001", "T003"])

    def test_sync_tasks_journals_plain_format(self) -> None:
        # A standard-format (non-bold) tasks.md must journal per-task finishes and
        # close the implement step — the marker-format gap fix.
        (self.fd / "tasks.md").write_text(_tasks(
            "- [x] T001 [P] do one",
            "- [x] T002 do two",
        ))
        wc.sync_tasks(self.fd, self.fd / "tasks.md", "implemented", "extension")
        ctx = _ctx(self.fd)
        distinct = list(dict.fromkeys(t["task"] for t in ctx["history"] if t.get("task")))
        self.assertEqual(distinct, ["T001", "T002"])
        for tid in ("T001", "T002"):
            kinds = [t["kind"] for t in ctx["history"] if t.get("task") == tid]
            self.assertEqual(kinds, ["complete"])  # finish-only, no 0s pair
        self.assertEqual(ctx["status"], "implemented")  # all checked → step closed

    def test_hook_skips_tasks_already_journaled(self) -> None:
        # If a task id is already journaled (e.g. a leftover live entry), the hook
        # must treat it as a no-op backstop — dedupe on the task id, not re-add it.
        target = self.fd / ".spec-context.json"
        wc.update_context(self.fd, "implement", "implementing", "extension")
        ctx = _ctx(self.fd)
        ctx["history"].append({
            "step": "implement", "substep": "T001", "task": "T001",
            "kind": "start", "by": "ai", "at": "2026-06-07T10:00:00.000Z",
        })
        target.write_text(json.dumps(ctx))
        tasks_md = self.fd / "tasks.md"
        tasks_md.write_text(_tasks("- [x] **T001** a", "- [x] **T002** b"))
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        t001 = [t for t in _ctx(self.fd)["history"] if t.get("task") == "T001"]
        self.assertEqual(len(t001), 1, "hook must not duplicate the already-journaled T001")
        self.assertEqual(t001[0]["by"], "ai")
        distinct = list(dict.fromkeys(t["task"] for t in _ctx(self.fd)["history"] if t.get("task")))
        self.assertEqual(distinct, ["T001", "T002"])

    def test_per_task_completes_when_all_checked(self) -> None:
        tasks_md = self.fd / "tasks.md"
        tasks_md.write_text(_tasks("- [x] **T001** a", "- [x] **T002** b"))
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        self.assertEqual(_ctx(self.fd)["status"], "implemented")
        # The hook owns the implement self-close: a single step-level complete lands.
        # A step-level complete is substep None AND task None — per-task finishes now
        # also carry substep None (the id lives in `task`), so they must be excluded
        # or they'd be miscounted as step completions (#138).
        step_completes = [
            t for t in _ctx(self.fd)["history"]
            if t["step"] == "implement" and t["substep"] is None
            and t.get("task") is None and t["kind"] == "complete"
        ]
        self.assertEqual(len(step_completes), 1)

    def test_step_complete_only_when_all_tasks_done(self) -> None:
        tasks_md = self.fd / "tasks.md"
        tasks_md.write_text(_tasks("- [x] **T001** a", "- [ ] **T002** b"))
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        # Step-level complete = substep None AND task None; T001's per-task finish
        # (substep None, task set) must NOT be miscounted as the step's self-close.
        step_completes = [
            t for t in _ctx(self.fd)["history"]
            if t["step"] == "implement" and t["substep"] is None
            and t.get("task") is None and t["kind"] == "complete"
        ]
        self.assertEqual(step_completes, [], "implement must not self-close while tasks remain")

    def test_per_task_entries_are_substeps_not_step_completions(self) -> None:
        # #138 moved the per-task id off `substep` and into its own `task` field;
        # a per-task entry now carries `task` (the id) with `substep` None. It must
        # still be distinguishable from a step-level complete (which has BOTH
        # substep and task None) so the viewer never renders implement done while
        # tasks remain — that distinction is the carried `task` id.
        tasks_md = self.fd / "tasks.md"
        tasks_md.write_text(_tasks("- [x] **T001** a", "- [x] **T002** b", "- [ ] **T003** c"))
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        per_task = [t for t in _ctx(self.fd)["history"] if t.get("task")]
        self.assertEqual([t["task"] for t in per_task], ["T001", "T002"])
        for t in per_task:
            self.assertIsNotNone(t["task"])
            self.assertIsNone(t["substep"])
            # A per-task entry must never read as a step-level boundary.
            self.assertFalse(wc._is_step_level(t))

    def test_duplicate_marker_id_yields_one_task(self) -> None:
        tasks_md = self.fd / "tasks.md"
        tasks_md.write_text(_tasks("- [x] **T001** a", "- [x] **T001** a (re-listed)"))
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        distinct = list(dict.fromkeys(t["task"] for t in _ctx(self.fd)["history"] if t.get("task")))
        self.assertEqual(distinct, ["T001"])

    def test_duplicate_id_one_unchecked_is_not_100(self) -> None:
        # Per-occurrence verdict: the same id checked once and pending once is NOT
        # 100%, so sync_tasks must leave status implementing and not self-close.
        tasks_md = self.fd / "tasks.md"
        tasks_md.write_text(_tasks("- [x] **T001** a", "- [ ] **T001** a (re-listed)"))
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["status"], "implementing")
        step_completes = [
            t for t in ctx["history"]
            if t["step"] == "implement" and t["substep"] is None
            and t.get("task") is None and t["kind"] == "complete"
        ]
        self.assertEqual(step_completes, [], "a duplicate id with one pending marker is not 100%")

    def test_kind_complete_appends_step_complete(self) -> None:
        # A `--kind complete` write appends a step-level complete, flips status,
        # and is idempotent (no second complete on a re-run).
        wc.update_context(self.fd, "specify", "specifying", "extension", "start")
        wc.update_context(self.fd, "specify", "specified", "extension", "complete")
        completes = [
            t for t in _ctx(self.fd)["history"]
            if t["step"] == "specify" and t["kind"] == "complete"
        ]
        self.assertEqual(len(completes), 1)
        self.assertNotIn("from", completes[0])
        self.assertEqual(_ctx(self.fd)["status"], "specified")
        wc.update_context(self.fd, "specify", "specified", "extension", "complete")
        completes = [
            t for t in _ctx(self.fd)["history"]
            if t["step"] == "specify" and t["kind"] == "complete"
        ]
        self.assertEqual(len(completes), 1, "complete must be idempotent")

    def test_plan_body_start_then_hook_complete_is_one_ordered_pair(self) -> None:
        # Body records the start, the after-plan hook the complete: one extension-stamped pair, in order.
        wc.update_context(self.fd, "specify", "specified", "extension", "complete")
        wc.update_context(self.fd, "plan", "planning", "extension", "start")
        wc.update_context(self.fd, "plan", "planned", "extension", "complete")
        plan = [t for t in _ctx(self.fd)["history"]
                if t["step"] == "plan" and t["substep"] is None]
        self.assertEqual([t["kind"] for t in plan], ["start", "complete"])
        self.assertEqual([t["by"] for t in plan], ["extension", "extension"])
        self.assertLessEqual(plan[0]["at"], plan[1]["at"])
        self.assertEqual(_ctx(self.fd)["status"], "planned")

    def test_earlier_ai_self_close_blocks_the_hook_complete(self) -> None:
        # First writer wins on the idempotent complete — why extension-stamped steps must never be AI self-closed.
        wc.update_context(self.fd, "plan", "planning", "extension", "start")
        wc.journal_finish(self.fd, "plan", "ai")
        wc.update_context(self.fd, "plan", "planned", "extension", "complete")
        completes = [t for t in _ctx(self.fd)["history"]
                     if t["step"] == "plan" and t["substep"] is None
                     and t["kind"] == "complete"]
        self.assertEqual(len(completes), 1)
        self.assertEqual(completes[0]["by"], "ai")

    def test_specify_self_close_span_collapses_late_hook_start(self) -> None:
        # The terminal order is body start -> body complete -> (late) after_specify
        # hook start. The hook start lands AFTER the complete, which the old
        # last-entry-only dedup missed; the broadened dedup collapses it so specify
        # has exactly one start + one complete (a real begin->end span).
        wc.update_context(self.fd, "specify", "specifying", "extension", "start")
        wc.update_context(self.fd, "specify", "specified", "extension", "complete")
        wc.update_context(self.fd, "specify", "specified", "extension", "start")  # late hook
        starts = [t for t in _ctx(self.fd)["history"]
                  if t["step"] == "specify" and t["substep"] is None and t["kind"] == "start"]
        completes = [t for t in _ctx(self.fd)["history"]
                     if t["step"] == "specify" and t["kind"] == "complete"]
        self.assertEqual(len(starts), 1)
        self.assertEqual(len(completes), 1)

    def test_dedup_recognizes_legacy_kindless_entries(self) -> None:
        # A migrated spec may carry kind-less entries (self-loop = complete). The
        # broadened dedup must read those via the legacy convention so it does not
        # append a duplicate start or complete on top of them.
        target = self.fd / ".spec-context.json"
        target.write_text(json.dumps({
            "workflow": "speckit", "specName": "x", "branch": "main",
            "currentStep": "specify", "status": "specified",
            "history": [
                {"step": "specify", "substep": None, "from": {"step": None, "substep": None}, "by": "ai", "at": "2026-06-07T10:00:00.000Z"},
                {"step": "specify", "substep": None, "from": {"step": "specify", "substep": None}, "by": "ai", "at": "2026-06-07T10:01:00.000Z"},
            ],
        }))
        # The legacy log already has a specify start (entry 1) + complete (self-loop).
        wc.update_context(self.fd, "specify", "specifying", "extension", "start")
        wc.update_context(self.fd, "specify", "specified", "extension", "complete")
        starts = [e for e in _ctx(self.fd)["history"]
                  if e["step"] == "specify" and e["substep"] is None and wc._entry_kind(e) == "start"]
        completes = [e for e in _ctx(self.fd)["history"]
                     if e["step"] == "specify" and e["substep"] is None and wc._entry_kind(e) == "complete"]
        self.assertEqual(len(starts), 1, "must not add a start over a legacy start")
        self.assertEqual(len(completes), 1, "must not add a complete over a legacy self-loop complete")

    def test_kind_complete_respects_no_backward_clobber(self) -> None:
        # A late specify complete must never drag a shipped (implemented) spec back.
        wc.update_context(self.fd, "implement", "implemented", "extension", "complete")
        before = _ctx(self.fd)
        wc.update_context(self.fd, "specify", "specified", "extension", "complete")
        self.assertEqual(_ctx(self.fd), before, "no-backward-clobber must hold for completes")


class SetFieldsTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fd = Path(self._tmp.name) / "specs" / "_zzz-set"
        self.fd.mkdir(parents=True)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_coerces_bool_int_null_else_string(self) -> None:
        self.assertIs(wc._coerce_value("true"), True)
        self.assertIs(wc._coerce_value("false"), False)
        self.assertIsNone(wc._coerce_value("null"))
        self.assertIsNone(wc._coerce_value("none"))
        self.assertEqual(wc._coerce_value("42"), 42)
        self.assertEqual(wc._coerce_value("-7"), -7)
        self.assertEqual(wc._coerce_value("hello"), "hello")
        # Malformed numerics fall back to string, never raise.
        self.assertEqual(wc._coerce_value("1-2"), "1-2")
        self.assertEqual(wc._coerce_value("3.14"), "3.14")

    def test_set_records_field_without_touching_lifecycle(self) -> None:
        wc.update_context(self.fd, "specify", "specified", "extension")
        before = _ctx(self.fd)
        wc.set_fields(self.fd, ["unattended=true"])
        ctx = _ctx(self.fd)
        self.assertIs(ctx["unattended"], True)
        # Lifecycle log + status + step are byte-for-byte untouched.
        self.assertEqual(ctx["history"], before["history"])
        self.assertEqual(ctx["status"], before["status"])
        self.assertEqual(ctx["currentStep"], before["currentStep"])

    def test_set_refuses_lifecycle_keys(self) -> None:
        wc.update_context(self.fd, "specify", "specified", "extension")
        before = _ctx(self.fd)
        wc.set_fields(self.fd, ["status=completed", "currentStep=implement", "history=[]"])
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["status"], before["status"])
        self.assertEqual(ctx["currentStep"], before["currentStep"])
        self.assertEqual(ctx["history"], before["history"])

    def test_set_skips_malformed_pair(self) -> None:
        wc.update_context(self.fd, "specify", "specified", "extension")
        wc.set_fields(self.fd, ["noequals", "kept=ok"])
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["kept"], "ok")
        self.assertNotIn("noequals", ctx)


class DeriveRoundTripTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fd = Path(self._tmp.name) / "specs" / "_zzz-derive"
        self.fd.mkdir(parents=True)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_derive_partial_tasks(self) -> None:
        (self.fd / "spec.md").write_text("# Spec\n")
        (self.fd / "plan.md").write_text("# Plan\n")
        (self.fd / "tasks.md").write_text(_tasks("- [x] **T001** a", "- [ ] **T002** b"))
        derive_mod.derive(self.fd)
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["currentStep"], "tasks")
        self.assertEqual(ctx["status"], "ready-to-implement")

    def test_derive_all_tasks_done(self) -> None:
        (self.fd / "spec.md").write_text("# Spec\n")
        (self.fd / "plan.md").write_text("# Plan\n")
        (self.fd / "tasks.md").write_text(_tasks("- [x] **T001** a", "- [x] **T002** b"))
        derive_mod.derive(self.fd)
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["currentStep"], "implement")
        self.assertEqual(ctx["status"], "implemented")
        distinct = list(dict.fromkeys(t["task"] for t in ctx["history"] if t.get("task")))
        self.assertEqual(distinct, ["T001", "T002"])
        # Finish-only: each task derives a SINGLE `complete` event (no 0s start+
        # complete pair), matching write-context.py sync_tasks (#138).
        for tid in ("T001", "T002"):
            kinds = [t["kind"] for t in ctx["history"] if t.get("task") == tid]
            self.assertEqual(kinds, ["complete"])
        self.assertTrue(any(t.get("by") == "derive" for t in ctx["history"]))

    def test_derive_distinct_id_coverage_matches_sync(self) -> None:
        # A duplicated checked id + a genuinely pending id is NOT done — derive
        # must use the same distinct-id coverage as sync_tasks.
        (self.fd / "spec.md").write_text("# Spec\n")
        (self.fd / "plan.md").write_text("# Plan\n")
        (self.fd / "tasks.md").write_text(
            _tasks("- [x] **T001** a", "- [x] **T001** a (dup)", "- [ ] **T002** b")
        )
        derive_mod.derive(self.fd)
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["currentStep"], "tasks")
        self.assertEqual(ctx["status"], "ready-to-implement")

    def test_derive_spec_only(self) -> None:
        (self.fd / "spec.md").write_text("# Spec\n")
        derive_mod.derive(self.fd)
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["currentStep"], "specify")
        self.assertEqual(ctx["status"], "specified")

    def test_derive_round_trip_after_deleting_state(self) -> None:
        (self.fd / "spec.md").write_text("# Spec\n")
        (self.fd / "plan.md").write_text("# Plan\n")
        (self.fd / "tasks.md").write_text(_tasks("- [x] **T001** a", "- [x] **T002** b"))
        wc.sync_tasks(self.fd, self.fd / "tasks.md", "implemented", "extension")
        (self.fd / ".spec-context.json").unlink()
        derive_mod.derive(self.fd)
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["currentStep"], "implement")
        self.assertEqual(ctx["status"], "implemented")

    def test_derive_does_not_regress_terminal(self) -> None:
        (self.fd / "spec.md").write_text("# Spec\n")
        wc.update_context(self.fd, "implement", "implemented", "extension")
        before = _ctx(self.fd)
        result = derive_mod.derive(self.fd)
        self.assertIsNone(result)
        self.assertEqual(_ctx(self.fd), before)


status_mod = importlib.import_module("status-context")


class StatusResolveTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fd = Path(self._tmp.name) / "specs" / "_zzz-test"
        self.fd.mkdir(parents=True)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_reads_recorded_state_and_decisions(self) -> None:
        (self.fd / "spec.md").write_text("# Spec\n")
        (self.fd / "plan.md").write_text("# Plan\n")  # artifacts agree with recorded plan/planned
        wc.update_context(self.fd, "plan", "planned", "extension")
        ctx = _ctx(self.fd)
        ctx["decisions"] = ["Use the existing dispatch path", "No new schema field"]
        (self.fd / ".spec-context.json").write_text(json.dumps(ctx))
        res = status_mod.resolve(self.fd)
        self.assertEqual(res["source"], "state")
        self.assertEqual(res["currentStep"], "plan")
        self.assertEqual(res["nextCommand"], "/speckit.tasks")
        self.assertEqual(res["decisions"], ["Use the existing dispatch path", "No new schema field"])

    def test_next_step_rows(self) -> None:
        rows = {
            ("specify", "specified"): "/speckit.plan",
            ("plan", "planned"): "/speckit.tasks",
            ("tasks", "ready-to-implement"): "/speckit.implement",
        }
        for (step, status), expected in rows.items():
            wc.update_context(self.fd, step, status, "extension")
            res = status_mod.resolve(self.fd)
            self.assertEqual(res["nextCommand"], expected, f"{step}/{status}")
            self.assertFalse(res["complete"], f"{step}/{status}")
            (self.fd / ".spec-context.json").unlink()

    def test_in_progress_finishes_current_step(self) -> None:
        (self.fd / "spec.md").write_text("# Spec\n")
        (self.fd / "plan.md").write_text("# Plan\n")  # artifact present so FR-011 keeps the in-progress plan state
        wc.update_context(self.fd, "plan", "planning", "extension")
        res = status_mod.resolve(self.fd)
        self.assertEqual(res["source"], "state")
        self.assertEqual(res["nextStep"], "plan")
        self.assertEqual(res["nextCommand"], "/speckit.plan")
        self.assertFalse(res["complete"])

    def test_derive_fallback_when_state_missing(self) -> None:
        (self.fd / "spec.md").write_text("# Spec\n")
        (self.fd / "plan.md").write_text("# Plan\n")
        res = status_mod.resolve(self.fd)
        self.assertEqual(res["source"], "derived")
        self.assertEqual(res["currentStep"], "plan")
        self.assertEqual(res["nextCommand"], "/speckit.tasks")

    def test_tasks_step_next_unchecked_task(self) -> None:
        (self.fd / "tasks.md").write_text(
            _tasks("- [x] **T001** a", "- [ ] **T002** b", "- [ ] **T003** c")
        )
        wc.update_context(self.fd, "implement", "implementing", "extension")
        res = status_mod.resolve(self.fd)
        self.assertEqual(res["nextTask"], "T002")
        self.assertEqual(res["nextCommand"], "/speckit.implement")
        self.assertFalse(res["complete"])

    def test_implement_all_done_is_complete(self) -> None:
        (self.fd / "tasks.md").write_text(_tasks("- [x] **T001** a", "- [x] **T002** b"))
        wc.update_context(self.fd, "implement", "implementing", "extension")
        res = status_mod.resolve(self.fd)
        self.assertTrue(res["complete"])
        self.assertIsNone(res["nextCommand"])
        self.assertIsNone(res["nextTask"])

    def test_terminal_status_is_complete(self) -> None:
        for status in ("implemented", "completed", "archived"):
            wc.update_context(self.fd, "tasks", "ready-to-implement", "extension")
            ctx = _ctx(self.fd)
            ctx["status"] = status
            (self.fd / ".spec-context.json").write_text(json.dumps(ctx))
            res = status_mod.resolve(self.fd)
            self.assertTrue(res["complete"], status)
            self.assertEqual(res["nextActionLabel"], "Pipeline complete", status)
            (self.fd / ".spec-context.json").unlink()

    def test_no_files_is_empty(self) -> None:
        res = status_mod.resolve(self.fd)
        self.assertTrue(res["empty"])
        self.assertEqual(res["source"], "derived")
        self.assertIsNone(res["currentStep"])

    def test_fr011_prefers_disk_when_recorded_is_behind(self) -> None:
        # State says plan/planned, but tasks.md exists on disk — prefer disk.
        (self.fd / "spec.md").write_text("# Spec\n")
        (self.fd / "plan.md").write_text("# Plan\n")
        (self.fd / "tasks.md").write_text(_tasks("- [ ] **T001** a"))
        wc.update_context(self.fd, "plan", "planned", "extension")
        res = status_mod.resolve(self.fd)
        self.assertEqual(res["source"], "derived")
        self.assertEqual(res["currentStep"], "tasks")
        self.assertEqual(res["nextCommand"], "/speckit.implement")

    def test_fr011_prefers_disk_when_recorded_artifact_missing(self) -> None:
        # State says plan/planned, but plan.md is absent — recorded is impossible.
        (self.fd / "spec.md").write_text("# Spec\n")
        wc.update_context(self.fd, "plan", "planned", "extension")
        res = status_mod.resolve(self.fd)
        self.assertEqual(res["source"], "derived")
        self.assertEqual(res["currentStep"], "specify")
        self.assertEqual(res["nextCommand"], "/speckit.plan")

    def test_fr011_keeps_recorded_when_artifacts_agree(self) -> None:
        (self.fd / "spec.md").write_text("# Spec\n")
        (self.fd / "plan.md").write_text("# Plan\n")
        wc.update_context(self.fd, "plan", "planned", "extension")
        res = status_mod.resolve(self.fd)
        self.assertEqual(res["source"], "state")
        self.assertEqual(res["currentStep"], "plan")

    def test_fr011_keeps_in_progress_implement_over_tasks_artifact(self) -> None:
        # implement/implementing against a partial tasks.md must NOT downgrade —
        # disk can't see in-progress work.
        (self.fd / "spec.md").write_text("# Spec\n")
        (self.fd / "plan.md").write_text("# Plan\n")
        (self.fd / "tasks.md").write_text(_tasks("- [x] **T001** a", "- [ ] **T002** b"))
        wc.update_context(self.fd, "implement", "implementing", "extension")
        res = status_mod.resolve(self.fd)
        self.assertEqual(res["source"], "state")
        self.assertEqual(res["currentStep"], "implement")
        self.assertEqual(res["nextTask"], "T002")


class TasksFileResolvesFeatureDirTests(unittest.TestCase):
    """Child 2 (#277): task-sync mode settles the spec whose tasks.md is passed,
    NOT whichever spec the active-feature pointer names."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.specs = self.root / "specs"
        # The spec we hand --tasks-file for (the one that should settle).
        self.target = self.specs / "016-target"
        self.target.mkdir(parents=True)
        (self.target / "tasks.md").write_text(_tasks("- [x] **T001** a", "- [x] **T002** b"))
        # A DIFFERENT spec the active-feature pointer would resolve to.
        self.active = self.specs / "017-active"
        self.active.mkdir(parents=True)
        (self.active / "tasks.md").write_text(_tasks("- [ ] **T001** a"))

        self._orig_root = wc._repo_root
        self._orig_resolve = wc.resolve_feature_dir
        wc._repo_root = lambda: self.root

        # Simulate the active-feature pointer landing on the LATER spec when no
        # --feature-dir is given; honor an explicit --feature-dir when supplied
        # (so the mismatch-vs-match branches exercise real path comparison).
        def _resolve(root: Path, explicit: str | None) -> Path:
            if explicit:
                p = Path(explicit)
                return p if p.is_absolute() else root / p
            return self.active
        wc.resolve_feature_dir = _resolve

    def tearDown(self) -> None:
        wc._repo_root = self._orig_root
        wc.resolve_feature_dir = self._orig_resolve
        self._tmp.cleanup()

    def _run(self, argv: list[str]) -> int:
        orig_argv = sys.argv
        sys.argv = ["write-context.py", *argv]
        try:
            return wc.main()
        finally:
            sys.argv = orig_argv

    def test_tasks_file_dir_wins_over_active_pointer(self) -> None:
        rc = self._run([
            "--step", "implement", "--status", "implemented", "--by", "extension",
            "--tasks-file", "specs/016-target/tasks.md",
        ])
        self.assertEqual(rc, 0)
        # The TARGET spec settled; the ACTIVE spec was never touched.
        self.assertTrue((self.target / ".spec-context.json").is_file())
        self.assertFalse((self.active / ".spec-context.json").is_file())
        ctx = _ctx(self.target)
        self.assertEqual(ctx["status"], "implemented")

    def test_feature_dir_mismatch_refuses_to_write(self) -> None:
        rc = self._run([
            "--step", "implement", "--status", "implemented", "--by", "extension",
            "--tasks-file", "specs/016-target/tasks.md",
            "--feature-dir", "specs/017-active",
        ])
        self.assertEqual(rc, 0)  # best-effort: never fails the host
        # Neither spec was settled — the mismatch was surfaced, not absorbed.
        self.assertFalse((self.target / ".spec-context.json").is_file())
        self.assertFalse((self.active / ".spec-context.json").is_file())

    def test_feature_dir_matching_tasks_file_still_writes(self) -> None:
        rc = self._run([
            "--step", "implement", "--status", "implemented", "--by", "extension",
            "--tasks-file", "specs/016-target/tasks.md",
            "--feature-dir", "specs/016-target",
        ])
        self.assertEqual(rc, 0)
        self.assertTrue((self.target / ".spec-context.json").is_file())
        self.assertEqual(_ctx(self.target)["status"], "implemented")


class MarkCompleteTests(unittest.TestCase):
    """`mark_spec_complete` / `--mark-complete`: the only sanctioned writer of
    `status: completed`. Promotes a finished spec, preserves the canonical
    invariant (last history step == currentStep), and is idempotent."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fd = Path(self._tmp.name) / "specs" / "_zzz-test"
        self.fd.mkdir(parents=True)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _implemented_spec(self) -> None:
        # Drive a spec to the implement step's own terminal (`implemented`).
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.update_context(self.fd, "implement", "implemented", "extension", "complete")

    def test_promotes_implemented_to_completed(self) -> None:
        self._implemented_spec()
        result = wc.mark_spec_complete(self.fd, "ai")
        self.assertIsNotNone(result)
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["status"], "completed")
        # Invariant: currentStep stays at the last real step (implement), which is
        # the last history entry's step — so last-history-step == currentStep holds.
        self.assertEqual(ctx["currentStep"], "implement")
        self.assertEqual(ctx["history"][-1]["step"], "implement")

    def test_history_is_untouched(self) -> None:
        self._implemented_spec()
        before = list(_ctx(self.fd)["history"])
        wc.mark_spec_complete(self.fd, "ai")
        # mark-complete writes no history entry — the log is byte-for-byte preserved.
        self.assertEqual(_ctx(self.fd)["history"], before)

    def test_idempotent_on_completed(self) -> None:
        self._implemented_spec()
        wc.mark_spec_complete(self.fd, "ai")
        before = _ctx(self.fd)
        result = wc.mark_spec_complete(self.fd, "ai")
        self.assertIsNone(result)
        self.assertEqual(_ctx(self.fd), before)

    def test_idempotent_on_archived(self) -> None:
        target = self.fd / ".spec-context.json"
        self._implemented_spec()
        ctx = _ctx(self.fd)
        ctx["status"] = "archived"
        target.write_text(json.dumps(ctx))
        before = _ctx(self.fd)
        result = wc.mark_spec_complete(self.fd, "ai")
        self.assertIsNone(result, "an archived spec must not be regressed to completed")
        self.assertEqual(_ctx(self.fd), before)

    def test_unknown_keys_preserved(self) -> None:
        target = self.fd / ".spec-context.json"
        self._implemented_spec()
        ctx = _ctx(self.fd)
        ctx["reviewComments"] = [{"id": "rc1", "comment": "keep me"}]
        target.write_text(json.dumps(ctx))
        wc.mark_spec_complete(self.fd, "ai")
        out = _ctx(self.fd)
        self.assertEqual(out["reviewComments"], [{"id": "rc1", "comment": "keep me"}])
        self.assertEqual(out["status"], "completed")

    def test_refuses_unfinished_spec(self) -> None:
        # Only a finished implement (`implemented`) may ship. A spec still
        # `implementing` (or specifying/planning) must NOT be promoted, so an
        # out-of-order or stray invocation can't mark incomplete work complete.
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        before = _ctx(self.fd)
        result = wc.mark_spec_complete(self.fd, "ai")
        self.assertIsNone(result)
        self.assertEqual(_ctx(self.fd)["status"], "implementing")
        self.assertEqual(_ctx(self.fd), before)

    def _implementing_all_tasks_done(self) -> None:
        # A spec stuck at `implementing` but with every task marker checked off —
        # the race that left a 100%-done spec unmarkable before the P6 fix.
        (self.fd / "tasks.md").write_text("- [x] **T001** a\n- [x] **T002** b\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")

    def test_promotes_implementing_at_100pct_to_completed(self) -> None:
        # Acceptance (#317 P6): implementing + all tasks [x] -> --mark-complete -> completed.
        self._implementing_all_tasks_done()
        result = wc.mark_spec_complete(self.fd, "ai")
        self.assertIsNotNone(result)
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["status"], "completed")
        # The implement step is closed in history during the atomic promotion.
        impl_completes = [e for e in ctx["history"] if e["step"] == "implement" and e["kind"] == "complete"]
        self.assertTrue(impl_completes, "implement step must be closed before completed")
        self.assertEqual(ctx["currentStep"], "implement")

    def test_refuses_implementing_with_pending_tasks(self) -> None:
        (self.fd / "tasks.md").write_text("- [x] **T001** a\n- [ ] **T002** b\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        result = wc.mark_spec_complete(self.fd, "ai")
        self.assertIsNone(result)
        self.assertEqual(_ctx(self.fd)["status"], "implementing")

    def test_duplicate_id_with_one_unchecked_is_not_100pct(self) -> None:
        # [x] T001 + [ ] T001 must not read as done (set-collapse would hide the pending one).
        (self.fd / "tasks.md").write_text("- [x] **T001** a\n- [ ] **T001** a-again\n")
        self.assertFalse(wc._feature_tasks_at_100(self.fd))
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        self.assertIsNone(wc.mark_spec_complete(self.fd, "ai"))
        self.assertEqual(_ctx(self.fd)["status"], "implementing")

    def test_last_task_finish_lands_at_implemented_not_implementing(self) -> None:
        # journal_task_finish at 100% must not re-assert `implementing` (the race).
        (self.fd / "tasks.md").write_text("- [x] **T001** a\n- [x] **T002** b\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.journal_task_finish(self.fd, "T002", "ai")
        self.assertEqual(_ctx(self.fd)["status"], "implemented")

    def test_step_close_waits_for_all_tasks_journaled_and_lands_last(self) -> None:
        # tasks.md pre-checked 2/2, but the journal lags: the step-level implement
        # complete must NOT appear until every task is journaled, and must land last.
        (self.fd / "tasks.md").write_text("- [x] **T001** a\n- [x] **T002** b\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.journal_task_finish(self.fd, "T001", "ai")
        hist = _ctx(self.fd)["history"]
        self.assertFalse(
            any(e["step"] == "implement" and e["kind"] == "complete" and not e.get("task") for e in hist),
            "step must not close while T002 is still un-journaled",
        )
        wc.journal_task_finish(self.fd, "T002", "ai")
        last = _ctx(self.fd)["history"][-1]
        self.assertEqual((last["step"], last["kind"], last.get("task")), ("implement", "complete", None))

    def test_journaling_a_task_checks_its_box_and_can_close_the_step(self) -> None:
        # The script now owns the checkbox: journaling the only task flips its
        # `- [ ]` → `- [x]` (so tasks.md and the journal can't diverge) and, being
        # the last task, closes the implement step. This replaces the old
        # journaled-but-unchecked divergence guard, which the coupling removes.
        (self.fd / "tasks.md").write_text("- [ ] **T001** a\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.journal_task_finish(self.fd, "T001", "ai")
        ctx = _ctx(self.fd)
        self.assertIn("- [x] **T001** a", (self.fd / "tasks.md").read_text())
        self.assertEqual(ctx["status"], "implemented")
        self.assertEqual(ctx["history"][-1].get("task"), None)  # step-close lands last

    def test_step_does_not_close_when_box_checked_but_not_journaled(self) -> None:
        # The other half of the guard still holds: a box checked WITHOUT a journaled
        # finish (e.g. hand-checked) must NOT close the step — close needs both 100%
        # checked AND every task journaled.
        (self.fd / "tasks.md").write_text("- [x] **T001** a\n- [ ] **T002** b\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.journal_task_finish(self.fd, "T001", "ai")  # only T001 journaled; T002 still pending
        ctx = _ctx(self.fd)
        self.assertFalse(
            any(e["step"] == "implement" and e["kind"] == "complete" and not e.get("task") for e in ctx["history"]),
            "step must not close while T002 is neither checked nor journaled",
        )

    def test_cli_mark_complete_dispatch(self) -> None:
        # The argparse wiring + main() dispatch branch end-to-end.
        self._implemented_spec()
        orig_root, orig_resolve = wc._repo_root, wc.resolve_feature_dir
        wc._repo_root = lambda: Path(self._tmp.name)
        wc.resolve_feature_dir = lambda root, explicit: self.fd
        orig_argv = sys.argv
        sys.argv = ["write-context.py", "--mark-complete", "--by", "ai"]
        try:
            rc = wc.main()
        finally:
            sys.argv = orig_argv
            wc._repo_root, wc.resolve_feature_dir = orig_root, orig_resolve
        self.assertEqual(rc, 0)
        self.assertEqual(_ctx(self.fd)["status"], "completed")


class JournalFinishTests(unittest.TestCase):
    """The script-owned timing self-close (--finish) that replaces hand-edited JSON."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fd = Path(self._tmp.name) / "specs" / "_zzz-test"
        self.fd.mkdir(parents=True)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_substep_finish_appends_without_touching_status(self) -> None:
        wc.update_context(self.fd, "plan", "planning", "extension", "start")
        wc.journal_finish(self.fd, "plan", "ai", substep="research")
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["status"], "planning", "substep finish must NOT change status")
        self.assertEqual(ctx["currentStep"], "plan", "substep finish must NOT change currentStep")
        research = [e for e in ctx["history"] if e.get("substep") == "research"]
        self.assertEqual([e["kind"] for e in research], ["complete"])

    def test_step_level_finish_appends_one_complete(self) -> None:
        wc.update_context(self.fd, "plan", "planning", "extension", "start")
        wc.journal_finish(self.fd, "plan", "ai")
        closes = [e for e in _ctx(self.fd)["history"]
                  if e["step"] == "plan" and e["kind"] == "complete" and e.get("substep") is None and not e.get("task")]
        self.assertEqual(len(closes), 1)

    def test_finish_is_idempotent(self) -> None:
        wc.update_context(self.fd, "plan", "planning", "extension", "start")
        wc.journal_finish(self.fd, "plan", "ai", substep="research")
        wc.journal_finish(self.fd, "plan", "ai", substep="research")
        wc.journal_finish(self.fd, "plan", "ai")
        wc.journal_finish(self.fd, "plan", "ai")
        hist = _ctx(self.fd)["history"]
        self.assertEqual(len([e for e in hist if e.get("substep") == "research"]), 1)
        self.assertEqual(len([e for e in hist if e["kind"] == "complete" and e.get("substep") is None]), 1)

    def test_finish_rejects_non_canonical_step(self) -> None:
        # A typo'd / omitted step (would default to "specify") must not journal junk.
        wc.update_context(self.fd, "plan", "planning", "extension", "start")
        self.assertIsNone(wc.journal_finish(self.fd, "buld", "ai"))
        self.assertFalse(
            any(e.get("step") == "buld" for e in _ctx(self.fd)["history"]),
            "a non-canonical step must never be journaled",
        )

    def test_finish_leaves_shipped_spec_untouched(self) -> None:
        wc.update_context(self.fd, "plan", "planning", "extension", "start")
        target = self.fd / ".spec-context.json"
        ctx0 = json.loads(target.read_text())
        ctx0["status"] = "completed"
        target.write_text(json.dumps(ctx0))
        self.assertIsNone(wc.journal_finish(self.fd, "plan", "ai", substep="research"))
        self.assertEqual(_ctx(self.fd)["status"], "completed")

    def test_cli_finish_dispatch_keeps_single_status_key(self) -> None:
        # The exact corruption we saw in a real run: ensure --finish never adds a
        # second top-level `status` (the JSON stays valid, single-keyed).
        wc.update_context(self.fd, "plan", "planning", "extension", "start")
        orig_root, orig_resolve = wc._repo_root, wc.resolve_feature_dir
        wc._repo_root = lambda: Path(self._tmp.name)
        wc.resolve_feature_dir = lambda root, explicit: self.fd
        orig_argv = sys.argv
        try:
            sys.argv = ["write-context.py", "--feature-dir", str(self.fd),
                        "--step", "plan", "--substep", "research", "--finish", "--by", "ai"]
            self.assertEqual(wc.main(), 0)
        finally:
            sys.argv = orig_argv
            wc._repo_root, wc.resolve_feature_dir = orig_root, orig_resolve
        raw = (self.fd / ".spec-context.json").read_text()
        self.assertEqual(raw.count('"status"'), 1)
        self.assertEqual(_ctx(self.fd)["status"], "planning")


class AdvanceTests(unittest.TestCase):
    """`--advance`: finish a step AND flip status to its canonical completed-status."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fd = Path(self._tmp.name) / "specs" / "_zzz-adv"
        self.fd.mkdir(parents=True)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _completes(self, step: str) -> list:
        return [
            e for e in _ctx(self.fd)["history"]
            if e["step"] == step and e["kind"] == "complete"
            and e.get("substep") is None and not e.get("task")
        ]

    def _starts(self, step: str) -> list:
        return [
            e for e in _ctx(self.fd)["history"]
            if e["step"] == step and e["kind"] == "start"
        ]

    def test_advances_each_canonical_step_to_its_status(self) -> None:
        cases = [
            ("specify", "specifying", "specified"),
            ("plan", "planning", "planned"),
            ("tasks", "tasking", "ready-to-implement"),
            ("implement", "implementing", "implemented"),
        ]
        for step, mid_status, want in cases:
            with self.subTest(step=step):
                self._tmp.cleanup()
                self._tmp = tempfile.TemporaryDirectory()
                self.fd = Path(self._tmp.name) / "specs" / "_zzz-adv"
                self.fd.mkdir(parents=True)
                wc.update_context(self.fd, step, mid_status, "extension", "start")
                wc.journal_advance(self.fd, step, "ai")
                self.assertEqual(_ctx(self.fd)["status"], want)
                self.assertEqual(len(self._completes(step)), 1, "exactly one complete")
                # No start entry added by --advance (the only start is the prior setup one).
                self.assertEqual(len(self._starts(step)), 1)

    def test_advance_is_idempotent(self) -> None:
        wc.update_context(self.fd, "plan", "planning", "extension", "start")
        wc.journal_advance(self.fd, "plan", "ai")
        wc.journal_advance(self.fd, "plan", "ai")
        self.assertEqual(_ctx(self.fd)["status"], "planned")
        self.assertEqual(len(self._completes("plan")), 1, "no second complete on re-run")

    def test_advance_does_not_regress_a_later_spec(self) -> None:
        # Advancing an earlier step (a re-run, or a double-fired hook) on a spec that
        # already moved past it records the finish but must NOT drag status/currentStep
        # backward — the forward-only guard the direct --status path also enforces.
        wc.update_context(self.fd, "plan", "planning", "extension", "start")
        wc.journal_advance(self.fd, "plan", "ai")            # -> planned
        wc.update_context(self.fd, "tasks", "tasking", "extension", "start")
        wc.journal_advance(self.fd, "tasks", "ai")           # -> ready-to-implement, currentStep=tasks
        wc.journal_advance(self.fd, "plan", "ai")            # re-advance the EARLIER step
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["status"], "ready-to-implement", "status not dragged back to planned")
        self.assertEqual(ctx["currentStep"], "tasks", "currentStep not dragged back to plan")
        self.assertEqual(len(self._completes("plan")), 1, "no duplicate plan complete")

    def test_advance_refused_on_terminal_spec(self) -> None:
        for terminal in ("completed", "archived"):
            with self.subTest(status=terminal):
                self._tmp.cleanup()
                self._tmp = tempfile.TemporaryDirectory()
                self.fd = Path(self._tmp.name) / "specs" / "_zzz-adv"
                self.fd.mkdir(parents=True)
                wc.update_context(self.fd, "implement", "implementing", "extension", "start")
                target = self.fd / ".spec-context.json"
                ctx0 = json.loads(target.read_text())
                ctx0["status"] = terminal
                target.write_text(json.dumps(ctx0))
                before = _ctx(self.fd)
                self.assertIsNone(wc.journal_advance(self.fd, "implement", "ai"))
                self.assertEqual(_ctx(self.fd), before, "terminal spec left untouched")

    def test_advance_on_non_status_step_records_finish_only(self) -> None:
        # clarify/analyze have no canonical completed-status: record the finish,
        # leave status untouched (mirrors --finish on a non-canonical-status step).
        for step in ("clarify", "analyze"):
            with self.subTest(step=step):
                self._tmp.cleanup()
                self._tmp = tempfile.TemporaryDirectory()
                self.fd = Path(self._tmp.name) / "specs" / "_zzz-adv"
                self.fd.mkdir(parents=True)
                wc.update_context(self.fd, "plan", "planning", "extension", "start")
                wc.journal_advance(self.fd, step, "ai")
                self.assertEqual(_ctx(self.fd)["status"], "planning", "status unchanged")
                self.assertEqual(len(self._completes(step)), 1, "finish recorded")

    def test_advance_rejects_non_canonical_step(self) -> None:
        wc.update_context(self.fd, "plan", "planning", "extension", "start")
        self.assertIsNone(wc.journal_advance(self.fd, "buld", "ai"))
        self.assertFalse(
            any(e.get("step") == "buld" for e in _ctx(self.fd)["history"]),
        )


class AppendLogMaterializeTests(unittest.TestCase):
    """The parallel-safe append path + the idempotent materializer (#346)."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fd = Path(self._tmp.name) / "specs" / "_zzz-test"
        self.fd.mkdir(parents=True)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_append_writes_jsonl_and_does_not_touch_context(self) -> None:
        # The hot path: --append writes one log line, never reads/writes the json.
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        before = (self.fd / ".spec-context.json").read_text()
        wc.append_task_log(self.fd, "T001", "ai", did="did a", files=["a.ts"])
        wc.append_task_log(self.fd, "T002", "ai")
        # json untouched by the appends (still the start-only snapshot).
        self.assertEqual((self.fd / ".spec-context.json").read_text(), before)
        lines = (self.fd / ".spec-context.events.jsonl").read_text().splitlines()
        self.assertEqual(len(lines), 2)
        first = json.loads(lines[0])
        self.assertEqual((first["task"], first["kind"], first["did"]), ("T001", "complete", "did a"))
        self.assertNotIn("did", json.loads(lines[1]))  # omitted when absent

    def test_materialize_folds_each_line_once_and_is_idempotent(self) -> None:
        (self.fd / "tasks.md").write_text("- [ ] **T001** a\n- [ ] **T002** b\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.append_task_log(self.fd, "T001", "ai", did="did a", files=["a.ts"])
        wc.append_task_log(self.fd, "T002", "ai", did="did b")
        wc.materialize_log(self.fd, "ai")
        ctx = _ctx(self.fd)
        finishes = [e for e in ctx["history"] if e.get("task")]
        self.assertEqual([e["task"] for e in finishes], ["T001", "T002"])
        self.assertEqual(set(ctx["task_summaries"].keys()), {"T001", "T002"})
        self.assertEqual(ctx["task_summaries"]["T001"]["did"], "did a")
        # Re-fold the whole log: dedup on (implement, task) → no growth.
        wc.materialize_log(self.fd, "ai")
        self.assertEqual(len([e for e in _ctx(self.fd)["history"] if e.get("task")]), 2)

    def test_materialize_preserves_each_lines_own_timestamp(self) -> None:
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        log = self.fd / ".spec-context.events.jsonl"
        log.write_text(
            '{"step":"implement","substep":null,"task":"T001","kind":"complete","by":"ai","at":"2026-01-01T00:00:01Z"}\n'
            '{"step":"implement","substep":null,"task":"T002","kind":"complete","by":"ai","at":"2026-01-01T00:05:00Z"}\n'
        )
        wc.materialize_log(self.fd, "ai")
        at = {e["task"]: e["at"] for e in _ctx(self.fd)["history"] if e.get("task")}
        self.assertEqual(at["T001"], "2026-01-01T00:00:01Z")
        self.assertEqual(at["T002"], "2026-01-01T00:05:00Z")  # real finish time, not fold time

    def test_materialize_closes_step_when_all_tasks_checked(self) -> None:
        (self.fd / "tasks.md").write_text("- [x] **T001** a\n- [x] **T002** b\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.append_task_log(self.fd, "T001", "ai")
        wc.append_task_log(self.fd, "T002", "ai")
        wc.materialize_log(self.fd, "ai")
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["status"], "implemented")
        step_closes = [e for e in ctx["history"] if e["step"] == "implement" and e["kind"] == "complete" and not e.get("task")]
        self.assertEqual(len(step_closes), 1)
        self.assertEqual(ctx["history"][-1].get("task"), None)  # step-close lands last

    def test_append_leaves_shipped_spec_untouched(self) -> None:
        # A stray --append after the spec shipped must not orphan a line in the log.
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        target = self.fd / ".spec-context.json"
        ctx0 = json.loads(target.read_text())
        ctx0["status"] = "completed"
        target.write_text(json.dumps(ctx0))
        self.assertIsNone(wc.append_task_log(self.fd, "T999", "ai"))
        self.assertFalse((self.fd / ".spec-context.events.jsonl").exists(),
                         "no events line should be appended to a shipped spec")

    def test_materialize_no_log_is_noop(self) -> None:
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        self.assertIsNone(wc.materialize_log(self.fd, "ai"))

    def test_materialize_does_not_regress_shipped_spec(self) -> None:
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.append_task_log(self.fd, "T001", "ai")
        target = self.fd / ".spec-context.json"
        ctx0 = json.loads(target.read_text())
        ctx0["status"] = "completed"
        target.write_text(json.dumps(ctx0))
        self.assertIsNone(wc.materialize_log(self.fd, "ai"))
        self.assertEqual(_ctx(self.fd)["status"], "completed")

    def test_materialize_checks_off_tasks_md_from_the_log(self) -> None:
        # The script owns the checkboxes: appended finishes flip `- [ ]` → `- [x]`
        # at materialize, so the model/subagent never edits the shared tasks.md.
        (self.fd / "tasks.md").write_text("- [ ] **T001** a\n- [ ] **T002** b\n- [ ] **T003** c\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.append_task_log(self.fd, "T001", "ai")
        wc.append_task_log(self.fd, "T003", "ai")
        wc.materialize_log(self.fd, "ai")
        md = (self.fd / "tasks.md").read_text()
        self.assertIn("- [x] **T001** a", md)
        self.assertIn("- [ ] **T002** b", md)  # not journaled → stays unchecked
        self.assertIn("- [x] **T003** c", md)

    def test_mark_tasks_done_is_idempotent_and_never_unmarks(self) -> None:
        (self.fd / "tasks.md").write_text("- [x] **T001** a\n- [ ] **T002** b\n")
        # Re-marking an already-checked task is a no-op; marking T002 flips only it.
        wc._mark_tasks_done(self.fd / "tasks.md", {"T001", "T002"})
        md = (self.fd / "tasks.md").read_text()
        self.assertEqual(md, "- [x] **T001** a\n- [x] **T002** b\n")
        # An id not present changes nothing.
        wc._mark_tasks_done(self.fd / "tasks.md", {"T999"})
        self.assertEqual((self.fd / "tasks.md").read_text(), md)


class ImplementCloseSingleCompleteTests(unittest.TestCase):
    """The implement step is closed from four independent paths — the live per-task
    path (`journal_task_finish`/`_maybe_close_implement`), the `after_implement`
    end-of-step hook (`update_context` complete branch), the `--materialize` fold,
    and `--mark-complete`. Every one routes its step-level close through the single
    de-duped writer `append_complete`, so driving all four in one run must leave
    exactly ONE step-level implement complete — even when they disagree on `by`
    (a dogfood run once recorded four, a mix of ai/extension). (#357)"""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fd = Path(self._tmp.name) / "specs" / "_zzz-test"
        self.fd.mkdir(parents=True)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _step_completes(self) -> list:
        return [
            e for e in _ctx(self.fd)["history"]
            if e["step"] == "implement" and e.get("substep") is None
            and e.get("task") is None and e["kind"] == "complete"
        ]

    def test_all_four_close_paths_yield_one_step_complete(self) -> None:
        # Live per-task close first (ai), then the hook, the fold, and mark-complete —
        # every later path must dedup against the marker the live path already wrote.
        (self.fd / "tasks.md").write_text("- [ ] **T001** a\n- [ ] **T002** b\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        # 1. live per-task path: the second finish takes tasks to 100% and self-closes.
        wc.journal_task_finish(self.fd, "T001", "ai")
        wc.journal_task_finish(self.fd, "T002", "ai")
        # 2. after_implement end-of-step hook: live-first means status is already
        # `implemented`, so this call no-ops at the regression guard rather than
        # re-closing — the hook's own complete branch is driven by the hook-first test.
        wc.update_context(self.fd, "implement", "implemented", "extension", "complete")
        # 3. --materialize fold of an appended finish.
        wc.append_task_log(self.fd, "T002", "ai")
        wc.materialize_log(self.fd, "ai", quiet=True)
        # 4. --mark-complete (also folds + closes internally).
        wc.mark_spec_complete(self.fd, "ai")
        self.assertEqual(len(self._step_completes()), 1)
        self.assertEqual(_ctx(self.fd)["status"], "completed")

    def test_dedup_is_robust_to_by_when_hook_closes_first(self) -> None:
        # Reverse the order so the hook (by=extension) closes the step BEFORE the
        # later ai paths run: an `ai` and an `extension` step complete are the same
        # event, so the ai paths must NOT append a second marker. The surviving
        # marker is the first writer's (extension), proving the dedup ignores `by`.
        (self.fd / "tasks.md").write_text("- [ ] **T001** a\n- [ ] **T002** b\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.journal_task_finish(self.fd, "T001", "ai")
        # Hook closes the step first, attributed to the extension.
        wc.update_context(self.fd, "implement", "implemented", "extension", "complete")
        # Later ai paths see a step complete already present and must dedup against it.
        wc.journal_task_finish(self.fd, "T002", "ai")
        wc.append_task_log(self.fd, "T002", "ai")
        wc.materialize_log(self.fd, "ai", quiet=True)
        wc.mark_spec_complete(self.fd, "extension")
        completes = self._step_completes()
        self.assertEqual(len(completes), 1)
        self.assertEqual(completes[0]["by"], "extension",
                         "the first writer's marker survives; differing `by` is not a new event")
        self.assertEqual(_ctx(self.fd)["status"], "completed")

    def test_journal_task_finish_also_checks_tasks_md(self) -> None:
        (self.fd / "tasks.md").write_text("- [ ] **T001** a\n- [ ] **T002** b\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.journal_task_finish(self.fd, "T001", "ai")
        md = (self.fd / "tasks.md").read_text()
        self.assertIn("- [x] **T001** a", md)
        self.assertIn("- [ ] **T002** b", md)

    def test_cli_append_then_materialize_dispatch(self) -> None:
        (self.fd / "tasks.md").write_text("- [x] **T001** a\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        orig_root, orig_resolve = wc._repo_root, wc.resolve_feature_dir
        wc._repo_root = lambda: Path(self._tmp.name)
        wc.resolve_feature_dir = lambda root, explicit: self.fd
        orig_argv = sys.argv
        try:
            sys.argv = ["write-context.py", "--feature-dir", str(self.fd),
                        "--task", "T001", "--kind", "complete", "--by", "ai", "--append"]
            self.assertEqual(wc.main(), 0)
            self.assertTrue((self.fd / ".spec-context.events.jsonl").is_file())
            sys.argv = ["write-context.py", "--feature-dir", str(self.fd), "--materialize", "--by", "ai"]
            self.assertEqual(wc.main(), 0)
        finally:
            sys.argv = orig_argv
            wc._repo_root, wc.resolve_feature_dir = orig_root, orig_resolve
        self.assertEqual(_ctx(self.fd)["status"], "implemented")

    def test_events_log_kept_after_step_closes_until_complete(self) -> None:
        # Closing implement folds every appended line but KEEPS the log — under the
        # per-wave materialize cadence a later wave may still append, so GC waits for
        # the terminal `completed` transition (the one state that blocks appends).
        (self.fd / "tasks.md").write_text("- [ ] **T001** a\n- [ ] **T002** b\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.append_task_log(self.fd, "T001", "ai", did="did a")
        wc.append_task_log(self.fd, "T002", "ai", did="did b")
        wc.materialize_log(self.fd, "ai")
        ctx = _ctx(self.fd)
        # Every appended finish landed in the context.
        self.assertEqual([e["task"] for e in ctx["history"] if e.get("task")], ["T001", "T002"])
        self.assertEqual(ctx["status"], "implemented")
        self.assertTrue((self.fd / ".spec-context.events.jsonl").exists(),
                        "events log is retained at implement-close; GC happens at mark-complete")

    def test_events_log_kept_while_step_open(self) -> None:
        # A materialize that does NOT close the step keeps the log (more tasks pending).
        (self.fd / "tasks.md").write_text("- [ ] **T001** a\n- [ ] **T002** b\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.append_task_log(self.fd, "T001", "ai")
        wc.materialize_log(self.fd, "ai")
        self.assertEqual(_ctx(self.fd)["status"], "implementing")
        self.assertTrue((self.fd / ".spec-context.events.jsonl").exists(),
                        "events log must survive while the step is still open")

    def test_mark_complete_folds_pending_appends_before_gc(self) -> None:
        # A finish appended but never materialized must be folded into the context
        # BEFORE mark-complete GCs the log — otherwise GC would drop it permanently.
        (self.fd / "tasks.md").write_text("- [x] **T001** a\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.append_task_log(self.fd, "T001", "ai", did="did a")
        wc.mark_spec_complete(self.fd, "ai")
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["status"], "completed")
        # The straggler finish survived into history + task_summaries, then the log was GC'd.
        self.assertIn("T001", [e.get("task") for e in ctx["history"]],
                      "mark-complete must fold pending appends before GC'ing the events log")
        self.assertEqual(ctx.get("task_summaries", {}).get("T001", {}).get("did"), "did a")
        self.assertFalse((self.fd / ".spec-context.events.jsonl").exists())

    def test_close_verdict_uses_post_flip_markers(self) -> None:
        # The close check derives 100% from markers parsed AFTER the checkboxes flip,
        # so the last task finishing closes the step in the same materialize pass.
        (self.fd / "tasks.md").write_text("- [ ] **T001** a\n- [ ] **T002** b\n")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        wc.append_task_log(self.fd, "T001", "ai")
        wc.append_task_log(self.fd, "T002", "ai")
        wc.materialize_log(self.fd, "ai")
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["status"], "implemented")
        self.assertEqual(ctx["history"][-1].get("task"), None)  # step-close lands last


class FeatureJsonResolverTests(unittest.TestCase):
    """resolve_feature_dir accepts both feature.json key shapes (canonical +
    stock spec-kit's FEATURE_DIR), so a bare call still finds the spec."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        (self.root / "specs" / "001-x").mkdir(parents=True)
        (self.root / ".specify").mkdir()
        # Clear env pointers so resolution falls through to feature.json.
        import os as _os
        self._saved = {k: _os.environ.pop(k, None) for k in ("SPECIFY_FEATURE_DIRECTORY", "SPECIFY_FEATURE")}

    def tearDown(self) -> None:
        import os as _os
        for k, v in self._saved.items():
            if v is not None:
                _os.environ[k] = v
        self._tmp.cleanup()

    def _write_pointer(self, payload: dict) -> None:
        (self.root / ".specify" / "feature.json").write_text(json.dumps(payload))

    def test_resolves_canonical_feature_directory_key(self) -> None:
        self._write_pointer({"feature_directory": "specs/001-x"})
        got = wc.resolve_feature_dir(self.root, None)
        self.assertEqual(got, self.root / "specs/001-x")

    def test_resolves_stock_FEATURE_DIR_key(self) -> None:
        # The shape the companion auto-prep / stock create-new-feature.sh writes.
        self._write_pointer({"FEATURE_DIR": "specs/001-x", "FEATURE_NAME": "001-x"})
        got = wc.resolve_feature_dir(self.root, None)
        self.assertEqual(got, self.root / "specs/001-x")


class MultiFlagDispatchTests(unittest.TestCase):
    """Every capture flag in one invocation records — the ladder used to drop all but the first."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fd = Path(self._tmp.name) / "specs" / "_zzz-multi"
        self.fd.mkdir(parents=True)
        self.fd.joinpath(".spec-context.json").write_text(
            json.dumps({"specName": "_zzz-multi", "branch": "main",
                        "currentStep": "plan", "status": "planning", "history": []})
        )
        self._orig_root, self._orig_resolve = wc._repo_root, wc.resolve_feature_dir
        wc._repo_root = lambda: Path(self._tmp.name)
        wc.resolve_feature_dir = lambda root, explicit: self.fd

    def tearDown(self) -> None:
        wc._repo_root, wc.resolve_feature_dir = self._orig_root, self._orig_resolve
        self._tmp.cleanup()

    def _run(self, argv: list[str]) -> tuple[int, str]:
        orig_argv, orig_stdout = sys.argv, sys.stdout
        sys.argv = ["write-context.py", "--feature-dir", str(self.fd), *argv]
        buf = io.StringIO()
        sys.stdout = buf
        try:
            return wc.main(), buf.getvalue()
        finally:
            sys.argv, sys.stdout = orig_argv, orig_stdout

    def test_a_decision_and_a_verification_in_one_call_both_record(self) -> None:
        rc, out = self._run(["--decision", "picked A", "--verified", "suite green"])
        self.assertEqual(rc, 0)
        ctx = _ctx(self.fd)
        self.assertEqual([d["decision"] for d in ctx["decisions"]], ["picked A"])
        self.assertEqual([v["what"] for v in ctx["verified"]], ["suite green"])
        self.assertIn("decision(s)", out)
        self.assertIn("verification(s)", out)

    def test_every_capture_flag_in_one_call_records(self) -> None:
        rc, _ = self._run([
            "--set", "size=normal",
            "--decision", "d1",
            "--verified", "v1",
            "--concern", "c1",
            "--expectation", "e1",
            "--context", "x1",
            "--coverage-req", "FR-001", "--title", "the requirement",
            "--step", "plan", "--step-summary", "s1",
            "--living-specs", "todos",
        ])
        self.assertEqual(rc, 0)
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["size"], "normal")
        self.assertEqual([d["decision"] for d in ctx["decisions"]], ["d1"])
        self.assertEqual([v["what"] for v in ctx["verified"]], ["v1"])
        self.assertEqual([c["note"] for c in ctx["concerns"]], ["c1"])
        self.assertEqual(ctx["expectations"], ["e1"])
        self.assertEqual(ctx["context"], ["x1"])
        self.assertEqual(ctx["coverage"]["FR-001"]["title"], "the requirement")
        self.assertEqual(ctx["step_summaries"]["plan"]["summary"], "s1")
        self.assertEqual(ctx["livingSpecs"]["loaded"], ["todos"])

    def test_a_classification_alongside_a_decision_records_both(self) -> None:
        rc, _ = self._run([
            "--classification", '{"projectedFiles": 2, "projectedTasks": 3, "verdict": "simple"}',
            "--decision", "d1",
        ])
        self.assertEqual(rc, 0)
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["classification"]["verdict"], "simple")
        self.assertEqual([d["decision"] for d in ctx["decisions"]], ["d1"])

    def test_a_malformed_classification_still_exits_two_and_writes_nothing_else(self) -> None:
        rc, _ = self._run(["--classification", "not json", "--decision", "d1"])
        self.assertEqual(rc, 2)
        self.assertEqual(_ctx(self.fd).get("decisions"), None)

    def test_a_capture_flag_never_writes_lifecycle_history(self) -> None:
        self._run(["--decision", "d1", "--verified", "v1"])
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["history"], [])
        self.assertEqual(ctx["status"], "planning")

    def test_a_lifecycle_mode_stays_exclusive(self) -> None:
        # --finish and --advance both present: the ladder order still picks one.
        rc, out = self._run(["--step", "plan", "--finish", "--advance", "--by", "ai"])
        self.assertEqual(rc, 0)
        self.assertEqual(len(_ctx(self.fd)["history"]), 1)
        self.assertIn("Journaled plan finish", out)
        self.assertNotIn("Advanced plan", out)

    def _run_err(self, argv: list[str]) -> tuple[int, str]:
        orig_argv, orig_stdout, orig_stderr = sys.argv, sys.stdout, sys.stderr
        sys.argv = ["write-context.py", "--feature-dir", str(self.fd), *argv]
        sys.stdout, err = io.StringIO(), io.StringIO()
        sys.stderr = err
        try:
            return wc.main(), err.getvalue()
        finally:
            sys.argv, sys.stdout, sys.stderr = orig_argv, orig_stdout, orig_stderr

    def test_a_lifecycle_flag_dropped_for_a_capture_flag_says_so(self) -> None:
        rc, err = self._run_err(["--mark-complete", "--set", "size=normal"])
        self.assertEqual(rc, 0)
        self.assertEqual(_ctx(self.fd)["status"], "planning")
        self.assertIn("--mark-complete not applied", err)

    def test_a_capture_flag_on_its_own_warns_about_nothing(self) -> None:
        _, err = self._run_err(["--set", "size=normal"])
        self.assertNotIn("not applied", err)


class SpecRelativeBranchTests(unittest.TestCase):
    """Every writer derives `branch` from the repo containing the SPEC it writes
    to, not from the process cwd. Two real git repos on distinct branches; the
    test runs with cwd inside the caller repo and writes into the other."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        base = Path(self._tmp.name)
        self.caller = self._repo(base / "caller", "caller-branch")
        self.spec_repo = self._repo(base / "other", "spec-branch")
        self.fd = self.spec_repo / "specs" / "001-outside"
        self.fd.mkdir(parents=True)
        self._orig_cwd = Path.cwd()
        os.chdir(self.caller)

    def tearDown(self) -> None:
        os.chdir(self._orig_cwd)
        self._tmp.cleanup()

    @staticmethod
    def _repo(path: Path, branch: str) -> Path:
        path.mkdir(parents=True)
        run = lambda *a: subprocess.run(a, cwd=path, check=True, capture_output=True)
        run("git", "init", "-q")
        run("git", "config", "user.email", "t@t.t")
        run("git", "config", "user.name", "t")
        (path / "README.md").write_text("x\n")
        run("git", "add", "-A")
        run("git", "commit", "-qm", "init")
        run("git", "checkout", "-qb", branch)
        return path

    def _seed(self, status: str, step: str, history: list | None = None) -> None:
        (self.fd / ".spec-context.json").write_text(json.dumps({
            "workflow": "speckit", "specName": "001-outside",
            "currentStep": step, "status": status, "history": history or [],
        }))

    def test_caller_and_spec_repos_really_are_on_different_branches(self) -> None:
        self.assertEqual(wc._git_branch(self.caller), "caller-branch")
        self.assertEqual(wc._git_branch(self.spec_repo), "spec-branch")

    def test_step_lifecycle_write_records_the_spec_repos_branch(self) -> None:
        wc.update_context(self.fd, "specify", "specified", "extension")
        self.assertEqual(_ctx(self.fd)["branch"], "spec-branch")

    def test_terminal_promotion_records_the_spec_repos_branch(self) -> None:
        self._seed("implemented", "implement",
                   [{"step": "implement", "kind": "start", "by": "ai", "at": "2026-01-01T00:00:00.000Z"}])
        wc.mark_spec_complete(self.fd, "extension")
        ctx = _ctx(self.fd)
        self.assertEqual(ctx["status"], "completed")
        self.assertEqual(ctx["branch"], "spec-branch")

    def test_set_fields_records_the_spec_repos_branch(self) -> None:
        self._seed("planning", "plan")
        wc.set_fields(self.fd, ["unattended=true"])
        self.assertEqual(_ctx(self.fd)["branch"], "spec-branch")

    def test_task_sync_records_the_spec_repos_branch(self) -> None:
        self._seed("implementing", "implement")
        tasks = self.fd / "tasks.md"
        tasks.write_text(_tasks("- [x] T001 done", "- [ ] T002 pending"))
        wc.sync_tasks(self.fd, tasks, "implemented", "ai")
        self.assertEqual(_ctx(self.fd)["branch"], "spec-branch")

    def test_step_finish_journal_records_the_spec_repos_branch(self) -> None:
        self._seed("specifying", "specify",
                   [{"step": "specify", "kind": "start", "by": "ai", "at": "2026-01-01T00:00:00.000Z"}])
        wc.journal_finish(self.fd, "specify", "ai")
        self.assertEqual(_ctx(self.fd)["branch"], "spec-branch")

    def test_derive_from_files_records_the_spec_repos_branch(self) -> None:
        (self.fd / "spec.md").write_text("# Outside\n")
        derive_mod.derive(self.fd, "derive")
        self.assertEqual(_ctx(self.fd)["branch"], "spec-branch")

    def test_a_spec_dir_outside_any_repo_falls_back_to_the_cwd_branch(self) -> None:
        loose = Path(self._tmp.name) / "loose" / "001-loose"
        loose.mkdir(parents=True)
        wc.update_context(loose, "specify", "specified", "extension")
        self.assertEqual(_ctx(loose)["branch"], "caller-branch")

    def test_a_spec_inside_the_cwd_repo_is_unchanged(self) -> None:
        same = self.caller / "specs" / "001-same"
        same.mkdir(parents=True)
        wc.update_context(same, "specify", "specified", "extension")
        self.assertEqual(_ctx(same)["branch"], "caller-branch")


if __name__ == "__main__":
    unittest.main()
