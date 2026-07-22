#!/usr/bin/env python3
"""Tests for the command-quality eval (check_quality.py).

Stdlib `unittest` only — run with:

    python3 -m unittest discover speckit-extension/tests
"""

from __future__ import annotations

import importlib
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

SKILL_DIR = (Path(__file__).resolve().parent.parent.parent
             / ".claude" / "skills" / "eval-speckit-extension")
sys.path.insert(0, str(SKILL_DIR))
cq = importlib.import_module("check_quality")


def _iso(minute: int, second: int = 0, ms: int = 123) -> str:
    return f"2026-07-21T14:{minute:02d}:{second:02d}.{ms:03d}Z"


def _step_pair(step: str, start_min: int, end_min: int) -> list[dict]:
    return [
        {"step": step, "substep": None, "kind": "start", "by": "extension",
         "at": _iso(start_min)},
        {"step": step, "substep": None, "kind": "complete", "by": "extension",
         "at": _iso(end_min)},
    ]


def _healthy_history() -> list[dict]:
    h = (_step_pair("specify", 0, 2) + _step_pair("plan", 3, 6)
         + _step_pair("tasks", 7, 8))
    h.append({"step": "implement", "substep": None, "kind": "start",
              "by": "extension", "at": _iso(9)})
    for i, minute in enumerate((10, 12, 15), start=1):
        h.append({"step": "implement", "substep": None, "task": f"T00{i}",
                  "kind": "complete", "by": "ai", "at": _iso(minute)})
    h.append({"step": "implement", "substep": None, "kind": "complete",
              "by": "extension", "at": _iso(16)})
    return h


class QualityEvalBase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.spec_dir = self.root / "specs" / "999-fixture"
        self.spec_dir.mkdir(parents=True)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def write_spec(self, history: list[dict] | None = None,
                   plan_lines: int = 50) -> None:
        (self.spec_dir / "spec.md").write_text("# Spec\n" + "line\n" * 100)
        (self.spec_dir / "plan.md").write_text("# Plan\n" + "line\n" * plan_lines)
        (self.spec_dir / "tasks.md").write_text("# Tasks\n" + "- [x] **T001** x\n" * 3)
        if history is not None:
            (self.spec_dir / ".spec-context.json").write_text(
                json.dumps({"history": history}))

    def run_report(self) -> "cq.Report":
        r = cq.Report()
        cq.check_verbosity(r, self.spec_dir)
        cq.check_timing(r, self.spec_dir)
        return r

    def statuses(self, r: "cq.Report") -> dict[str, str]:
        return {cid: status for status, cid, _ in r.rows}


class VerbosityTests(QualityEvalBase):
    def test_healthy_artifacts_pass(self) -> None:
        self.write_spec(history=_healthy_history())
        r = self.run_report()
        self.assertEqual(r.failed, 0)
        self.assertEqual(self.statuses(r)["verbosity-plan"], "PASS")

    def test_ballooned_plan_fails(self) -> None:
        self.write_spec(history=_healthy_history(), plan_lines=350)
        r = self.run_report()
        self.assertEqual(self.statuses(r)["verbosity-plan"], "FAIL")

    def test_oversized_plan_warns_inside_first_band(self) -> None:
        self.write_spec(history=_healthy_history(), plan_lines=200)
        r = self.run_report()
        self.assertEqual(self.statuses(r)["verbosity-plan"], "WARN")
        self.assertEqual(r.failed, 0)

    def test_missing_artifact_is_info_not_flagged(self) -> None:
        self.write_spec(history=_healthy_history())
        (self.spec_dir / "plan.md").unlink()
        r = self.run_report()
        self.assertEqual(self.statuses(r)["verbosity-plan"], "INFO")
        self.assertEqual(r.failed, 0)

    def test_single_line_char_balloon_fails(self) -> None:
        self.write_spec(history=_healthy_history())
        (self.spec_dir / "plan.md").write_text("x" * 40_000)
        r = self.run_report()
        self.assertEqual(self.statuses(r)["verbosity-plan"], "FAIL")

    def test_non_utf8_artifact_fails_structured(self) -> None:
        self.write_spec(history=_healthy_history())
        (self.spec_dir / "plan.md").write_bytes(b"\xff\xfe invalid")
        status, _, detail = next(row for row in self.run_report().rows
                                 if row[1] == "verbosity-plan")
        self.assertEqual(status, "FAIL")
        self.assertIn("unreadable", detail)


