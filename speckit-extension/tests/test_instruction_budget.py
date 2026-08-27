#!/usr/bin/env python3
"""The directive counter, and the guarantee that it stays additive.

The counter exists so the instruction budget is a number somebody can act on
rather than something produced by hand once. These tests hold two things: that
it counts what it claims to count, and that reporting it changed no command body
— the count is printed alongside assembly, never woven into it.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import io
import contextlib
import subprocess
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

budget = importlib.import_module("instruction-budget")
assemble = importlib.import_module("assemble-nodes")


class CountsWhatItClaimsTo(unittest.TestCase):
    def test_numbered_steps_list_items_and_bold_lead_ins_each_count_once(self):
        text = "1. do this\n- and this\n* and this\n**Then this.** trailing prose\n"
        self.assertEqual(budget.directives(text), 4)

    def test_prose_headings_and_comments_are_not_directives(self):
        text = "# Heading\n\nA paragraph of explanation.\n<!-- a note -->\n"
        self.assertEqual(budget.directives(text), 0)

    def test_fenced_code_is_what_the_model_runs_not_another_rule(self):
        text = "- one real directive\n\n```bash\n- not a directive\n1. nor this\n```\n"
        self.assertEqual(budget.directives(text), 1)

    def test_frontmatter_is_not_counted(self):
        text = "---\ndescription: x\n- not a directive\n---\n- one directive\n"
        self.assertEqual(budget.directives(text), 1)

    def test_a_commands_own_load_is_reported_apart_from_the_shared_parts(self):
        specify = SCRIPTS.parent / "commands" / "speckit.companion.specify.md"
        row = budget.measure(str(specify))
        self.assertEqual(row["total"], row["own"] + row["shared"])
        self.assertGreater(row["shared"], 0, "the shared parts stopped being recognised")
        self.assertGreater(row["own"], 0)


class TheFencePatternIsNotCopied(unittest.TestCase):
    def test_the_counter_reads_the_same_fence_the_assembler_writes(self):
        import _command_parts
        self.assertIs(budget._PART_FENCE, _command_parts.PART_FENCE)


class ReportingIsAdditive(unittest.TestCase):
    def test_assembly_still_matches_golden_with_the_report_wired_in(self):
        # The report is printed after the check, never woven into it: every
        # command body must still equal its golden byte for byte.
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "assemble-nodes.py"), "--check"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("[assemble] directives —", result.stdout)

    def test_the_report_names_every_assembled_command(self):
        commands = assemble.decomposed_commands()
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            assemble._report_budget(commands)
        line = out.getvalue()
        self.assertIn("[assemble] directives —", line)
        for command in commands:
            self.assertIn(command, line, f"{command} missing from the budget report")

    def test_the_report_never_raises_even_if_a_body_is_missing(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            assemble._report_budget(["not-a-real-command"])
        self.assertEqual(out.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
