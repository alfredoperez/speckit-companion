#!/usr/bin/env python3
"""Tests for the reasoning-trail capture writers (#392).

Stdlib `unittest` only — run with:

    python3 -m unittest discover speckit-extension/tests

Covers the capture contract: JSON-or-plain-text coercion, de-duped additive
appends (decisions/verified/concerns/expectations), the coverage keyed
non-destructive upsert, step-summary upsert, classification validation, and
the invariant that no capture writer touches lifecycle keys.
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
capture = importlib.import_module("capture")
task_sync = importlib.import_module("task_sync")


def _ctx(feature_dir: Path) -> dict:
    return json.loads((feature_dir / ".spec-context.json").read_text())


class CaptureFieldTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fd = Path(self._tmp.name) / "specs" / "_zzz-capture"
        self.fd.mkdir(parents=True)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    # --- coercion ---------------------------------------------------------

    def test_json_entry_kept_as_is_with_unknown_keys(self) -> None:
        raw = json.dumps({"decision": "store action", "why": "testable", "extra": 1})
        wc.append_capture_entries(self.fd, "decisions", "decision", [raw])
        entry = _ctx(self.fd)["decisions"][0]
        self.assertEqual(entry["decision"], "store action")
        self.assertEqual(entry["why"], "testable")
        self.assertEqual(entry["extra"], 1)

    def test_bare_text_wraps_under_identity_key(self) -> None:
        wc.append_capture_entries(self.fd, "verified", "what", ["npm test 13/13 pass"])
        self.assertEqual(_ctx(self.fd)["verified"], [{"what": "npm test 13/13 pass"}])

    def test_malformed_json_falls_back_to_text_wrap(self) -> None:
        wc.append_capture_entries(self.fd, "concerns", "note", ['{"broken": '])
        # Coercion strips surrounding whitespace before wrapping the raw text.
        self.assertEqual(_ctx(self.fd)["concerns"][0]["note"], '{"broken":')

    def test_json_without_identity_key_wraps_raw_text(self) -> None:
        raw = json.dumps({"why": "orphan rationale"})
        wc.append_capture_entries(self.fd, "decisions", "decision", [raw])
        self.assertEqual(_ctx(self.fd)["decisions"][0]["decision"], raw)

    # --- de-dup / idempotency ----------------------------------------------

    def test_dedupes_on_identity_even_when_why_reworded(self) -> None:
        wc.append_capture_entries(
            self.fd, "decisions", "decision",
            [json.dumps({"decision": "disabled not hidden", "why": "layout stability"})],
        )
        wc.append_capture_entries(
            self.fd, "decisions", "decision",
            [json.dumps({"decision": "disabled not hidden", "why": "reworded rationale"})],
        )
        decisions = _ctx(self.fd)["decisions"]
        self.assertEqual(len(decisions), 1)
        self.assertEqual(decisions[0]["why"], "layout stability")  # first-seen wins

    def test_expectations_string_list_dedupes_preserving_order(self) -> None:
        wc.append_string_list(self.fd, "expectations", ["no undo", "no bulk-select"])
        wc.append_string_list(self.fd, "expectations", ["no undo", "no filter views"])
        self.assertEqual(
            _ctx(self.fd)["expectations"],
            ["no undo", "no bulk-select", "no filter views"],
        )

    def test_prior_bare_string_participates_in_dedup(self) -> None:
        wc.append_capture_entries(self.fd, "verified", "what", ["build clean"])
        wc.append_capture_entries(
            self.fd, "verified", "what",
            [json.dumps({"what": "build clean", "result": "pass"})],
        )
        self.assertEqual(len(_ctx(self.fd)["verified"]), 1)

    def test_empty_values_are_a_noop(self) -> None:
        self.assertIsNone(wc.append_capture_entries(self.fd, "decisions", "decision", ["  "]))
        self.assertIsNone(wc.append_string_list(self.fd, "expectations", ["", "  "]))
        self.assertFalse((self.fd / ".spec-context.json").exists())

    # --- coverage upsert ----------------------------------------------------

    def test_coverage_two_phase_merge_is_non_destructive(self) -> None:
        wc.upsert_coverage(self.fd, "FR-001", ["T001", "T002"], None)
        wc.upsert_coverage(self.fd, "FR-001", None, ["a.test.ts::case"])
        entry = _ctx(self.fd)["coverage"]["FR-001"]
        self.assertEqual(entry["tasks"], ["T001", "T002"])
        self.assertEqual(entry["tests"], ["a.test.ts::case"])

    def test_coverage_upsert_keeps_other_requirements(self) -> None:
        wc.upsert_coverage(self.fd, "FR-001", ["T001"], None)
        wc.upsert_coverage(self.fd, "FR-002", ["T002"], None)
        cov = _ctx(self.fd)["coverage"]
        self.assertEqual(sorted(cov.keys()), ["FR-001", "FR-002"])

    def test_coverage_blank_req_is_a_noop(self) -> None:
        self.assertIsNone(wc.upsert_coverage(self.fd, "  ", ["T001"], None))

    def test_coverage_with_no_tasks_tests_or_title_is_a_noop(self) -> None:
        # A bare --coverage-req must not fake an empty {} coverage entry.
        self.assertIsNone(wc.upsert_coverage(self.fd, "FR-001", None, None))
        self.assertIsNone(wc.upsert_coverage(self.fd, "FR-001", [], [], "  "))
        self.assertFalse((self.fd / ".spec-context.json").exists())

    def test_coverage_title_upserts_and_composes_with_lists(self) -> None:
        wc.upsert_coverage(self.fd, "FR-001", ["T001"], None, "Capability nodes offer a drift action")
        wc.upsert_coverage(self.fd, "FR-001", None, ["a.test.ts::case"])
        entry = _ctx(self.fd)["coverage"]["FR-001"]
        self.assertEqual(entry["title"], "Capability nodes offer a drift action")
        self.assertEqual(entry["tasks"], ["T001"])
        self.assertEqual(entry["tests"], ["a.test.ts::case"])

    def test_coverage_title_alone_is_recordable(self) -> None:
        wc.upsert_coverage(self.fd, "FR-002", None, None, "Titled but unmapped requirement")
        self.assertEqual(_ctx(self.fd)["coverage"]["FR-002"], {"title": "Titled but unmapped requirement"})

    # --- step summaries -----------------------------------------------------

    def test_step_summary_text_wraps_and_json_merges(self) -> None:
        wc.upsert_step_summary(self.fd, "plan", "split the writer into helpers")
        wc.upsert_step_summary(
            self.fd, "plan", json.dumps({"summary": "split the writer", "key_finding": "helpers reused"})
        )
        entry = _ctx(self.fd)["step_summaries"]["plan"]
        self.assertEqual(entry["summary"], "split the writer")
        self.assertEqual(entry["key_finding"], "helpers reused")

    def test_step_summary_keys_steps_independently(self) -> None:
        wc.upsert_step_summary(self.fd, "plan", "plan summary")
        wc.upsert_step_summary(self.fd, "implement", "implement summary")
        summaries = _ctx(self.fd)["step_summaries"]
        self.assertEqual(sorted(summaries.keys()), ["implement", "plan"])

    def test_step_summary_rejects_non_canonical_step(self) -> None:
        # A typo'd --step must no-op, not pollute step_summaries with an invalid key.
        self.assertIsNone(wc.upsert_step_summary(self.fd, "plann", "typo step"))
        self.assertFalse((self.fd / ".spec-context.json").exists())

    # --- classification -----------------------------------------------------

    def test_classification_stores_valid_object(self) -> None:
        wc.set_classification(
            self.fd,
            json.dumps({"projectedFiles": 8, "projectedTasks": 16, "scopeSignal": "none", "verdict": "normal"}),
        )
        entry = _ctx(self.fd)["classification"]
        self.assertEqual(entry["verdict"], "normal")
        self.assertEqual(entry["projectedFiles"], 8)

    def test_classification_rejects_bad_json_and_bad_verdict(self) -> None:
        with self.assertRaises(ValueError):
            wc.set_classification(self.fd, "{not json")
        with self.assertRaises(ValueError):
            wc.set_classification(self.fd, json.dumps({"verdict": "huge"}))
        with self.assertRaises(ValueError):
            wc.set_classification(self.fd, json.dumps(["not", "an", "object"]))

    # --- lifecycle invariants -----------------------------------------------

    def test_capture_writers_never_touch_lifecycle_keys(self) -> None:
        wc.update_context(self.fd, "plan", "planned", "extension", kind="complete")
        before = _ctx(self.fd)
        wc.append_capture_entries(self.fd, "decisions", "decision", ["a decision"])
        wc.append_string_list(self.fd, "expectations", ["a non-goal"])
        wc.upsert_coverage(self.fd, "FR-001", ["T001"], None)
        wc.upsert_step_summary(self.fd, "plan", "summary")
        wc.set_classification(self.fd, json.dumps({"verdict": "simple"}))
        after = _ctx(self.fd)
        self.assertEqual(after["status"], before["status"])
        self.assertEqual(after["currentStep"], before["currentStep"])
        self.assertEqual(after["history"], before["history"])

    def test_unknown_top_level_fields_preserved_across_capture(self) -> None:
        wc.set_fields(self.fd, ["custom_marker=keep-me"])
        wc.append_capture_entries(self.fd, "decisions", "decision", ["a decision"])
        self.assertEqual(_ctx(self.fd)["custom_marker"], "keep-me")


class ContextCaptureTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fd = Path(self._tmp.name) / "specs" / "_zzz-context"
        self.fd.mkdir(parents=True)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_context_appends_deduped_preserving_order(self) -> None:
        wc.append_string_list(self.fd, "context", ["living spec: checkout", "area: src/features/specs"])
        wc.append_string_list(self.fd, "context", ["living spec: checkout", "constraint: isolation rule"])
        self.assertEqual(
            _ctx(self.fd)["context"],
            ["living spec: checkout", "area: src/features/specs", "constraint: isolation rule"],
        )

    def test_context_empty_values_are_a_noop(self) -> None:
        self.assertIsNone(wc.append_string_list(self.fd, "context", ["", "  "]))
        self.assertFalse((self.fd / ".spec-context.json").exists())

    def test_context_never_touches_lifecycle(self) -> None:
        wc.update_context(self.fd, "specify", "specified", "extension", kind="complete")
        before = _ctx(self.fd)
        wc.append_string_list(self.fd, "context", ["area: webview"])
        after = _ctx(self.fd)
        self.assertEqual(after["history"], before["history"])
        self.assertEqual(after["status"], before["status"])


if __name__ == "__main__":
    unittest.main()


class BatchCaptureTests(unittest.TestCase):
    """`--batch`: one call, one read-modify-write, the same record as the volley."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        (self.dir / ".spec-context.json").write_text(
            json.dumps({"workflow": "companion", "specName": "X", "branch": "b",
                        "currentStep": "implement", "status": "implementing", "history": []}) + "\n",
            encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def ctx(self):
        return json.loads((self.dir / ".spec-context.json").read_text(encoding="utf-8"))

    def test_the_batch_records_what_the_separate_calls_record(self):
        doc = {
            "verified": [{"what": "suite", "result": "pass"}],
            "decisions": [{"decision": "chose A", "why": "simpler"}],
            "concerns": [{"note": "flaky on CI", "step": "implement"}],
            "expectations": ["no panel in this pass"],
            "context": ["area: scripts"],
            "coverage": [{"req": "FR-001", "tasks": ["T001"], "tests": ["t.py::x"]}],
            "step_summary": {"step": "implement", "summary": "shipped"},
            "last_action": "done",
        }
        target, landed = capture.apply_batch(self.dir, json.dumps(doc), "implement")
        self.assertIsNotNone(target)
        c = self.ctx()
        self.assertEqual(len(c["verified"]), 1)
        self.assertEqual(len(c["decisions"]), 1)
        self.assertEqual(len(c["concerns"]), 1)
        self.assertEqual(c["expectations"], ["no panel in this pass"])
        self.assertEqual(c["context"], ["area: scripts"])
        self.assertEqual(c["coverage"]["FR-001"]["tasks"], ["T001"])
        self.assertEqual(c["step_summaries"]["implement"]["summary"], "shipped")
        self.assertEqual(c["last_action"], "done")
        self.assertEqual(len(landed), 8)

    def test_re_running_the_same_batch_never_duplicates(self):
        doc = {"verified": [{"what": "suite", "result": "pass"}],
               "decisions": [{"decision": "chose A"}]}
        capture.apply_batch(self.dir, json.dumps(doc), "implement")
        capture.apply_batch(self.dir, json.dumps(doc), "implement")
        c = self.ctx()
        self.assertEqual(len(c["verified"]), 1)
        self.assertEqual(len(c["decisions"]), 1)

    def test_an_empty_batch_writes_nothing(self):
        target, landed = capture.apply_batch(self.dir, "{}", "implement")
        self.assertIsNone(target)
        self.assertEqual(landed, [])

    def test_a_malformed_batch_is_rejected_before_anything_is_written(self):
        for bad in ('not json', '[]', '{"nope": 1}', '{"verified": "text"}',
                    '{"coverage": [{"tasks": []}]}', '{"step_summary": []}'):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    capture._parsed_batch(bad)
        self.assertNotIn("verified", self.ctx())


