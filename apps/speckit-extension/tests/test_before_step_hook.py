"""A plain SpecKit run is captured through lifecycle hooks alone."""
import importlib
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(EXT / "scripts"))
wc = importlib.import_module("write-context")
MANIFEST = (EXT / "extension.yml").read_text(encoding="utf-8")
BEFORE_STEP = (EXT / "commands" / "speckit.companion.before-step.md").read_text(encoding="utf-8")
AFTER_SPECIFY = (EXT / "commands" / "speckit.companion.after-specify.md").read_text(encoding="utf-8")
STEPS = {"plan": "planning", "tasks": "tasking", "implement": "implementing"}


def hook_command(event):
    found = re.search(rf"^  {event}:\n    command: (\S+)\n    optional: (\S+)", MANIFEST, re.M)
    return found.groups() if found else None


def writer_calls(body):
    return [line for line in body.splitlines() if "write-context.py" in line]


class StartHooks(unittest.TestCase):
    def test_every_step_registers_the_one_start_command_as_mandatory(self):
        for step in ["specify", *STEPS]:
            self.assertEqual(hook_command(f"before_{step}"), ("speckit.companion.before-step", "false"), step)

    def test_the_start_command_is_one_the_extension_provides(self):
        self.assertIn("    - name: speckit.companion.before-step\n      file: commands/speckit.companion.before-step.md", MANIFEST)

    def test_it_names_each_step_with_its_in_progress_status(self):
        for step, status in STEPS.items():
            self.assertRegex(BEFORE_STEP, rf"\| {step} \| `{step}` \| `{status}` \|")

    def test_its_one_writer_call_records_a_start(self):
        calls = writer_calls(BEFORE_STEP)
        self.assertEqual(len(calls), 1)
        self.assertIn("--kind start --by extension", calls[0])

    def test_specify_reads_the_clock_and_writes_nothing_before_its_folder_exists(self):
        specify = BEFORE_STEP.split("**Specify.**")[1].split("## ")[0]
        self.assertIn("Do not run the writer", specify)
        self.assertIn("date -u +%Y-%m-%dT%H:%M:%SZ", specify)
        self.assertEqual(writer_calls(specify), [])


class SpecifyFinishHook(unittest.TestCase):
    def test_it_writes_the_noted_start_then_a_real_finish(self):
        start, finish = writer_calls(AFTER_SPECIFY)
        self.assertIn("--status specifying --kind start --by extension --at", start)
        self.assertIn("--status specified --kind complete --by extension", finish)

    def test_no_call_falls_back_to_the_default_kind(self):
        for call in writer_calls(AFTER_SPECIFY):
            self.assertIn("--kind", call)


class LateStart(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.spec = Path(self._tmp.name) / "specs" / "001-demo"
        self.spec.mkdir(parents=True)

    def tearDown(self):
        self._tmp.cleanup()

    def status(self):
        return json.loads((self.spec / ".spec-context.json").read_text())["status"]

    def test_a_start_after_the_step_finished_leaves_the_status_alone(self):
        wc.update_context(self.spec, "specify", "specifying", "extension", "start")
        wc.update_context(self.spec, "specify", "specified", "extension", "complete")
        wc.update_context(self.spec, "specify", "specifying", "extension", "start", at="2026-10-10T10:00:00.000Z")
        self.assertEqual(self.status(), "specified")

    def test_a_start_on_an_open_step_still_sets_its_status(self):
        wc.update_context(self.spec, "specify", "specified", "extension", "complete")
        wc.update_context(self.spec, "plan", "planning", "extension", "start")
        self.assertEqual(self.status(), "planning")


if __name__ == "__main__":
    unittest.main()