class TimingTests(QualityEvalBase):
    def test_healthy_history_passes_all_timing_rows(self) -> None:
        self.write_spec(history=_healthy_history())
        s = self.statuses(self.run_report())
        self.assertEqual(s["trusted-boundaries"], "PASS")
        self.assertEqual(s["burst-journaling"], "PASS")
        self.assertEqual(s["step-duration-outlier"], "PASS")

    def test_missing_boundary_marks_step_untrusted(self) -> None:
        history = [e for e in _healthy_history()
                   if not (e.get("step") == "plan" and e.get("kind") == "start")]
        self.write_spec(history=history)
        r = self.run_report()
        status, _, detail = next(row for row in r.rows if row[1] == "trusted-boundaries")
        self.assertEqual(status, "WARN")
        self.assertIn("plan", detail)

    def test_burst_of_ai_finishes_fails(self) -> None:
        history = _healthy_history()
        history = [e for e in history if "task" not in e]
        for i in range(1, 4):
            history.append({"step": "implement", "substep": None, "task": f"T00{i}",
                            "kind": "complete", "by": "ai",
                            "at": f"2026-07-21T14:15:00.{100 + i:03d}Z"})
        self.write_spec(history=history)
        self.assertEqual(self.statuses(self.run_report())["burst-journaling"], "FAIL")

    def test_two_finishes_too_small_to_judge(self) -> None:
        history = [e for e in _healthy_history() if e.get("task") != "T003"]
        self.write_spec(history=history)
        self.assertEqual(self.statuses(self.run_report())["burst-journaling"], "INFO")

    def test_outlier_step_duration_warns(self) -> None:
        history = _healthy_history()
        for e in history:
            if (e.get("step") == "implement" and e.get("kind") == "complete"
                    and e.get("by") == "extension"):
                e["at"] = "2026-07-21T16:00:00.123Z"
        self.write_spec(history=history)
        self.assertEqual(self.statuses(self.run_report())["step-duration-outlier"], "WARN")

    def test_no_context_reports_not_examinable(self) -> None:
        self.write_spec(history=None)
        r = self.run_report()
        self.assertEqual(self.statuses(r)["timing-not-examinable"], "WARN")
        self.assertEqual(r.failed, 0)

    def test_malformed_context_reports_not_examinable(self) -> None:
        self.write_spec(history=None)
        (self.spec_dir / ".spec-context.json").write_text("{not json")
        r = self.run_report()
        self.assertEqual(self.statuses(r)["timing-not-examinable"], "WARN")
        self.assertEqual(r.failed, 0)

    def test_non_utf8_context_reports_not_examinable(self) -> None:
        self.write_spec(history=None)
        (self.spec_dir / ".spec-context.json").write_bytes(b"\xff\xfe not utf8")
        r = self.run_report()
        self.assertEqual(self.statuses(r)["timing-not-examinable"], "WARN")
        self.assertEqual(r.failed, 0)

    def test_empty_history_reports_not_examinable(self) -> None:
        self.write_spec(history=[])
        r = self.run_report()
        self.assertEqual(self.statuses(r)["timing-not-examinable"], "WARN")
        self.assertEqual(r.failed, 0)

    def test_fewer_than_two_spans_still_emits_outlier_row(self) -> None:
        self.write_spec(history=_step_pair("specify", 0, 2))
        status, _, detail = next(row for row in self.run_report().rows
                                 if row[1] == "step-duration-outlier")
        self.assertEqual(status, "INFO")
        self.assertIn("need ≥ 2", detail)

    def test_duplicate_extension_start_untrusts_step(self) -> None:
        history = _healthy_history()
        idx = next(i for i, e in enumerate(history)
                   if e.get("step") == "plan" and e.get("kind") == "complete")
        history.insert(idx, {"step": "plan", "substep": None, "kind": "start",
                             "by": "extension", "at": _iso(4)})
        self.write_spec(history=history)
        status, _, detail = next(row for row in self.run_report().rows
                                 if row[1] == "trusted-boundaries")
        self.assertEqual(status, "WARN")
        self.assertIn("plan", detail)

    def test_next_step_extension_start_closes_span(self) -> None:
        # No explicit specify complete — the viewer closes specify at plan's
        # extension start, and the eval must agree it's trusted.
        history = [
            {"step": "specify", "substep": None, "kind": "start",
             "by": "extension", "at": _iso(0)},
        ] + _step_pair("plan", 3, 6)
        self.write_spec(history=history)
        status, _, detail = next(row for row in self.run_report().rows
                                 if row[1] == "trusted-boundaries")
        self.assertEqual(status, "PASS")
        self.assertIn("2/2", detail)

    def test_non_extension_boundary_is_untrusted(self) -> None:
        history = _healthy_history()
        for e in history:
            if e.get("step") == "plan" and e.get("kind") == "start":
                e["by"] = "cli"
        self.write_spec(history=history)
        status, _, detail = next(row for row in self.run_report().rows
                                 if row[1] == "trusted-boundaries")
        self.assertEqual(status, "WARN")
        self.assertIn("plan", detail)


