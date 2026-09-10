"""The `aligns` edge is only worth anything if a shipped command asks for it.

The resolver's own behaviour is covered elsewhere. This covers the gap that let the
feature ship dead: the marker parsed, the hop worked, every test passed, and no command
body ever passed `--follow-aligns`, so in a real run the edge never fired once.
"""
from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Where a rule from another capability can still change the work. Specify is deliberately
# absent: it writes a feature spec, and a hop into another capability's rules there widens
# the brief without changing what gets written.
LOADS_WITH_THE_HOP = ["commands/speckit.companion.plan.md"]

RESOLVER_CALL = re.compile(r"resolve-spec-paths\.py[^\n`]*--requirements-for[^\n`]*")


class AShippedCommandAsksForTheHop(unittest.TestCase):
    def test_the_plan_command_passes_the_flag(self):
        for rel in LOADS_WITH_THE_HOP:
            with self.subTest(command=rel):
                text = (ROOT / rel).read_text(encoding="utf-8")
                calls = RESOLVER_CALL.findall(text)
                self.assertTrue(calls, f"{rel} makes no --requirements-for call at all")
                self.assertTrue(
                    any("--follow-aligns" in c for c in calls),
                    f"{rel} resolves requirements without --follow-aligns, so the edge never fires:\n"
                    + "\n".join(calls),
                )

    def test_the_flag_the_commands_pass_is_the_one_the_resolver_accepts(self):
        # A body asking for `--follow-align` or `--aligns` would fail silently at runtime.
        resolver = (ROOT / "scripts" / "resolve-spec-paths.py").read_text(encoding="utf-8")
        self.assertIn('"--follow-aligns"', resolver)

    def test_the_hop_is_explained_where_it_is_used(self):
        # A rule reached this way arrives with `matched: false`, which reads like noise to
        # anyone who was not told it is the point.
        node = (ROOT / "nodes" / "plan" / "load-living-specs.md").read_text(encoding="utf-8")
        self.assertIn("aligns", node)
        self.assertIn("matched", node)


if __name__ == "__main__":
    unittest.main()
