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
import json
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
        n1 = len(_ctx(self.fd)["history"])
        wc.update_context(self.fd, "plan", "planned", "extension")
        h2 = _ctx(self.fd)["history"]
        self.assertGreater(len(h2), n1)
        self.assertEqual(h2[-1]["step"], "plan")
        self.assertEqual(h2[-1]["kind"], "start")
        self.assertEqual(h2[-1]["from"], {"step": "specify", "substep": None})

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
        self.assertEqual(h[-1]["step"], "plan")
        self.assertEqual(h[-1]["from"], {"step": "specify", "substep": None})

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

    def test_per_task_idempotency(self) -> None:
        (self.fd / "tasks.md").write_text(
            _tasks("- [x] **T001** a", "- [x] **T002** b", "- [ ] **T003** c")
        )
        tasks_md = self.fd / "tasks.md"
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        first = [t.get("task") for t in _ctx(self.fd)["history"] if t.get("task")]
        self.assertEqual(first, ["T001", "T002"])
        self.assertEqual(_ctx(self.fd)["status"], "implementing")
        self.assertEqual(_ctx(self.fd)["currentTask"], "T003")
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        second = [t.get("task") for t in _ctx(self.fd)["history"] if t.get("task")]
        self.assertEqual(second, first)

    def test_hook_skips_tasks_already_journaled_live_by_ai(self) -> None:
        # When the implement preamble made the AI journal a task live (by:ai,
        # carrying `task`), the end-of-step hook must treat it as a no-op
        # backstop — dedupe on the task id, not re-add it.
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
        journaled = [t for t in _ctx(self.fd)["history"] if t.get("task") == "T001"]
        self.assertEqual(len(journaled), 1, "hook must not duplicate the AI's live T001 entry")
        self.assertEqual(journaled[0]["by"], "ai")
        all_tasks = [t.get("task") for t in _ctx(self.fd)["history"] if t.get("task")]
        self.assertEqual(all_tasks, ["T001", "T002"])

    def test_per_task_completes_when_all_checked(self) -> None:
        tasks_md = self.fd / "tasks.md"
        tasks_md.write_text(_tasks("- [x] **T001** a", "- [x] **T002** b"))
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        self.assertEqual(_ctx(self.fd)["status"], "implemented")

    def test_per_task_entries_are_substeps_not_step_completions(self) -> None:
        # A substep==null transition whose from.step==step reads as a step
        # COMPLETION in the viewer — per-task entries must never look like that,
        # or the implement step renders done while still in flight.
        tasks_md = self.fd / "tasks.md"
        tasks_md.write_text(_tasks("- [x] **T001** a", "- [x] **T002** b", "- [ ] **T003** c"))
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        for t in _ctx(self.fd)["history"]:
            if t.get("task"):
                self.assertEqual(t["substep"], t["task"])
                self.assertIsNotNone(t["substep"])

    def test_duplicate_marker_id_yields_one_transition(self) -> None:
        tasks_md = self.fd / "tasks.md"
        tasks_md.write_text(_tasks("- [x] **T001** a", "- [x] **T001** a (re-listed)"))
        wc.sync_tasks(self.fd, tasks_md, "implemented", "extension")
        tasks = [t.get("task") for t in _ctx(self.fd)["history"] if t.get("task")]
        self.assertEqual(tasks, ["T001"])


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
        tasks = [t.get("task") for t in ctx["history"] if t.get("task")]
        self.assertEqual(tasks, ["T001", "T002"])
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


if __name__ == "__main__":
    unittest.main()