def _fastpath_fold() -> list[dict]:
    """A simple-mode run: specify plus folded plan/tasks, each a step-level
    extension-stamped start+complete pair (the trusted post-#514 shape). The
    four fold boundaries are separate `python3` writes tens of ms apart, so their
    timestamps are honestly near-zero but strictly increasing. No implement step
    yet — the developer triggers that next."""
    def _pair(step: str, start: str, end: str) -> list[dict]:
        return [
            {"step": step, "substep": None, "kind": "start", "by": "extension", "at": start},
            {"step": step, "substep": None, "kind": "complete", "by": "extension", "at": end},
        ]
    return (_pair("specify", _iso(0, 0, 100), _iso(2, 0, 100))
            + _pair("plan", _iso(2, 0, 200), _iso(2, 0, 285))
            + _pair("tasks", _iso(2, 0, 370), _iso(2, 0, 455)))


def _legacy_fastpath_fold() -> list[dict]:
    """The old fold: plan/tasks folded as `by: ai`, `substep: fast-path` pairs.
    A step boundary is step-level (substep None), so these must NOT be trusted."""
    fold = _step_pair("specify", 0, 2)
    fold[-1]["by"] = "ai"  # old fold even self-closed specify by ai
    for step, minute in (("plan", 3), ("tasks", 4)):
        for kind in ("start", "complete"):
            fold.append({"step": step, "substep": "fast-path", "kind": kind,
                         "by": "ai", "at": _iso(minute)})
    return fold


class FastPathFoldTimingTests(QualityEvalBase):
    def test_folded_run_trusts_specify_plan_tasks(self) -> None:
        self.write_spec(history=_fastpath_fold())
        status, _, detail = next(row for row in self.run_report().rows
                                 if row[1] == "trusted-boundaries")
        self.assertEqual(status, "PASS")
        self.assertIn("3/3", detail)

    def test_folded_spans_are_trusted_in_derivation(self) -> None:
        spans = cq._derive_trusted_spans(_fastpath_fold())
        self.assertEqual(set(spans), {"specify", "plan", "tasks"})

    def test_legacy_ai_fold_leaves_plan_and_tasks_untrusted(self) -> None:
        self.write_spec(history=_legacy_fastpath_fold())
        status, _, detail = next(row for row in self.run_report().rows
                                 if row[1] == "trusted-boundaries")
        self.assertEqual(status, "WARN")
        self.assertIn("plan", detail)
        self.assertIn("tasks", detail)

    def test_legacy_ai_fold_trusts_nothing_in_derivation(self) -> None:
        spans = cq._derive_trusted_spans(_legacy_fastpath_fold())
        self.assertNotIn("plan", spans)
        self.assertNotIn("tasks", spans)