class CloseTaskTests(unittest.TestCase):
    """`--close-task`: append + fold in one call, for the main agent only."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        (self.dir / ".spec-context.json").write_text(
            json.dumps({"workflow": "companion", "specName": "X", "branch": "b",
                        "currentStep": "implement", "status": "implementing",
                        "history": [{"step": "implement", "substep": None, "kind": "start",
                                     "by": "extension", "at": "2026-08-01T11:00:00Z"}]}) + "\n",
            encoding="utf-8")
        (self.dir / "tasks.md").write_text(
            "- [ ] **T001** First · a.py\n- [ ] **T002** Second · b.py\n", encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def ctx(self):
        return json.loads((self.dir / ".spec-context.json").read_text(encoding="utf-8"))

    def test_one_call_journals_the_finish_and_checks_the_box(self):
        task_sync.close_task(self.dir, "T001", "ai", "did the thing", ["a.py"])
        c = self.ctx()
        self.assertTrue(any(e.get("task") == "T001" for e in c["history"]))
        self.assertEqual(c["task_summaries"]["T001"]["did"], "did the thing")
        self.assertIn("- [x] **T001**", (self.dir / "tasks.md").read_text(encoding="utf-8"))

    def test_it_matches_what_append_then_materialize_produces(self):
        task_sync.append_task_log(self.dir, "T001", "ai", "did the thing", ["a.py"])
        task_sync.materialize_log(self.dir, "ai", quiet=True)
        split = self.ctx()

        self.tearDown()
        self.setUp()
        task_sync.close_task(self.dir, "T001", "ai", "did the thing", ["a.py"])
        merged = self.ctx()

        for c in (split, merged):
            for e in c["history"]:
                e.pop("at", None)
        self.assertEqual(split["history"], merged["history"])
        self.assertEqual(split["task_summaries"], merged["task_summaries"])

    def test_closing_the_same_task_twice_never_double_counts(self):
        task_sync.close_task(self.dir, "T001", "ai", "once", ["a.py"])
        task_sync.close_task(self.dir, "T001", "ai", "once", ["a.py"])
        finishes = [e for e in self.ctx()["history"] if e.get("task") == "T001"]
        self.assertEqual(len(finishes), 1)
