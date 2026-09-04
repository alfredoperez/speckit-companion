#!/usr/bin/env python3
"""The supported `companion.yml` subset, held against the editor's copy of the rule.

This reader decides what the runtime applies. The VS Code side has its own
implementation of the same rule, so that the editor never presents a
configuration the runtime is going to refuse — and the two cannot share code
across the language boundary.

Issue #608 asked for one place or a shared set of fixtures. The duplication
landed without the fixtures, so the two rules could drift with nothing to
notice. `tests/fixtures/config-subset/cases.json` at the repo root is that
corpus, and `src/features/specs/__tests__/configSubsetFixtures.test.ts` runs the
same file: a case the two answer differently fails one of the builds.

Stdlib `unittest` only.
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

FIXTURE = EXT.parent / "tests" / "fixtures" / "config-subset" / "cases.json"

import companion_config as cc  # noqa: E402


def _runtime_accepts(text: str) -> bool:
    """Whether the runtime reader parses this configuration or falls back."""
    try:
        cc.load_yaml(text)
        return True
    except SystemExit:
        return False
    except Exception:  # noqa: BLE001 — any refusal is a refusal
        return False


class TheSharedSubsetCorpus(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases = json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]

    def test_the_corpus_is_where_both_suites_expect_it(self):
        self.assertTrue(FIXTURE.is_file(), f"missing shared corpus: {FIXTURE}")

    def test_the_corpus_exercises_both_sides_of_the_rule(self):
        self.assertTrue(any(c["supported"] for c in self.cases))
        self.assertTrue(any(not c["supported"] for c in self.cases))

    def test_every_case_gets_the_verdict_the_editor_gives_it(self):
        for case in self.cases:
            with self.subTest(case=case["name"]):
                accepted = _runtime_accepts(case["yaml"])
                self.assertEqual(
                    accepted, case["supported"],
                    f"{case['name']}: runtime {'accepted' if accepted else 'refused'} it, "
                    f"the editor says it should be "
                    f"{'accepted' if case['supported'] else 'refused'}",
                )


if __name__ == "__main__":
    unittest.main()
