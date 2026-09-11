"""A capture flag is only worth anything if a shipped command reaches for it.

The `aligns` edge shipped complete and dead: the marker parsed, the hop worked, both were
covered by tests, and no command body ever passed the flag, so in a real run it never fired
once. This is the same class of gap for `--verify-run`, and the same kind of test.
"""
from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPLEMENT = ROOT / "commands" / "speckit.companion.implement.md"
NODE = ROOT / "nodes" / "implement" / "implement-exec.md"


class ImplementRunsItsChecks(unittest.TestCase):
    def test_the_body_reaches_for_the_runner(self):
        self.assertIn("--verify-run", IMPLEMENT.read_text(encoding="utf-8"),
                      "implement records verifications without ever running one")

    def test_the_flag_it_names_is_the_one_the_script_accepts(self):
        script = (ROOT / "scripts" / "write-context.py").read_text(encoding="utf-8")
        self.assertIn('"--verify-run"', script)

    def test_the_separator_the_body_shows_is_the_one_that_parses(self):
        # A body teaching `<what>:<command>` would read fine and be skipped at runtime.
        body = IMPLEMENT.read_text(encoding="utf-8")
        self.assertRegex(body, r"--verify-run\s+\"?<[^>]+>::<[^>]+>")

    def test_it_says_what_the_other_flag_is_still_for(self):
        # Without this the two read as alternatives and the distinction dies in a week.
        body = IMPLEMENT.read_text(encoding="utf-8")
        self.assertIn("cannot be run", body)

    def test_the_node_and_the_built_body_agree(self):
        node = NODE.read_text(encoding="utf-8")
        self.assertEqual(node.count("--verify-run"),
                         IMPLEMENT.read_text(encoding="utf-8").count("--verify-run"))


if __name__ == "__main__":
    unittest.main()
