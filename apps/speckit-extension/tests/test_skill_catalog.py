#!/usr/bin/env python3
"""Where each skill a hook can name comes from.

The picker listed bare names from the project's folders and never a plugin's.
Each skill now says its source, its description and whether a hook can call it.
Plugin skills come only from Claude Code's own registry; when that cannot be
read they are left out rather than guessed. Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(EXT / "scripts"))

build = importlib.import_module("build-pipeline")
graph_mod = importlib.import_module("pipeline-graph")


def write_skill(folder: Path, front: str) -> None:
    folder.mkdir(parents=True)
    (folder / "SKILL.md").write_text(f"---\nname: {folder.name}\n{front}---\n\nBody.\n",
                                     encoding="utf-8")


class Fixture(unittest.TestCase):
    def setUp(self):
        project = tempfile.TemporaryDirectory()
        home = tempfile.TemporaryDirectory()
        self.addCleanup(project.cleanup)
        self.addCleanup(home.cleanup)
        self.project, self.home = Path(project.name), Path(home.name)

    def install(self, key: str, skills: dict, **install) -> Path:
        root = self.home / "plugins-cache" / key
        for name, front in skills.items():
            write_skill(root / "skills" / name, front)
        registry = self.home / ".claude" / "plugins" / "installed_plugins.json"
        data = (json.loads(registry.read_text()) if registry.is_file()
                else {"version": 2, "plugins": {}})
        data["plugins"][key] = [dict({"scope": "user", "installPath": str(root)}, **install)]
        registry.parent.mkdir(parents=True, exist_ok=True)
        registry.write_text(json.dumps(data))
        return root

    def catalog(self):
        skills, read = build.skill_catalog(str(self.project), str(self.home))
        return {s["id"]: s for s in skills}, read


class EachSkillSaysWhereItComesFrom(Fixture):
    def test_project_skills_name_their_folder_and_description(self):
        write_skill(self.project / ".claude" / "skills" / "house-check",
                    "description: Check the house rules\n")
        write_skill(self.project / ".specify" / "skills" / "spec-lint", "")
        skills, _ = self.catalog()
        self.assertEqual(skills["house-check"]["source"], "project")
        self.assertEqual(skills["house-check"]["where"], ".claude/skills")
        self.assertEqual(skills["house-check"]["description"], "Check the house rules")
        self.assertTrue(skills["house-check"]["callable"])
        self.assertEqual(skills["spec-lint"]["where"], ".specify/skills")
        self.assertEqual(skills["spec-lint"]["description"], "")

    def test_a_folded_description_reads_as_one_line(self):
        write_skill(self.project / ".agents" / "skills" / "grill",
                    "description: >-\n  Ask hard questions:\n  one at a time.\n")
        skills, _ = self.catalog()
        self.assertEqual(skills["grill"]["description"], "Ask hard questions: one at a time.")

    def test_disable_model_invocation_marks_a_skill_a_hook_cannot_call(self):
        write_skill(self.project / ".claude" / "skills" / "to-spec",
                    "description: x\ndisable-model-invocation: true\n")
        skills, _ = self.catalog()
        self.assertFalse(skills["to-spec"]["callable"])

    def test_an_unreadable_skill_file_is_listed_without_breaking_the_catalog(self):
        folder = self.project / ".claude" / "skills" / "binary"
        folder.mkdir(parents=True)
        (folder / "SKILL.md").write_bytes(b"---\ndescription: \xff\xfe\n---\n")
        skills, _ = self.catalog()
        self.assertEqual((skills["binary"]["description"], skills["binary"]["callable"]),
                         ("", True))

    def test_the_developers_own_skills_are_labelled_user(self):
        write_skill(self.home / ".claude" / "skills" / "mine", "description: Mine\n")
        skills, _ = self.catalog()
        self.assertEqual((skills["mine"]["source"], skills["mine"]["where"]),
                         ("user", "~/.claude/skills"))

    def test_an_installed_plugin_offers_its_skills_under_its_prefix(self):
        self.install("superpowers@market", {"brainstorming": "description: Ideas\n"})
        skills, read = self.catalog()
        self.assertTrue(read)
        entry = skills["superpowers:brainstorming"]
        self.assertEqual((entry["source"], entry["where"], entry["name"]),
                         ("plugin", "superpowers", "brainstorming"))
        self.assertTrue(entry["enabled"])

    def test_a_plugin_turned_off_is_listed_as_off_and_its_hook_says_so(self):
        self.install("superpowers@market", {"brainstorming": ""})
        settings = self.project / ".claude" / "settings.json"
        settings.parent.mkdir(parents=True)
        settings.write_text(json.dumps({"enabledPlugins": {"superpowers@market": False}}))
        skills, read = self.catalog()
        self.assertFalse(skills["superpowers:brainstorming"]["enabled"])
        self.assertIn('which is turned off in Claude Code settings',
                      build.skill_problem("superpowers:brainstorming", list(skills.values()), read))

    def test_a_later_settings_file_turns_a_plugin_back_on(self):
        self.install("p@m", {"s": ""})
        (self.home / ".claude" / "settings.json").write_text(
            json.dumps({"enabledPlugins": {"p@m": False}}))
        local = self.project / ".claude" / "settings.local.json"
        local.parent.mkdir(parents=True)
        local.write_text(json.dumps({"enabledPlugins": {"p@m": True}}))
        skills, _ = self.catalog()
        self.assertTrue(skills["p:s"]["enabled"])

    def test_a_plugin_installed_for_another_project_is_not_offered(self):
        self.install("elsewhere@m", {"s": ""}, scope="project", projectPath="/somewhere/else")
        self.install("here@m", {"s": ""}, scope="local", projectPath=str(self.project))
        skills, _ = self.catalog()
        self.assertNotIn("elsewhere:s", skills)
        self.assertIn("here:s", skills)

    def test_an_unreadable_registry_leaves_plugins_out_and_says_so(self):
        registry = self.home / ".claude" / "plugins" / "installed_plugins.json"
        registry.parent.mkdir(parents=True)
        registry.write_text(json.dumps({"version": 3, "plugins": []}))
        skills, read = self.catalog()
        self.assertFalse(read)
        self.assertEqual(
            build.skill_problem("p:s", list(skills.values()), read),
            "\"p:s\" could not be checked: Claude Code's plugin list could not be read.")

    def test_the_graph_carries_the_catalog_for_the_picker(self):
        (self.project / ".specify").mkdir()
        write_skill(self.project / ".claude" / "skills" / "house-check", "description: H\n")
        self.install("p@m", {"s": ""})
        graph = graph_mod.build_graph(str(self.project), home=str(self.home))
        ids = [s["id"] for s in graph["choices"]["skillCatalog"]]
        self.assertEqual(ids, ["house-check", "p:s"])
        self.assertTrue(graph["choices"]["pluginsRead"])
        self.assertEqual(graph["choices"]["skills"], ["house-check"])


if __name__ == "__main__":
    unittest.main()
