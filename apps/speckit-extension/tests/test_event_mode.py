"""spec-kit's runtime events stamp step boundaries through write-context.py --event."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parents[1]
SCRIPTS = EXT / "scripts"
WRITER = SCRIPTS / "write-context.py"
sys.path.insert(0, str(SCRIPTS))
import spec_context  # noqa: E402


class EventMode(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        self.feature = self.root / "specs" / "001-demo"
        self.feature.mkdir(parents=True)
        (self.root / ".specify").mkdir()
        (self.root / ".specify" / "feature.json").write_text(
            json.dumps({"feature_directory": "specs/001-demo"}), encoding="utf-8")
        self.ctx = self.feature / ".spec-context.json"
        self.addCleanup(self.cleanup)

    def cleanup(self):
        spec_context.pending_start_path(self.root).unlink(missing_ok=True)
        self.tmp.cleanup()

    def run_event(self, event, stdin):
        done = subprocess.run([sys.executable, str(WRITER), "--event", event], cwd=self.root,
                              input=stdin, capture_output=True, text=True)
        self.assertEqual((done.returncode, done.stdout, done.stderr), (0, "", ""))

    def prompt(self, text):
        self.run_event("user_prompt_submit", json.dumps({"prompt": text}))

    def stop(self):
        self.run_event("stop", json.dumps({"hook_event_name": "Stop"}))

    def log(self):
        return json.loads(self.ctx.read_text(encoding="utf-8")).get("history", []) if self.ctx.exists() else []

    def plan_entries(self, kind):
        return [e for e in self.log() if e.get("step") == "plan" and e.get("kind", e.get("type")) == kind]

    def age_start(self, step="plan"):
        data = json.loads(self.ctx.read_text(encoding="utf-8"))
        for e in data["history"]:
            if e.get("step") == step and "at" in e:
                e["at"] = "2020-01-01T00:00:00Z"
        self.ctx.write_text(json.dumps(data), encoding="utf-8")

    def test_three_spellings_stamp_a_plan_start_by_extension(self):
        for spelling in ("/speckit-plan x", "/speckit.plan x", "/speckit-companion-plan x"):
            self.ctx.unlink(missing_ok=True)
            self.prompt(spelling)
            starts = self.plan_entries("start")
            self.assertEqual(len(starts), 1, spelling)
            self.assertEqual(starts[0].get("by"), "extension", spelling)

    def test_auto_and_plain_text_write_nothing(self):
        self.prompt("/speckit-companion-auto build it")
        self.prompt("please plan this")
        self.assertFalse(self.ctx.exists())

    def test_stop_before_the_document_exists_closes_nothing(self):
        self.prompt("/speckit-plan")
        self.stop()
        self.assertEqual(self.plan_entries("complete"), [])

    def test_stop_after_plan_md_closes_plan_as_planned(self):
        self.prompt("/speckit-plan")
        self.age_start()
        (self.feature / "plan.md").write_text("# plan\n", encoding="utf-8")
        self.stop()
        self.assertEqual(len(self.plan_entries("complete")), 1)
        self.assertEqual(json.loads(self.ctx.read_text(encoding="utf-8")).get("status"), "planned")

    def test_the_dotted_companion_spelling_stamps_a_start(self):
        self.prompt("/speckit.companion.plan x")
        self.assertEqual(len(self.plan_entries("start")), 1)

    def test_a_plan_still_equal_to_the_template_closes_nothing(self):
        stub = "# Plan template\n\n## Summary\n"
        (self.root / ".specify" / "templates").mkdir()
        (self.root / ".specify" / "templates" / "plan-template.md").write_text(stub, encoding="utf-8")
        self.prompt("/speckit-plan")
        self.age_start()
        (self.feature / "plan.md").write_text(stub, encoding="utf-8")
        self.stop()
        self.assertEqual(self.plan_entries("complete"), [])

    def test_a_turn_ending_on_a_question_closes_nothing(self):
        self.prompt("/speckit-plan")
        self.age_start()
        (self.feature / "plan.md").write_text("# plan\n", encoding="utf-8")
        self.run_event("stop", json.dumps({"last_assistant_message": "Which database should it use?"}))
        self.assertEqual(self.plan_entries("complete"), [])

    def test_converge_is_left_to_its_hooks(self):
        self.prompt("/speckit-converge")
        self.assertFalse(self.ctx.exists())

    def test_stop_with_the_document_older_than_the_start_closes_nothing(self):
        plan = self.feature / "plan.md"
        plan.write_text("# plan\n", encoding="utf-8")
        os.utime(plan, (1_000_000_000, 1_000_000_000))
        self.prompt("/speckit-plan")
        self.stop()
        self.assertEqual(self.plan_entries("complete"), [])

    def test_specify_stop_with_no_spec_file_closes_nothing(self):
        self.prompt("/speckit-specify a thing")
        self.stop()
        self.assertEqual([e for e in self.log() if e.get("step") == "specify" and e.get("kind", e.get("type")) == "complete"], [])

    def test_implement_with_an_unchecked_task_stays_open(self):
        self.prompt("/speckit-implement")
        self.age_start("implement")
        (self.feature / "tasks.md").write_text("- [x] T001 a\n- [ ] T002 b\n", encoding="utf-8")
        self.stop()
        self.assertEqual([e for e in self.log() if e.get("step") == "implement" and e.get("kind", e.get("type")) == "complete"], [])

    def test_an_already_closed_step_is_byte_unchanged(self):
        self.prompt("/speckit-plan")
        self.age_start()
        (self.feature / "plan.md").write_text("# plan\n", encoding="utf-8")
        self.stop()
        before = self.ctx.read_bytes()
        self.stop()
        self.assertEqual(self.ctx.read_bytes(), before)

    def test_bad_input_exits_quietly(self):
        self.run_event("user_prompt_submit", "{not json")
        self.run_event("user_prompt_submit", "")
        self.run_event("stop", "")
        self.run_event("stop", "[1, 2]")

    def test_no_active_spec_exits_quietly(self):
        (self.root / ".specify" / "feature.json").unlink()
        self.stop()
        self.prompt("/speckit-plan")


if __name__ == "__main__":
    unittest.main()
