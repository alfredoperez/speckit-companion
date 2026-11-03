#!/usr/bin/env python3
"""`--fold plan,tasks`: a simple spec's plan and tasks recorded in one writer call."""

from __future__ import annotations

import contextlib
import importlib
import io
import json
import sys
import tempfile
import unittest
from unittest import mock
from datetime import datetime
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
NODES = Path(__file__).resolve().parent.parent / "nodes"
sys.path.insert(0, str(SCRIPTS))
wc = importlib.import_module("write-context")

FOLD = [("plan", "start"), ("plan", "complete"), ("tasks", "start"), ("tasks", "complete")]


def _ctx(feature_dir: Path) -> dict:
    return json.loads((feature_dir / ".spec-context.json").read_text())


def _boundaries(ctx: dict) -> list:
    return [
        h for h in ctx["history"]
        if h["step"] in ("plan", "tasks") and h.get("substep") is None and h.get("task") is None
    ]


class FoldPlanTasksTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.fd = Path(self._tmp.name) / "specs" / "_zzz-fold"
        self.fd.mkdir(parents=True)
        wc.update_context(self.fd, "specify", "specifying", "extension", "start")
        wc.update_context(self.fd, "specify", "specified", "extension", "complete")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _run(self, *argv: str) -> int:
        argv = ["write-context.py", "--feature-dir", str(self.fd), *argv]
        with mock.patch.object(sys, "argv", argv), \
                contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            return wc.main()

    def test_records_four_boundaries_in_order(self) -> None:
        self.assertEqual(self._run("--fold", "plan,tasks", "--by", "extension"), 0)
        ctx = _ctx(self.fd)
        got = _boundaries(ctx)
        self.assertEqual([(h["step"], h["kind"]) for h in got], FOLD)
        self.assertTrue(all(h["by"] == "extension" for h in got))
        self.assertEqual((ctx["currentStep"], ctx["status"]), ("tasks", "ready-to-implement"))

    def test_stamps_strictly_increase(self) -> None:
        self._run("--fold", "plan,tasks")
        stamps = [datetime.fromisoformat(h["at"].replace("Z", "+00:00")) for h in _boundaries(_ctx(self.fd))]
        self.assertTrue(all(a < b for a, b in zip(stamps, stamps[1:])), stamps)

    def test_second_fold_changes_nothing(self) -> None:
        self._run("--fold", "plan,tasks")
        before = (self.fd / ".spec-context.json").read_bytes()
        self.assertEqual(self._run("--fold", "plan,tasks"), 0)
        self.assertEqual((self.fd / ".spec-context.json").read_bytes(), before)

    def test_partial_fold_is_completed_without_duplicates(self) -> None:
        wc.update_context(self.fd, "plan", None, "extension", "start")
        self._run("--fold", "plan,tasks")
        self.assertEqual([(h["step"], h["kind"]) for h in _boundaries(_ctx(self.fd))], FOLD)

    def test_out_of_order_partial_is_left_alone(self) -> None:
        wc.update_context(self.fd, "plan", None, "extension", "complete")
        before = (self.fd / ".spec-context.json").read_bytes()
        self.assertEqual(self._run("--fold", "plan,tasks"), 0)
        self.assertEqual((self.fd / ".spec-context.json").read_bytes(), before)

    def test_shipped_spec_is_left_alone(self) -> None:
        ctx = _ctx(self.fd)
        ctx["status"] = "completed"
        (self.fd / ".spec-context.json").write_text(json.dumps(ctx))
        self._run("--fold", "plan,tasks")
        self.assertEqual(_boundaries(_ctx(self.fd)), [])

    def test_never_moves_a_later_spec_backward(self) -> None:
        self._run("--fold", "plan,tasks")
        wc.update_context(self.fd, "implement", "implementing", "extension", "start")
        before = (self.fd / ".spec-context.json").read_bytes()
        self.assertEqual(self._run("--fold", "plan,tasks"), 0)
        self.assertEqual((self.fd / ".spec-context.json").read_bytes(), before)

    def test_other_values_are_a_caller_error(self) -> None:
        self.assertEqual(self._run("--fold", "plan"), 2)
        self.assertEqual(_boundaries(_ctx(self.fd)), [])
        self.fd = self.fd.parent / "missing"
        self.assertEqual(self._run("--fold", "plan"), 2)

    def test_finalize_holds_one_fold_line(self) -> None:
        body = (NODES / "specify" / "finalize.md").read_text()
        self.assertEqual(body.count("--fold plan,tasks"), 1)
        self.assertNotIn("--step plan", body)
        self.assertNotIn("--step tasks", body)


if __name__ == "__main__":
    unittest.main()