class PromptingTests(QualityEvalBase):
    def build_commands(self, mutate: dict[str, str] | None = None,
                       drop: set[str] | None = None,
                       clarify_text: str = "Present EXACTLY ONE question at a time.") -> Path:
        commands = self.root / "ext" / "commands"
        ask_dir = self.root / "ext" / "presets" / "companion-standard" / "commands"
        commands.mkdir(parents=True)
        ask_dir.mkdir(parents=True)
        for name in cq.NEVER_PROMPT:
            if drop and name in drop:
                continue
            body = (mutate or {}).get(name, "# Hook\nRun the writer script.\n")
            (commands / name).write_text(body)
        (ask_dir / "speckit.clarify.md").write_text(f"# Clarify\n{clarify_text}\n")
        return commands

    def run_prompting(self, commands: Path) -> "cq.Report":
        r = cq.Report()
        cq.check_prompting(r, commands)
        return r

    def test_clean_roster_passes(self) -> None:
        r = self.run_prompting(self.build_commands())
        self.assertEqual(r.failed, 0)
        self.assertEqual(self.statuses(r)["must-ask-clarify"], "PASS")

    def test_planted_prompt_fails_that_command(self) -> None:
        r = self.run_prompting(self.build_commands(
            mutate={"speckit.companion.after-plan.md":
                    "# Hook\nAsk the user before continuing.\n"}))
        status, _, detail = next(row for row in r.rows
                                 if row[1] == "never-prompts-after-plan")
        self.assertEqual(status, "FAIL")
        self.assertIn("Ask the user", detail)

    def test_negated_mention_is_not_flagged(self) -> None:
        r = self.run_prompting(self.build_commands(
            mutate={"speckit.companion.status.md":
                    "# Status\nDo not prompt the user with option tables.\n"}))
        self.assertEqual(self.statuses(r)["never-prompts-status"], "PASS")

    def test_fenced_template_is_not_flagged(self) -> None:
        r = self.run_prompting(self.build_commands(
            mutate={"speckit.companion.resume.md":
                    "# Resume\n```\nAsk the user before continuing.\n```\n"}))
        self.assertEqual(self.statuses(r)["never-prompts-resume"], "PASS")

    def test_missing_roster_file_fails_loud(self) -> None:
        r = self.run_prompting(self.build_commands(
            drop={"speckit.companion.mark-complete.md"}))
        status, _, detail = next(row for row in r.rows
                                 if row[1] == "never-prompts-mark-complete")
        self.assertEqual(status, "FAIL")
        self.assertIn("missing", detail)

    def test_non_utf8_roster_file_fails_structured(self) -> None:
        commands = self.build_commands()
        (commands / "speckit.companion.status.md").write_bytes(b"\xff\xfe junk")
        status, _, detail = next(row for row in self.run_prompting(commands).rows
                                 if row[1] == "never-prompts-status")
        self.assertEqual(status, "FAIL")
        self.assertIn("unreadable", detail)

    def test_clarify_without_ask_fails(self) -> None:
        r = self.run_prompting(self.build_commands(
            clarify_text="Just rewrite the spec silently."))
        self.assertEqual(self.statuses(r)["must-ask-clarify"], "FAIL")

    def test_prompt_without_article_still_flagged(self) -> None:
        r = self.run_prompting(self.build_commands(
            mutate={"speckit.companion.after-plan.md":
                    "# Hook\nAsk user before continuing.\n"}))
        self.assertEqual(self.statuses(r)["never-prompts-after-plan"], "FAIL")

    def test_bare_not_does_not_excuse_prompt(self) -> None:
        r = self.run_prompting(self.build_commands(
            mutate={"speckit.companion.status.md":
                    "# Status\nIf not possible, ask the user how to proceed.\n"}))
        self.assertEqual(self.statuses(r)["never-prompts-status"], "FAIL")

    def test_bare_ask_does_not_match_tasks(self) -> None:
        r = self.run_prompting(self.build_commands(
            mutate={"speckit.companion.after-tasks.md":
                    "# Hook\nRecord the tasks completion into the context file.\n"}))
        self.assertEqual(self.statuses(r)["never-prompts-after-tasks"], "PASS")


