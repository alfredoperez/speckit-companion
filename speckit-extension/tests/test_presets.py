#!/usr/bin/env python3
"""Every preset Companion ships has to build.

A preset is a whole configuration offered as a starting point, so a broken one
is worse than no preset at all: someone picks it, and the first thing the panel
tells them is that their pipeline no longer assembles. These tests seed each
shipped preset the way the panel seeds it and build the result.

Stdlib only.
"""
from __future__ import annotations

import importlib
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXT = HERE.parent
sys.path.insert(0, str(EXT / "scripts"))
sys.path.insert(0, str(HERE))

import companion_config as cc  # noqa: E402
import config_write  # noqa: E402
import template_render  # noqa: E402
from builder_harness import Project  # noqa: E402

build = importlib.import_module("build-pipeline")
assemble = importlib.import_module("assemble-nodes")

PRESETS_DIR = EXT / "workflows" / "presets"


def preset_names() -> list:
    return [p["name"] for p in build.available_presets()]


def preset_config(name: str) -> dict:
    return cc.load_yaml((PRESETS_DIR / f"{name}.yml").read_text(encoding="utf-8"))


def stand_up_templates(project: Project, name: str) -> None:
    """Give the project the template files this preset points sections at.

    A preset can name a section in `plan-template.md`; a project without that
    file cannot have that section replaced, and the build says so. Real projects
    get these from `specify init` — a scratch one has to be handed them.
    """
    for command, entry in (preset_config(name).get("commands") or {}).items():
        sections = ((entry.get("template") or {}).get("sections") or {})
        if sections:
            project.template(
                template_render.DEFAULT_TEMPLATE_BY_COMMAND[command], *sections)


class PresetCatalog(unittest.TestCase):
    """What the panel offers, before anyone picks one."""

    def test_ships_at_least_one(self):
        self.assertTrue(preset_names(), "no preset ships — the picker would be empty")

    def test_each_says_what_it_is(self):
        for preset in build.available_presets():
            with self.subTest(preset=preset["name"]):
                self.assertTrue(preset["label"].strip(), "a preset with no label")
                self.assertTrue(preset["summary"].strip(),
                                "a preset with no summary — the picker cannot explain it")

    def test_each_parses(self):
        for name in preset_names():
            with self.subTest(preset=name):
                self.assertIsInstance(preset_config(name), dict)

    def test_each_names_only_real_nodes(self):
        """A preset naming a node that does not exist builds into an error."""
        for name in preset_names():
            config = preset_config(name)
            for command, entry in (config.get("commands") or {}).items():
                known = set(assemble.default_order(command)) | set(
                    assemble.optional_nodes(command))
                for node in (entry.get("nodes") or []):
                    with self.subTest(preset=name, command=command, node=node):
                        self.assertIn(node, known)

    def test_each_names_only_real_fragments(self):
        shipped = {f["name"]: f for f in template_render.shipped_fragments()}
        for name in preset_names():
            config = preset_config(name)
            for command, entry in (config.get("commands") or {}).items():
                sections = ((entry.get("template") or {}).get("sections") or {})
                for heading, fragment in sections.items():
                    with self.subTest(preset=name, fragment=fragment):
                        self.assertIn(fragment, shipped)
                        # A fragment written for another step would splice a
                        # spec section into the plan.
                        self.assertEqual(shipped[fragment]["for"], command)
                        self.assertEqual(shipped[fragment]["section"], heading)

    def test_phases_and_order_agree(self):
        """The two lists are the same nodes — a build refuses anything else."""
        for name in preset_names():
            config = preset_config(name)
            for command, entry in (config.get("commands") or {}).items():
                if not entry.get("phases"):
                    continue
                grouped = [n for p in entry["phases"] for n in (p.get("nodes") or [])]
                with self.subTest(preset=name, command=command):
                    self.assertEqual(grouped, list(entry.get("nodes") or []))


