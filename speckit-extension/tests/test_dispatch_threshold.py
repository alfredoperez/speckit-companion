"""Implement dispatches on phase size, and the shipped body says so.

Two replay experiments decided this. On a feature whose phases ran to 4, 4, 2 and 1 files,
fanning out cost roughly twice as much and bought no correctness and no wall-clock at all.
On one whose phases ran to 8, 6, 3 and 1, it saved about three minutes. A worker pays the
same startup whatever it is handed, so below roughly five files that startup is the whole
cost.

The rule lived in a command body as bold prose saying the opposite — dispatch every phase,
"not a judgement about how big the phase is" — so this pins the corrected rule where a
future edit would otherwise quietly restore it.
"""
from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BODY = ROOT / "commands" / "speckit.companion.implement.md"
NODE = ROOT / "nodes" / "implement" / "implement-exec.md"


class TheShippedBodyCarriesTheThreshold(unittest.TestCase):
    def test_the_dispatch_instruction_names_a_file_count(self):
        text = BODY.read_text(encoding="utf-8")
        self.assertRegex(
            text, r"five or more files",
            "the implement body no longer states the phase-size threshold")

    def test_it_no_longer_says_size_is_not_a_factor(self):
        # The exact claims the measurements overturned. A future edit restoring either one
        # puts the pipeline back to paying for workers that buy nothing.
        text = BODY.read_text(encoding="utf-8")
        for claim in ("not a judgement about how big the phase is",
                      "A thin phase is still dispatched"):
            self.assertNotIn(claim, text, f"the overturned claim is back: {claim!r}")

    def test_an_auto_run_is_not_a_reason_to_build_inline(self):
        # Auto runs the whole pipeline in one session; that used to switch the fan-out off.
        text = BODY.read_text(encoding="utf-8")
        self.assertIn("that alone decides it", text)
        self.assertIn("It holds in an auto run too", text)

    def test_foundational_goes_through_the_wave_script_and_setup_and_polish_stay_inline(self):
        text = BODY.read_text(encoding="utf-8")
        self.assertIn("dispatch-briefs.py --feature-dir <feature_directory> --waves", text)
        self.assertIn("Setup and Polish stay with you", text)
        self.assertNotIn("Setup, Foundational and Polish always stay with you", text)

    def test_the_node_and_the_built_body_agree(self):
        # The body is assembled from the node, so a threshold edited in one and not the
        # other means the shipped command and its source disagree about the rule.
        node = NODE.read_text(encoding="utf-8")
        body = BODY.read_text(encoding="utf-8")
        counts = re.findall(r"five or more files", node)
        self.assertTrue(counts, "the node does not state the threshold")
        self.assertEqual(len(counts), len(re.findall(r"five or more files", body)))


if __name__ == "__main__":
    unittest.main()
