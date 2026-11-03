#!/usr/bin/env python3
"""Companion's built templates follow spec-kit's own template stack.

An override or a preset a team installed reaches stock runs through spec-kit's
resolver, and a build must hand Companion's steps the same file.

Stdlib `unittest` only.
"""
from __future__ import annotations

import json
import shutil
import sys
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(EXT / "tests"))
sys.path.insert(0, str(EXT / "scripts"))

from builder_harness import Project  # noqa: E402

REPO = EXT.parent.parent
BASH = REPO / ".specify" / "scripts" / "bash"
BUILT = Path(".specify") / "companion" / "built"
LEGACY = Path(".specify") / "extensions" / "companion" / "templates"

PLAN = "# Plan\n\n## Summary\n\nStock summary.\n\n## Technical Context\n\nStock context.\n"

try:
    import yaml  # noqa: F401
    HAVE_YAML = True
except ImportError:
    HAVE_YAML = False


class StackCase(unittest.TestCase):
    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.root = self.project.root
        self.put(".specify/templates/plan-template.md", PLAN)
        self.put(".specify/templates/spec-template.md", "# Spec\n\n## Requirements\n\nStock.\n")
        self.put(".specify/templates/tasks-template.md", "# Tasks\n\n## Phase 1\n\nStock.\n")

    def put(self, rel: str, text: str) -> None:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def real_resolver(self) -> None:
        dest = self.root / ".specify" / "scripts" / "bash"
        dest.mkdir(parents=True, exist_ok=True)
        for name in ("common.sh", "resolve-template.sh"):
            shutil.copy(BASH / name, dest / name)

    def fake_resolver(self, script: str) -> None:
        self.put(".specify/scripts/bash/resolve-template.sh", script)

    def built(self, name: str = "plan-template.md") -> str:
        return (self.root / BUILT / name).read_text(encoding="utf-8")


class AnOverrideReachesTheBuild(StackCase):
    def setUp(self):
        super().setUp()
        self.real_resolver()
        self.put(".specify/templates/overrides/plan-template.md",
                 "# Plan\n\n## Summary\n\nTeam summary.\n\n## Risks\n\nTeam risks.\n")

    def test_the_built_copy_and_the_note_carry_the_override(self):
        self.project.build_ok()
        self.assertIn("Team risks.", self.built())
        self.assertIn(".specify/companion/built/plan-template.md", self.project.body("plan"))

    def test_swaps_apply_on_top_of_the_override(self):
        self.put(".specify/companion/fragments/mine.md", "Swapped words.")
        self.project.set_config(
            'templates:\n  plan:\n    sections:\n      "Summary": mine\n')
        self.project.build_ok()
        built = self.built()
        self.assertIn("Swapped words.", built)
        self.assertIn("Team risks.", built)
        self.assertNotIn("Team summary.", built)
        self.assertIn("with its own template", self.project.body("plan"))

    def test_removing_the_override_retires_the_copy(self):
        self.project.build_ok()
        (self.root / ".specify/templates/overrides/plan-template.md").unlink()
        self.project.build_ok()
        self.assertFalse((self.root / BUILT / "plan-template.md").exists())


class APresetAppendReachesTheBuild(StackCase):
    @unittest.skipUnless(HAVE_YAML, "PyYAML is needed by spec-kit's resolver")
    def test_the_appended_layer_is_in_the_built_copy(self):
        self.real_resolver()
        self.put(".specify/presets/team/templates/plan-template.md", "\n## Rollout\n\nTeam rollout.\n")
        self.put(".specify/presets/team/preset.yml",
                 "provides:\n  templates:\n    - type: template\n      name: plan-template\n"
                 "      file: templates/plan-template.md\n      strategy: append\n")
        self.put(".specify/presets/.registry",
                 json.dumps({"presets": {"team": {"enabled": True, "priority": 1}}}))
        self.project.build_ok()
        built = self.built()
        self.assertIn("Stock context.", built)
        self.assertIn("Team rollout.", built)


class AnUncustomisedProject(StackCase):
    def test_writes_no_copy_and_the_same_bodies(self):
        self.real_resolver()
        self.project.build_ok()
        before = self.project.body("plan")
        self.assertFalse((self.root / BUILT).exists())
        self.assertNotIn("Read `.specify/companion/built", before)

    def test_no_resolver_script_falls_back_to_core(self):
        self.put(".specify/companion/fragments/mine.md", "Swapped words.")
        self.project.set_config(
            'templates:\n  plan:\n    sections:\n      "Summary": mine\n')
        self.project.build_ok()
        built = self.built()
        self.assertIn("Swapped words.", built)
        self.assertIn("Stock context.", built)


class AFailingResolverStopsTheBuild(StackCase):
    BROKEN = "#!/usr/bin/env bash\necho 'registry is broken' >&2\nexit 1\n"

    def test_an_unconfigured_project_still_builds(self):
        self.fake_resolver(self.BROKEN)
        self.project.build_ok()
        self.assertFalse((self.root / BUILT).exists())

    def test_nothing_is_written(self):
        self.fake_resolver(self.BROKEN)
        self.put(".specify/companion/fragments/mine.md", "Swapped words.")
        self.project.set_config(
            'templates:\n  plan:\n    sections:\n      "Summary": mine\n')
        done = self.project.build()
        self.assertNotEqual(done.returncode, 0)
        self.assertIn("registry is broken", done.stdout + done.stderr)
        self.assertFalse((self.root / BUILT).exists())
        self.assertFalse((self.root / ".specify" / "extensions" / "companion" / "commands").exists())


class ALegacyCopyIsRetired(StackCase):
    def test_it_is_ignored_while_building_and_removed_after(self):
        self.real_resolver()
        self.put(str(LEGACY / "plan-template.md"), "# Plan\n\n## Old\n\nOld copy.\n")
        self.project.build_ok()
        self.assertFalse((self.root / LEGACY).exists())
        self.assertFalse((self.root / BUILT).exists())
        self.assertNotIn("Old copy.", self.project.body("plan"))


if __name__ == "__main__":
    unittest.main()
