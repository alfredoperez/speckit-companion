#!/usr/bin/env python3
"""Plan's dispatch is decided by a script, and the doctor sees whether it happened.

Prose that said "dispatch when…" was argued away by unattended runs. These tests hold
the replacement: the script prints briefs or says to work inline, each worker's
check-in reaches the trace, and a closed plan with no check-ins is named.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

doctor_checks = importlib.import_module("doctor_checks")
dispatch_briefs = importlib.import_module("dispatch-briefs")


def _tasks(start, n):
    return "\n".join(f"- [ ] **T{i:03d}** [P] task {i} · src/f{i}.ts" for i in range(start, start + n))


# Spec 612's Foundational phase: a tests block and an implementation block with no join between them,
# two waves of four, and a lone task after a join with no wave header.
FOUNDATIONAL_612 = f"""## Phase 1: Setup

- [ ] **T001** setup · package.json

## Phase 2: Foundational

### Tests

**Wave 1 — independent (different files):**

{_tasks(2, 7)}

### Implementation

**Wave 1 — independent (different files):**

{_tasks(9, 4)}

**⟶ Wait for Wave 1 to finish, then:**

{_tasks(13, 4)}

**⟶ Wait for Wave 2 to finish, then:**

{_tasks(17, 4)}

**⟶ Wait for Wave 3 to finish, then:**

- [ ] **T021** wire it · src/index.ts

## Phase 3: User Story 1 - Something (P1)

