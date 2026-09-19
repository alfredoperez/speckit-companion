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
        _, findings = doctor_checks.check_dispatch(d, json.loads((d / ".spec-context.json").read_text()))
        titles = [f.title for f in findings]
        self.assertIn("plan read the code inline instead of dispatching 2 readers", titles)
        self.assertEqual(len(findings), 2)

    def test_checkins_clear_the_finding(self):
        d = self._feature(context=["area: src/a", "area: src/b"], size="normal")
        for label in ("reader: 1", "doc: data-model.md"):
            self.assertEqual(self._run(d, "--checkin", label).returncode, 0)
        _, findings = doctor_checks.check_dispatch(d, json.loads((d / ".spec-context.json").read_text()))
        self.assertEqual(findings, [])


if __name__ == "__main__":
    unittest.main()
