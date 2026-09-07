#!/usr/bin/env python3
"""The feature spec resolves to `<short-name>.spec.md` first, then stock `spec.md`."""

from __future__ import annotations

import importlib
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))
from spec_context import _spec_name, feature_spec_path  # noqa: E402

derive_mod = importlib.import_module("derive-from-files")
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "named-spec" / "012-offline-queue"


class FeatureSpecPathTests(unittest.TestCase):
    def test_new_name_wins_over_old(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "spec.md").write_text("# old\n")
            (d / "offline-queue.spec.md").write_text("# new\n")
            self.assertEqual(feature_spec_path(d).name, "offline-queue.spec.md")

    def test_old_name_falls_back(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "spec.md").write_text("# old\n")
            self.assertEqual(feature_spec_path(d), d / "spec.md")

    def test_neither_returns_old_path_for_the_writer(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            self.assertEqual(feature_spec_path(d), d / "spec.md")
            self.assertFalse(feature_spec_path(d).exists())

    def test_fixture_with_new_name_reads_everywhere(self):
        self.assertEqual(_spec_name(FIXTURE), "Offline Queue")
        self.assertEqual(derive_mod._infer(FIXTURE), ("specify", "specified"))


if __name__ == "__main__":
    unittest.main()