{_tasks(22, 6)}
"""


PLAN_CLOSED = [
    {"step": "plan", "kind": "start", "at": "2026-09-19T10:00:00Z", "by": "extension"},
    {"step": "plan", "kind": "complete", "at": "2026-09-19T10:10:00Z", "by": "ai"},
]


class DispatchBriefs(unittest.TestCase):
    def _feature(self, **ctx):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name) / "specs" / "001-thing"
        d.mkdir(parents=True)
        (d / "thing.spec.md").write_text("# spec\n")
        (d / ".spec-context.json").write_text(json.dumps({"history": PLAN_CLOSED, **ctx}))
        return d

    def _run(self, d, *args):
        return subprocess.run([sys.executable, str(SCRIPTS / "dispatch-briefs.py"),
                               "--feature-dir", str(d), *args], capture_output=True, text=True)

    def test_two_areas_print_one_reader_brief_each(self):
        d = self._feature(context=["area: src/a", "area: src/b", "constraint: x"])
        out = self._run(d).stdout
        self.assertIn("Dispatch these 2 readers", out)
        self.assertIn("=== reader: 1 ===", out)
        self.assertIn("--checkin \"reader: 2\"", out)
        self.assertIn("`src/b`", out)

    def test_many_areas_share_four_readers(self):
        d = self._feature(context=[f"area: src/f{i}.ts" for i in range(8)])
        out = self._run(d).stdout
        self.assertIn("Dispatch these 4 readers", out)
        self.assertIn("`src/f0.ts`, `src/f4.ts`", out)

    def test_one_area_works_inline(self):
        out = self._run(self._feature(context=["area: src/a"])).stdout
        self.assertIn("Working inline", out)

    def test_design_docs_dispatch_unless_simple(self):
        self.assertIn("Dispatch these 2 design docs", self._run(self._feature(size="normal"), "--docs").stdout)
        self.assertIn("Working inline", self._run(self._feature(size="simple"), "--docs").stdout)

    def test_a_closed_plan_with_no_checkins_is_named(self):
        d = self._feature(context=["area: src/a", "area: src/b"], size="normal")
        self._run(d)
        self._run(d, "--docs")
        _, findings = doctor_checks.check_dispatch(d, json.loads((d / ".spec-context.json").read_text()))
        titles = [f.title for f in findings]
        self.assertIn("plan read the code inline instead of dispatching 2 readers", titles)
        self.assertEqual(len(findings), 2)

    def test_checkins_from_an_earlier_run_do_not_count(self):
        d = self._feature(context=["area: src/a", "area: src/b"], size="normal")
        self._run(d, "--checkin", "reader: 1")
        ctx = json.loads((d / ".spec-context.json").read_text())
        ctx["history"] = [{"step": "plan", "kind": "start", "at": "2999-01-01T00:00:00Z", "by": "extension"},
                          {"step": "plan", "kind": "complete", "at": "2999-01-01T00:10:00Z", "by": "ai"}]
        self.assertEqual(doctor_checks.check_dispatch(d, ctx)[1], [], "nothing was offered in this run")

    def test_a_simple_run_folds_plan_so_plan_is_not_judged(self):
        d = self._feature(context=["area: src/a", "area: src/b"], size="simple")
        _, findings = doctor_checks.check_dispatch(d, json.loads((d / ".spec-context.json").read_text()))
        self.assertEqual(findings, [])

    def test_checkins_clear_the_finding(self):
        d = self._feature(context=["area: src/a", "area: src/b"], size="normal")
        for label in ("reader: 1", "doc: data-model.md"):
            self.assertEqual(self._run(d, "--checkin", label).returncode, 0)
        _, findings = doctor_checks.check_dispatch(d, json.loads((d / ".spec-context.json").read_text()))
        self.assertEqual(findings, [])


class FoundationalWaves(unittest.TestCase):
    def _feature(self, tasks_md, **ctx):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name) / "specs" / "001-thing"
        d.mkdir(parents=True)
        (d / "thing.spec.md").write_text("# spec\n")
        (d / "tasks.md").write_text(tasks_md)
        (d / ".spec-context.json").write_text(json.dumps({"history": PLAN_CLOSED, **ctx}))
        return d

    def _run(self, d, *args):
        return subprocess.run([sys.executable, str(SCRIPTS / "dispatch-briefs.py"),
                               "--feature-dir", str(d), *args], capture_output=True, text=True)

    def test_tests_and_implementation_are_separate_waves(self):
        waves = dispatch_briefs.foundational_waves(FOUNDATIONAL_612)
        self.assertEqual([len(w) for w in waves], [7, 4, 4, 4, 1])
        self.assertEqual(waves[4], ["T021"])

    def test_a_task_that_mentions_a_join_is_still_a_task(self):
        text = "## Phase 2: Foundational\n\n- [ ] **T001** split at `⟶ Wait` lines · a.py\n- [ ] **T002** b · b.py\n"
        self.assertEqual(dispatch_briefs.foundational_waves(text), [["T001", "T002"]])

    def test_plain_task_lines_count_and_fenced_ones_do_not(self):
        text = "## Phase 2: Foundational\n\n- [ ] T001 a\n* [ ] T002 b\n```\n- [ ] T003 example\n```\n"
        self.assertEqual(dispatch_briefs.foundational_waves(text), [["T001", "T002"]])

    def test_only_a_phase_heading_opens_foundational(self):
        text = "## Parallel Example: Foundational Tests\n\n- [ ] T009 x\n\n## Phase 2: Foundational\n\n- [ ] T001 a\n"
        self.assertEqual(dispatch_briefs.foundational_waves(text), [["T001"]])

    def test_only_the_next_unfinished_wave_is_briefed(self):
        out = self._run(self._feature(FOUNDATIONAL_612), "--waves").stdout
        for label in ("wave: 1.1", "wave: 1.4"):
            self.assertIn(f"=== {label} ===", out)
        self.assertNotIn("wave: 1.5", out)
        self.assertNotIn("wave: 2.", out, "a later wave must wait for this one's join line")
        self.assertIn("build T002, T006 from", out)
        self.assertIn("--by ai --did", out)

    def test_finished_tasks_move_it_to_the_next_wave_and_are_not_briefed_again(self):
        done = FOUNDATIONAL_612
        for n in range(2, 13):
            done = done.replace(f"- [ ] **T{n:03d}**", f"- [x] **T{n:03d}**")
        done = done.replace("- [ ] **T013**", "- [x] **T013**")
        out = self._run(self._feature(done), "--waves").stdout
        self.assertIn("Build Foundational wave 3 yourself: T014, T015, T016", out)

    def test_a_missing_foundational_phase_is_not_reported_as_done(self):
        out = self._run(self._feature("## Phase 2 — Foundational\n\n- [ ] T001 a\n"), "--waves").stdout
        self.assertIn("No `## Phase N: Foundational` heading", out)

    def test_a_wave_built_inline_on_instruction_is_not_faulted(self):
        history = PLAN_CLOSED + [
            {"step": "implement", "kind": "start", "at": "2000-01-01T00:00:00.000Z", "by": "extension"},
            {"step": "implement", "kind": "complete", "at": "2999-01-01T00:00:00.000Z", "by": "ai"},
        ]
        partial = FOUNDATIONAL_612.replace("- [ ] **T002**", "- [x] **T002**").replace("- [ ] **T003**", "- [x] **T003**")
        partial = partial.replace("- [ ] **T004**", "- [x] **T004**").replace("- [ ] **T005**", "- [x] **T005**")
        d = self._feature(partial, size="simple")
        ctx = {"history": history, "size": "simple"}
        self.assertIn("yourself", self._run(d, "--waves").stdout)
        self.assertEqual(doctor_checks.check_dispatch(d, ctx)[1], [])

    def test_leading_trailing_and_back_to_back_joins_leave_no_empty_waves(self):
        text = ("## Phase 2: Foundational\n\n**⟶ Wait for Setup, then:**\n\n- [ ] T001 a\n\n"
                "**⟶ Wait, then:**\n**⟶ Wait again, then:**\n\n- [ ] T002 b\n\n**⟶ Wait, then:**\n")
        self.assertEqual(dispatch_briefs.foundational_waves(text), [["T001"], ["T002"]])

    def test_small_waves_stay_inline(self):
        small = "## Phase 2: Foundational\n\n" + _tasks(1, 3) + "\n\n## Phase 3: User Story 1 - x (P1)\n"
        self.assertIn("Build Foundational wave 1 yourself: T001, T002, T003", self._run(self._feature(small), "--waves").stdout)

    def test_a_closed_implement_that_skipped_its_wave_workers_is_named(self):
        history = PLAN_CLOSED + [
            {"step": "implement", "kind": "start", "at": "2026-09-19T11:00:00Z", "by": "extension"},
            {"step": "implement", "kind": "complete", "at": "2026-09-19T11:30:00Z", "by": "ai"},
        ]
        d = self._feature(FOUNDATIONAL_612, size="simple")
        ctx = {"history": history, "size": "simple"}
        (d / ".spec-context.json").write_text(json.dumps(ctx))
        _, findings = doctor_checks.check_dispatch(d, ctx)
        self.assertEqual(findings, [], "a spec never offered wave workers is not faulted")
        for done_through in (0, 7, 11, 15):
            text = FOUNDATIONAL_612
            for n in range(2, 2 + done_through):
                text = text.replace(f"- [ ] **T{n:03d}**", f"- [x] **T{n:03d}**")
            (d / "tasks.md").write_text(text)
            self._run(d, "--waves")
        (d / "tasks.md").write_text(FOUNDATIONAL_612)
        _, findings = doctor_checks.check_dispatch(d, ctx)
        self.assertIn("implement built 4 Foundational waves inline instead of dispatching their workers",
                      [f.title for f in findings])
        for label in [f"wave: {w}.{n}" for w in (1, 2, 3, 4) for n in (1, 2, 3)]:
            self._run(d, "--checkin", label)
        _, findings = doctor_checks.check_dispatch(d, ctx)
        self.assertIn("implement built 4 Foundational waves inline instead of dispatching their workers",
                      [f.title for f in findings], "three of four workers per wave is not all of them")
        for label in ("wave: 1.4", "wave: 2.4", "wave: 3.4", "wave: 4.4"):
            self._run(d, "--checkin", label)
        _, findings = doctor_checks.check_dispatch(d, ctx)
        self.assertEqual(findings, [])


if __name__ == "__main__":
    unittest.main()
