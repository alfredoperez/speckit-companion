"""The six spec-kit bug hooks record each stage in the bug's own .spec-context.json."""
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parents[1]
WRITER = EXT / "scripts" / "write-context.py"
BUG_HOOKS = [f"{edge}_bug_{stage}" for stage in ("assess", "fix", "test") for edge in ("before", "after")]


def manifest_block(name: str) -> str:
    text = (EXT / "extension.yml").read_text(encoding="utf-8")
    return re.search(rf"^{name}:\n(.*?)(?=^\S)", text, re.M | re.S).group(1)


class BugHooksRegistered(unittest.TestCase):
    def test_every_bug_hook_points_at_a_provided_command(self):
        provided = set(re.findall(r"- name: (\S+)", manifest_block("provides")))
        hooks = dict(re.findall(r"^  (\w+):\n    command: (\S+)", manifest_block("hooks"), re.M))
        for hook in BUG_HOOKS:
            with self.subTest(hook=hook):
                self.assertIn(hook, hooks)
                self.assertIn(hooks[hook], provided)
                self.assertTrue((EXT / "commands" / f"{hooks[hook]}.md").is_file())


class BugRecord(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name).resolve()
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        self.bug = self.root / ".specify" / "bugs" / "login-timeout"
        self.bug.mkdir(parents=True)

    def hook(self, edge, stage, slug="login-timeout"):
        done = subprocess.run([sys.executable, str(WRITER), "--hook", edge, "--bug", slug, "--step", stage],
                              cwd=self.root, capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stderr)

    def history(self):
        return json.loads((self.bug / ".spec-context.json").read_text(encoding="utf-8"))["history"]

    def report(self, name, line):
        self.bug.mkdir(parents=True, exist_ok=True)
        (self.bug / name).write_text(f"# Report\n\n- {line}\n", encoding="utf-8")

    def test_a_chat_run_records_every_stage_boundary_in_order(self):
        for stage, report, line in (("assess", "assessment.md", "**Verdict**: valid"),
                                    ("fix", "fix.md", "**Status**: applied"),
                                    ("test", "test.md", "**Result**: verified")):
            self.hook("start", stage)
            self.report(report, line)
            self.hook("finish", stage)
        self.assertEqual([(e["step"], e["kind"]) for e in self.history()], [
            ("assess", "start"), ("assess", "complete"), ("fix", "start"),
            ("fix", "complete"), ("test", "start"), ("test", "complete")])
        self.assertEqual({e["step"]: e.get("did") for e in self.history() if e["kind"] == "complete"},
                         {"assess": "valid", "fix": "applied", "test": "verified"})

    def test_a_second_round_appends_after_the_first(self):
        self.hook("start", "fix")
        self.hook("finish", "fix")
        self.hook("start", "fix")
        self.hook("finish", "fix")
        self.assertEqual([e["kind"] for e in self.history()], ["start", "complete", "start", "complete"])

    def test_a_repeated_boundary_adds_nothing(self):
        self.hook("start", "fix")
        self.hook("start", "fix")
        self.assertEqual(len(self.history()), 1)

    def test_partial_and_invalid_outcomes_are_kept(self):
        self.hook("start", "assess")
        self.report("assessment.md", "**Verdict**: invalid")
        self.hook("finish", "assess")
        self.hook("start", "fix")
        self.report("fix.md", "**Status**: partial")
        self.hook("finish", "fix")
        self.assertEqual([e.get("did") for e in self.history() if e["kind"] == "complete"], ["invalid", "partial"])

    def test_an_early_stop_leaves_a_start_with_no_finish(self):
        self.hook("start", "fix")
        self.assertEqual([(e["step"], e["kind"]) for e in self.history()], [("fix", "start")])

    def test_a_retry_after_an_interrupted_stage_opens_a_new_round(self):
        self.hook("start", "fix")
        self.hook("start", "test")
        self.hook("start", "fix")
        self.hook("finish", "fix")
        self.assertEqual([(e["step"], e["kind"]) for e in self.history()],
                         [("fix", "start"), ("test", "start"), ("fix", "start"), ("fix", "complete")])

    def test_a_bug_folder_linked_outside_the_project_is_refused(self):
        outside = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: __import__("shutil").rmtree(outside, ignore_errors=True))
        self.bug.rmdir()
        self.bug.symlink_to(outside, target_is_directory=True)
        self.hook("start", "fix")
        self.assertFalse((outside / ".spec-context.json").exists())

    def test_an_unfilled_template_value_is_not_an_outcome(self):
        self.hook("start", "test")
        self.report("test.md", "**Result**: verified | partial | failed")
        self.hook("finish", "test")
        self.assertNotIn("did", self.history()[-1])

    def test_entries_are_written_by_the_extension(self):
        self.hook("start", "fix")
        self.assertEqual(self.history()[0]["by"], "extension")

    def test_a_bad_slug_a_missing_folder_or_a_wrong_stage_writes_nothing(self):
        self.hook("start", "fix", slug="../escape")
        self.hook("start", "fix", slug="not-a-bug-yet")
        self.hook("start", "plan")
        self.assertEqual(sorted(p.name for p in (self.root / ".specify" / "bugs").iterdir()), ["login-timeout"])
        self.assertFalse((self.bug / ".spec-context.json").exists())


if __name__ == "__main__":
    unittest.main()
