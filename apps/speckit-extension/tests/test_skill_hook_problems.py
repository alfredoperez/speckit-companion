#!/usr/bin/env python3
"""A skill hook that cannot run says so, on the board and in the build.

A hook naming a skill that is missing, or one marked `disable-model-invocation`,
used to build without a word and then do nothing in a run. Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

graph_mod = importlib.import_module("pipeline-graph")

HOOKS = (
    "commands:\n  specify:\n    hooks:\n      before:\n        draft-spec:\n"
    "          - { type: skill, ref: no-such-skill }\n"
    "          - { type: skill, ref: to-spec }\n"
    "          - { type: skill, ref: house-check }\n"
    "          - { type: skill, ref: \"superpowers:brainstorming\" }\n"
    "          - { type: prompt, text: mind the changelog }\n"
)


def write_skill(root: Path, rel: str, name: str, front: str) -> None:
    folder = root / rel / name
    folder.mkdir(parents=True)
    (folder / "SKILL.md").write_text(f"---\nname: {name}\n{front}---\n\nBody.\n", encoding="utf-8")


class ASkillHookThatCannotRunSaysWhy(unittest.TestCase):
    def setUp(self):
        self.project = tempfile.TemporaryDirectory()
        self.home = tempfile.TemporaryDirectory()
        self.addCleanup(self.project.cleanup)
        self.addCleanup(self.home.cleanup)
        root = Path(self.project.name)
        (root / ".specify").mkdir()
        (root / ".specify" / "companion.yml").write_text(HOOKS, encoding="utf-8")
        write_skill(root, ".claude/skills", "to-spec",
                    "description: Turn a chat into a spec\ndisable-model-invocation: true\n")
        write_skill(root, ".claude/skills", "house-check", "description: House rules\n")
        write_skill(root, ".agents/skills", "brainstorming", "description: Ideas\n")

    def hooks(self) -> dict:
        graph = graph_mod.build_graph(self.project.name, home=self.home.name)
        specify = next(s for s in graph["steps"] if s["name"] == "specify")
        draft = next(n for p in specify["phases"] for n in p["nodes"] if n["id"] == "draft-spec")
        return {h["summary"]: h["problem"] for h in draft["hooks"]}

    def test_a_missing_skill_is_named_as_missing(self):
        self.assertEqual(
            self.hooks()["no-such-skill"],
            'No skill named "no-such-skill" in this project or an installed plugin, so this '
            "hook does nothing in a run. Install it or pick another skill.")

    def test_a_skill_that_refuses_model_calls_says_a_hook_cannot_call_it(self):
        self.assertEqual(
            self.hooks()["to-spec"],
            '"to-spec" is marked disable-model-invocation, so the assistant cannot call it '
            "from a hook. Only a person can run it, by typing /to-spec.")

    def test_a_callable_skill_and_a_non_skill_hook_carry_no_problem(self):
        hooks = self.hooks()
        self.assertEqual(hooks["house-check"], "")
        self.assertEqual(hooks["mind the changelog"], "")

    def test_a_plugin_prefix_on_a_project_skill_points_at_the_fix(self):
        self.assertEqual(
            self.hooks()["superpowers:brainstorming"],
            'No installed plugin provides "superpowers:brainstorming". This project has a '
            'skill named "brainstorming": name it without the "superpowers:" prefix.')

    def test_the_build_preview_warns_with_the_same_words_and_still_succeeds(self):
        env = dict(os.environ, HOME=self.home.name)
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "build-pipeline.py"),
             "--project", self.project.name, "--dry-run"],
            capture_output=True, text=True, env=env, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        hooks = self.hooks()
        for ref in ("no-such-skill", "to-spec", "superpowers:brainstorming"):
            self.assertIn(
                f"[build] specify: skill hook before draft-spec: {hooks[ref]}", result.stdout)
        self.assertNotIn("house-check", result.stdout.split("[build] would build")[0])

    def test_a_real_build_writes_its_commands_despite_the_warning(self):
        out = Path(self.project.name) / "out"
        env = dict(os.environ, HOME=self.home.name)
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "build-pipeline.py"),
             "--project", self.project.name, "--out", str(out)],
            capture_output=True, text=True, env=env, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("No skill named", result.stdout)
        self.assertTrue((out / "speckit.companion.specify.md").is_file())


if __name__ == "__main__":
    unittest.main()
