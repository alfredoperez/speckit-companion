#!/usr/bin/env python3
"""The task grammar this side reads must match the one the VS Code side reads.

Both halves parse a task list to answer the same question — is every task done —
and they answered it differently: this side required a task id and ignored code
fences, the other side required no id and skipped fences. A list could therefore
read 100% complete here while the viewer still showed tasks outstanding, and
reaching 100% here flips the spec's status.

`tests/fixtures/task-grammar/` at the repo root holds the cases the two must
agree on. `src/core/utils/__tests__/taskCheckboxes.test.ts` asserts the same
expectations against the same fixture.

Stdlib `unittest` only.
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

FIXTURE = Path(__file__).resolve().parent.parent.parent / "tests" / "fixtures" / "task-grammar"

from task_sync import parse_task_markers, prose_lines  # noqa: E402


class SharedTaskGrammarFixture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.expected = json.loads((FIXTURE / "expected.json").read_text(encoding="utf-8"))
        cls.tasks_md = FIXTURE / "tasks.md"

    def test_the_fixture_is_where_both_suites_expect_it(self):
        self.assertTrue(self.tasks_md.is_file(), f"missing shared fixture: {self.tasks_md}")

    def test_finds_the_same_task_ids_in_document_order(self):
        all_ids, done_ids = parse_task_markers(self.tasks_md)
        self.assertEqual(all_ids, self.expected["allTaskIds"])
        self.assertEqual(done_ids, self.expected["completedTaskIds"])

    def test_counts_what_both_parsers_must_count(self):
        all_ids, done_ids = parse_task_markers(self.tasks_md)
        self.assertEqual(len(all_ids), self.expected["total"])
        self.assertEqual(len(done_ids), self.expected["checked"])


class CheckboxesInsideCodeAreNotWork(unittest.TestCase):
    """The fence rule this side was missing entirely."""

    def test_a_fenced_checkbox_is_documentation(self):
        content = "```markdown\n- [x] T901 example\n```\n- [ ] T001 real"
        self.assertEqual([l for l in prose_lines(content) if "T901" in l], [])
        self.assertTrue(any("T001" in l for l in prose_lines(content)))

    def test_an_inline_code_span_checkbox_is_documentation(self):
        content = "Write it as `- [x] T901` in the list.\n- [ ] T001 real"
        self.assertEqual([l for l in prose_lines(content) if "T901" in l], [])

    def test_a_fence_of_the_other_kind_does_not_close_the_block(self):
        content = "```\n~~~\n- [x] T901 example\n```\n- [ ] T001 real"
        self.assertEqual([l for l in prose_lines(content) if "T901" in l], [])

    def test_a_task_whose_description_holds_inline_code_still_counts(self):
        content = "- [x] **T001** fix `foo.py`"
        self.assertTrue(any("T001" in l for l in prose_lines(content)))


if __name__ == "__main__":
    unittest.main()