class SeedingAPreset(unittest.TestCase):
    """Picking one in the panel — `New workflow…`, then `Start from`."""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)

    def seed(self, preset: str, name: str = "mine") -> None:
        stand_up_templates(self.project, preset)
        self.project.write("--new-workflow", name, "--seed-from", f"preset:{preset}")

    def test_every_preset_builds(self):
        for preset in preset_names():
            with self.subTest(preset=preset):
                project = Project()
                self.addCleanup(project.close)
                stand_up_templates(project, preset)
                project.write("--new-workflow", "mine", "--seed-from", f"preset:{preset}")
                project.build_ok()

    def test_the_copy_carries_the_configuration(self):
        self.seed("brownfield")
        written = (self.project.root / ".specify" / "companion" / "workflows"
                   / "mine.yml").read_text(encoding="utf-8")
        self.assertIn("draft-spec-delta", written)

    def test_the_copy_drops_the_keys_that_only_describe_the_preset(self):
        """`preset:` and `summary:` document the preset, not the project's workflow."""
        self.seed("brownfield")
        written = (self.project.root / ".specify" / "companion" / "workflows"
                   / "mine.yml").read_text(encoding="utf-8")
        for line in written.splitlines():
            self.assertFalse(line.startswith(("preset:", "summary:")), line)

    def test_the_copy_says_where_it_came_from(self):
        self.seed("classic")
        written = (self.project.root / ".specify" / "companion" / "workflows"
                   / "mine.yml").read_text(encoding="utf-8")
        self.assertIn("classic preset", written)

    def test_seeding_switches_to_it(self):
        self.seed("classic")
        self.assertEqual(build.active_workflow(str(self.project.root)), "mine")

    def test_a_preset_that_does_not_exist_is_refused(self):
        with self.assertRaises(Exception) as caught:
            self.project.write("--new-workflow", "mine", "--seed-from", "preset:nope")
        self.assertIn("nope", str(caught.exception))

    def test_a_seeded_workflow_is_editable_like_any_other(self):
        """The point of a preset: it is a start, not a fixed thing."""
        self.seed("brownfield")
        self.project.write(
            "--command", "implement",
            "--nodes", "implement-exec,complete,handoff",
            "--phases", json.dumps([
                {"name": "execute", "nodes": ["implement-exec"]},
                {"name": "wrap-up", "nodes": ["complete", "handoff"]},
            ]))
        self.project.build_ok()
        self.assertNotIn("verify-manually", self.project.nodes_in("implement"))


class WhatEachPresetChanges(unittest.TestCase):
    """The built bodies, not the file — what the assistant is actually handed."""

    def build_with(self, preset: str) -> Project:
        project = Project()
        self.addCleanup(project.close)
        stand_up_templates(project, preset)
        project.write("--new-workflow", "mine", "--seed-from", f"preset:{preset}")
        project.build_ok()
        return project

    def test_brownfield_writes_the_spec_as_a_delta(self):
        project = self.build_with("brownfield")
        nodes = project.nodes_in("specify")
        self.assertIn("draft-spec-delta", nodes)
        self.assertNotIn("draft-spec", nodes)

    def test_brownfield_numbers_the_folder_against_every_branch(self):
        project = self.build_with("brownfield")
        self.assertIn("resolve-dir-git", project.nodes_in("specify"))

    def test_brownfield_reviews_the_task_list(self):
        project = self.build_with("brownfield")
        self.assertIn("review-gaps", project.nodes_in("tasks"))

    def test_brownfield_stops_for_a_person(self):
        project = self.build_with("brownfield")
        self.assertIn("verify-manually", project.nodes_in("implement"))

    def test_brownfield_keeps_the_dependency_a_variant_stands_in_for(self):
        """`quality-checklist` reads `draft-spec`; the delta variant stands in for it."""
        project = self.build_with("brownfield")
        self.assertIn("quality-checklist", project.nodes_in("specify"))

    def resolved(self, project: Project, template: str) -> str:
        """A template after the preset's fragments were spliced into it."""
        return (project.root / ".specify" / "extensions" / "companion" / "templates"
                / template).read_text(encoding="utf-8")

    def test_classic_uses_the_stock_story_shape(self):
        project = self.build_with("classic")
        spec = self.resolved(project, "spec-template.md")
        self.assertIn("Why this priority", spec)
        self.assertNotIn("Shipped words here", spec)

    def test_classic_uses_the_stock_technical_context(self):
        project = self.build_with("classic")
        self.assertIn("**Language/Version**",
                      self.resolved(project, "plan-template.md"))

    def test_classic_leaves_the_nodes_alone(self):
        """It changes what the documents look like, not what the run does."""
        project = self.build_with("classic")
        self.assertEqual(project.nodes_in("specify"), assemble.default_order("specify"))


class PresetsDoNotMoveTheBaseline(unittest.TestCase):
    """A project that picked no preset is byte-identical to before they existed."""

    def test_a_project_with_no_workflow_builds_the_shipped_pipeline(self):
        project = Project()
        self.addCleanup(project.close)
        project.build_ok()
        self.assertEqual(project.nodes_in("specify"), assemble.default_order("specify"))
        self.assertEqual(project.nodes_in("implement"), assemble.default_order("implement"))


if __name__ == "__main__":
    unittest.main()
