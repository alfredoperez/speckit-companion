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
STEPS = {"plan": "planning", "tasks": "tasking", "implement": "implementing"}


def hook_command(event):
    found = re.search(rf"^  {event}:\n    command: (\S+)\n    optional: (\S+)", MANIFEST, re.M)
    return found.groups() if found else None


def writer_calls(body):
    return [line for line in body.splitlines() if "write-context.py" in line]


PAGES = ["before-step", "after-specify", "after-plan", "after-tasks", "after-implement", "before-converge", "after-converge"]


def page_body(name):
    text = (EXT / "commands" / f"speckit.companion.{name}.md").read_text(encoding="utf-8")
    return text.split("---\n", 2)[2]


class StartHooks(unittest.TestCase):
    def test_every_step_registers_the_one_start_command_as_mandatory(self):
        for step in ["specify", *STEPS]:
            self.assertEqual(hook_command(f"before_{step}"), ("speckit.companion.before-step", "false"), step)

    def test_the_start_command_is_one_the_extension_provides(self):
        self.assertIn("    - name: speckit.companion.before-step\n      file: commands/speckit.companion.before-step.md", MANIFEST)

    def test_before_step_tells_the_agent_to_pass_the_step_about_to_run(self):
        self.assertIn("--step", BEFORE_STEP.split("```")[0])


class OneLinePages(unittest.TestCase):
    def test_each_page_has_one_hook_call(self):
        for name in PAGES:
            calls = writer_calls(page_body(name))
            self.assertEqual(len(calls), 1, name)
            self.assertRegex(calls[0], r"--hook (start|finish) --step ", name)

    def test_no_page_checks_python_or_carries_a_status_table(self):
        for name in PAGES:
            body = page_body(name)
            self.assertNotIn("python3 --version", body, name)
            self.assertNotIn("|", body, name)

    def test_each_body_stays_short(self):
        for name in PAGES:
            lines = [line for line in page_body(name).splitlines() if line.strip()]
            self.assertLessEqual(len(lines), 7, name)

    def test_each_page_names_its_boundary(self):
        for name in PAGES:
            boundary = "start" if name.startswith("before") else "finish"
            self.assertIn(f"--hook {boundary} ", page_body(name), name)


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
