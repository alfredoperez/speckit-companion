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

    def test_coverage_with_no_tasks_and_no_tests_is_a_noop(self) -> None:
        # A bare --coverage-req must not fake an empty {} coverage entry.
        self.assertIsNone(wc.upsert_coverage(self.fd, "FR-001", None, None))
        self.assertIsNone(wc.upsert_coverage(self.fd, "FR-001", [], []))
        self.assertFalse((self.fd / ".spec-context.json").exists())

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


if __name__ == "__main__":
    unittest.main()
