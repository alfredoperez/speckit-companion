#!/usr/bin/env python3
"""Step bleed: one step doing the next step's work.

The signals are read from the artifacts and from git, so these tests use committed
fixture documents plus a throwaway repository for the early-source-commit case.
"""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import doctor_bleed as db  # noqa: E402

FIXTURES = ROOT / "tests" / "fixtures" / "doctor"


def load(name):
    d = FIXTURES / name
    ctx_path = d / ".spec-context.json"
    ctx = json.loads(ctx_path.read_text(encoding="utf-8")) if ctx_path.is_file() else {}
    return d, ctx


def check(name, root=ROOT.parent):
    d, ctx = load(name)
    return db.check_bleed(root, d, ctx)


def titles(findings):
    return [f.title for f in findings]


class ArtifactShapeTests(unittest.TestCase):
    def test_a_run_that_stayed_in_its_lane_is_clean(self):
        status, findings = check("bleed-clean")
        self.assertEqual(status.state, "ran")
        self.assertEqual(findings, [], f"unexpected: {titles(findings)}")

    def test_a_spec_carrying_an_approach_section_is_plan_work(self):
        _status, findings = check("bleed-spec-does-plan")
        hit = [f for f in findings if f.evidence.get("step") == "specify"
               and f.evidence.get("did") == "plan"]
        self.assertEqual(len(hit), 1)
        self.assertIn("plan-shaped section", hit[0].detail)

    def test_a_spec_carrying_a_task_checklist_is_tasks_work(self):
        _status, findings = check("bleed-spec-does-tasks")
        hit = [f for f in findings if f.evidence.get("step") == "specify"
               and f.evidence.get("did") == "tasks"]
        self.assertEqual(len(hit), 1)
        self.assertEqual(hit[0].evidence["evidence"], ["T001", "T002"])

    def test_a_plan_carrying_a_task_checklist_is_tasks_work(self):
        _status, findings = check("bleed-plan-does-tasks")
        hit = [f for f in findings if f.evidence.get("step") == "plan"
               and f.evidence.get("did") == "tasks"]
        self.assertEqual(len(hit), 1)
        self.assertIn("plan.md", hit[0].evidence["where"])

    def test_a_task_list_carrying_implementation_code_is_implement_work(self):
        _status, findings = check("bleed-tasks-does-code")
        hit = [f for f in findings if f.evidence.get("step") == "tasks"
               and f.evidence.get("did") == "implement"]
        self.assertEqual(len(hit), 1)

    def test_a_short_snippet_is_not_treated_as_implementation(self):
        self.assertEqual(
            [n for lang, n in db._code_blocks("```python\na = 1\n```\n") if n >= db.CODE_BLOCK_LINES],
            [])

    def test_a_deliberately_fast_tracked_change_is_not_bleed(self):
        _status, findings = check("bleed-fast-path")
        self.assertEqual([f for f in findings if f.severity == "warning"], [],
                         "the fast-path shape is correct, not bleed")

    def test_a_spec_with_no_documents_is_not_applicable(self):
        status, findings = db.check_bleed(ROOT.parent, FIXTURES / "dangling-start", {})
        self.assertEqual(status.state, "not-applicable")
        self.assertEqual(findings, [])


class DuplicationTests(unittest.TestCase):
    def test_the_same_task_ids_in_two_documents_are_reported_with_both_named(self):
        _status, findings = check("bleed-plan-does-tasks")
        hit = [f for f in findings if "two documents" in f.title]
        self.assertEqual(len(hit), 1)
        self.assertIn("plan.md", hit[0].evidence["where"])
        self.assertIn("tasks.md", hit[0].evidence["where"])

    def test_one_copy_of_the_list_is_not_duplication(self):
        _status, findings = check("bleed-clean")
        self.assertEqual([f for f in findings if "two documents" in f.title], [])


class EarlySourceTests(unittest.TestCase):
    """Source committed while the run was still before implement."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self._git("init", "-q", "-b", "main")
        self._git("config", "user.email", "t@example.com")
        self._git("config", "user.name", "T")
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)
        (self.spec / "spec.md").write_text("# Spec\n", encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def _git(self, *args):
        return subprocess.run(["git", "-C", str(self.root), *args],
                              capture_output=True, text=True, check=False)

    def _commit(self, path, body, message):
        f = self.root / path
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(body, encoding="utf-8")
        self._git("add", "-A")
        self._git("commit", "-q", "-m", message)
        out = self._git("log", "-1", "--format=%cI").stdout.strip()
        return out

    def _ctx(self, step, start, end):
        return {"history": [
            {"step": step, "substep": None, "kind": "start", "by": "extension", "at": start},
            {"step": step, "substep": None, "kind": "complete", "by": "extension", "at": end},
        ]}

    def test_source_committed_during_the_plan_step_is_reported(self):
        at = self._commit("src/thing.py", "print(1)\n", "start building during plan")
        ctx = self._ctx("plan", at, at)
        signals = db._early_source_signals(self.root, ctx)
        self.assertEqual(len(signals), 1)
        self.assertEqual(signals[0]["step"], "plan")
        self.assertIn("src/thing.py", signals[0]["evidence"])

    def test_spec_documents_committed_during_a_step_are_not_source(self):
        at = self._commit("specs/001-x/plan.md", "# Plan\n", "write the plan")
        signals = db._early_source_signals(self.root, self._ctx("plan", at, at))
        self.assertEqual(signals, [])

    def test_a_step_with_no_recorded_window_is_skipped_not_guessed(self):
        self._commit("src/thing.py", "print(1)\n", "build")
        signals = db._early_source_signals(self.root, {"history": []})
        self.assertEqual(signals, [])


class TimeShareTests(unittest.TestCase):
    def ctx(self, spans):
        history = []
        for step, (start, end) in spans.items():
            history.append({"step": step, "substep": None, "kind": "start",
                            "by": "extension", "at": start})
            history.append({"step": step, "substep": None, "kind": "complete",
                            "by": "extension", "at": end})
        return {"history": history}

    def test_a_plan_longer_than_implement_is_reported_as_a_note(self):
        ctx = self.ctx({
            "plan": ("2026-08-01T10:00:00Z", "2026-08-01T11:00:00Z"),
            "implement": ("2026-08-01T11:00:00Z", "2026-08-01T11:10:00Z"),
        })
        share = db._time_share(ctx)
        self.assertEqual(share["step"], "plan")
        self.assertGreater(share["share"], share["implement_share"])

    def test_a_normal_shape_reports_nothing(self):
        ctx = self.ctx({
            "plan": ("2026-08-01T10:00:00Z", "2026-08-01T10:10:00Z"),
            "implement": ("2026-08-01T10:10:00Z", "2026-08-01T11:10:00Z"),
        })
        self.assertIsNone(db._time_share(ctx))

    def test_a_run_that_never_reached_implement_reports_nothing(self):
        ctx = self.ctx({"plan": ("2026-08-01T10:00:00Z", "2026-08-01T11:00:00Z")})
        self.assertIsNone(db._time_share(ctx))

    def test_the_time_share_is_a_note_never_a_problem(self):
        ctx = self.ctx({
            "plan": ("2026-08-01T10:00:00Z", "2026-08-01T11:00:00Z"),
            "implement": ("2026-08-01T11:00:00Z", "2026-08-01T11:10:00Z"),
        })
        d = FIXTURES / "bleed-clean"
        _status, findings = db.check_bleed(ROOT.parent, d, {**ctx, "size": "normal"})
        notes = [f for f in findings if "took longer than" in f.title]
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0].severity, "note")


if __name__ == "__main__":
    unittest.main()