class CliTests(QualityEvalBase):
    def _main(self, argv: list[str]) -> tuple[int, str]:
        buf = io.StringIO()
        with redirect_stdout(buf):
            code = cq.main(argv)
        return code, buf.getvalue()

    def test_strict_exits_nonzero_on_fail(self) -> None:
        self.write_spec(history=_healthy_history(), plan_lines=350)
        code, _ = self._main(["--strict", "--feature-dir", str(self.spec_dir)])
        self.assertEqual(code, 1)

    def test_strict_ignores_warn(self) -> None:
        self.write_spec(history=_healthy_history(), plan_lines=200)
        code, _ = self._main(["--strict", "--feature-dir", str(self.spec_dir)])
        self.assertEqual(code, 0)

    def test_non_strict_exits_zero_even_on_fail(self) -> None:
        self.write_spec(history=_healthy_history(), plan_lines=350)
        code, _ = self._main(["--feature-dir", str(self.spec_dir)])
        self.assertEqual(code, 0)

    def test_json_output_shape(self) -> None:
        self.write_spec(history=_healthy_history())
        code, out = self._main(["--json", "--feature-dir", str(self.spec_dir)])
        self.assertEqual(code, 0)
        payload = json.loads(out)
        self.assertIn("checks", payload)
        self.assertIn("failed", payload)
        self.assertIn("warned", payload)
        self.assertTrue(all({"status", "id", "detail"} <= set(c) for c in payload["checks"]))

    def test_no_target_is_a_usage_error(self) -> None:
        with self.assertRaises(SystemExit) as ctx:
            with redirect_stdout(io.StringIO()):
                cq.main([])
        self.assertEqual(ctx.exception.code, 2)


class LivingSpecsAccountabilityTests(QualityEvalBase):
    def _write_ctx(self, ctx: dict) -> None:
        (self.spec_dir / ".spec-context.json").write_text(json.dumps(ctx))

    def _row(self, r: "cq.Report"):
        return {cid: (status, detail) for status, cid, detail in r.rows}.get(
            "living-specs-accountability")

    def _report(self) -> "cq.Report":
        r = cq.Report()
        cq.check_living_specs_accountability(r, self.spec_dir)
        return r

    def test_completed_with_unaccounted_capability_warns(self) -> None:
        self._write_ctx({"status": "completed",
                         "livingSpecs": {"loaded": ["todos", "checkout"], "synced": ["todos"]}})
        status, detail = self._row(self._report())
        self.assertEqual(status, "WARN")
        self.assertIn("checkout", detail)

    def test_completed_all_folded_passes(self) -> None:
        self._write_ctx({"status": "completed",
                         "livingSpecs": {"loaded": ["todos"], "synced": ["todos"]}})
        self.assertEqual(self._row(self._report())[0], "PASS")

    def test_completed_all_skipped_passes(self) -> None:
        self._write_ctx({"status": "completed",
                         "livingSpecs": {"loaded": ["todos"],
                                         "skipped": [{"name": "todos", "reason": "render-only"}]}})
        self.assertEqual(self._row(self._report())[0], "PASS")

    def test_mixed_folded_and_skipped_passes(self) -> None:
        self._write_ctx({"status": "completed",
                         "livingSpecs": {"loaded": ["todos", "checkout"], "synced": ["todos"],
                                         "skipped": [{"name": "checkout", "reason": "unrelated"}]}})
        self.assertEqual(self._row(self._report())[0], "PASS")

    def test_not_completed_is_not_checked(self) -> None:
        self._write_ctx({"status": "implemented",
                         "livingSpecs": {"loaded": ["todos"]}})
        self.assertIsNone(self._row(self._report()))

    def test_completed_with_no_loaded_caps_is_not_checked(self) -> None:
        self._write_ctx({"status": "completed", "livingSpecs": {"loaded": []}})
        self.assertIsNone(self._row(self._report()))

    def test_warn_never_fails_the_run(self) -> None:
        self._write_ctx({"status": "completed",
                         "livingSpecs": {"loaded": ["todos"]}})
        r = self._report()
        self.assertEqual(self._row(r)[0], "WARN")
        self.assertEqual(r.failed, 0)


if __name__ == "__main__":
    unittest.main()
