"""The companion-standard preset wraps the stock commands instead of copying them."""
import os
import re
import unittest

EXT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRESET = os.path.join(EXT, "presets", "companion-standard")
COMMANDS = ["specify", "clarify", "plan", "tasks", "analyze", "implement", "constitution"]
STEPS = ["specify", "plan", "tasks", "implement"]


def body(cmd):
    with open(os.path.join(PRESET, "commands", f"speckit.{cmd}.md"), encoding="utf-8") as fh:
        return fh.read()


class StandardPresetWrap(unittest.TestCase):
    def test_every_carrier_holds_the_stock_placeholder_once(self):
        for cmd in COMMANDS:
            self.assertEqual(body(cmd).count("{CORE_TEMPLATE}"), 1, cmd)

    def test_manifest_wraps_every_command(self):
        with open(os.path.join(PRESET, "preset.yml"), encoding="utf-8") as fh:
            manifest = fh.read()
        self.assertEqual(len(re.findall(r'^\s+strategy: "wrap"$', manifest, re.M)), len(COMMANDS))

    def test_step_commands_stamp_their_start_above_the_stock_body(self):
        for cmd in STEPS:
            text = body(cmd)
            self.assertLess(text.index("speckit-companion:part step-start"), text.index("{CORE_TEMPLATE}"), cmd)

    def test_timing_follows_the_stock_body(self):
        for cmd in COMMANDS:
            text = body(cmd)
            self.assertGreater(text.index("speckit-companion:part timing"), text.index("{CORE_TEMPLATE}"), cmd)

    def test_carriers_keep_their_handoffs(self):
        for cmd in ["specify", "clarify", "plan", "tasks"]:
            self.assertIn("\nhandoffs:", body(cmd).split("---")[1], cmd)


if __name__ == "__main__":
    unittest.main()
