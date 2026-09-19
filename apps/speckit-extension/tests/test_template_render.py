#!/usr/bin/env python3
"""Templates a project can reshape (R015–R019).

The specimen customisation in the design is a project that wants its specs
written around outcomes instead of user stories. That variation already existed
inside the product as a hardcoded branch, reachable only when the classifier
decided a change was small, and there was no way for a project to ask for it.

A section is addressed by its heading because that is what a template already
has, so a project names what it can see and a hand-edited template keeps working.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import template_render as tr  # noqa: E402
import companion_config as cc  # noqa: E402

build = importlib.import_module("build-pipeline")

TEMPLATE = """# Feature Specification

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

The stock user-story shape.

### User Story 1

Nested content stays with its section.

## Requirements *(mandatory)*

Untouched.
"""


class ASectionIsAddressedByItsHeading(unittest.TestCase):
    def test_the_headings_are_listed_without_their_decoration(self):
        names = tr.section_names(TEMPLATE)
        self.assertIn("User Scenarios & Testing", names)
        self.assertIn("Requirements", names)
        self.assertNotIn("User Scenarios & Testing *(mandatory)*", names)

    def test_replacing_a_section_keeps_its_heading_and_its_neighbours(self):
        out = tr.replace_section(TEMPLATE, "User Scenarios & Testing", "Outcomes go here.")
        self.assertIn("## User Scenarios & Testing *(mandatory)*", out)
        self.assertIn("Outcomes go here.", out)
        self.assertNotIn("The stock user-story shape.", out)
        # Everything outside the named section survives untouched.
        self.assertIn("## Requirements *(mandatory)*", out)
        self.assertIn("Untouched.", out)
        self.assertIn("**Status**: Draft", out)

    def test_a_replaced_section_takes_its_nested_subsections_with_it(self):
        out = tr.replace_section(TEMPLATE, "User Scenarios & Testing", "Outcomes.")
        self.assertNotIn("### User Story 1", out)
        self.assertNotIn("Nested content stays with its section.", out)

    def test_a_heading_that_is_not_there_is_refused_by_name(self):
        # A replacement aimed at a section that does not exist is a configuration
        # that silently does nothing — the failure this whole area keeps closing.
        with self.assertRaises(tr.TemplateError) as caught:
            tr.replace_section(TEMPLATE, "Nonexistent Section", "x")
        message = str(caught.exception)
        self.assertIn("Nonexistent Section", message)
        self.assertIn("Requirements", message, "the error should list what is available")


class TemplateSettingsInherit(unittest.TestCase):
    def test_a_command_level_setting_overrides_the_shared_one(self):
        config = {
            "templates": {"specify": {"file": "shared.md"}},
            "commands": {"specify": {"template": {"file": "own.md"}}},
        }
        self.assertEqual(tr.template_config(config, "specify")["file"], "own.md")

    def test_the_shared_setting_applies_when_a_command_names_none(self):
        config = {"templates": {"specify": {"file": "shared.md"}}}
        self.assertEqual(tr.template_config(config, "specify")["file"], "shared.md")

    def test_a_command_that_asks_for_nothing_resolves_nothing(self):
        name, text, changed = tr.resolve("plan", {}, "/nowhere", "/nowhere")
        self.assertIsNone(name)
        self.assertIsNone(text)
        self.assertEqual(changed, [])


class TheStockTemplateIsNeverEditedInPlace(unittest.TestCase):
    def _project(self):
        tmp = tempfile.TemporaryDirectory()
        root = Path(tmp.name)
        (root / ".specify" / "templates").mkdir(parents=True)
        (root / ".specify" / "companion" / "fragments").mkdir(parents=True)
        (root / ".specify" / "templates" / "spec-template.md").write_text(TEMPLATE, encoding="utf-8")
        (root / ".specify" / "companion" / "fragments" / "outcomes.md").write_text(
            "Describe the change as observable outcomes.", encoding="utf-8")
        (root / ".specify" / "companion.yml").write_text(
            'templates:\n  specify:\n    sections:\n      "User Scenarios & Testing": outcomes\n',
            encoding="utf-8")
        return tmp, root

    def test_the_resolved_copy_carries_the_replacement_and_the_source_does_not(self):
        tmp, root = self._project()
        self.addCleanup(tmp.cleanup)
        config = build.load_config(str(root))
        resolved = build.plan_templates(config, str(root))

        name, text, changed = resolved["specify"]
        self.assertEqual(name, "spec-template.md")
        self.assertEqual(changed, ["User Scenarios & Testing"])
        self.assertIn("Describe the change as observable outcomes.", text)

        source = (root / ".specify" / "templates" / "spec-template.md").read_text(encoding="utf-8")
        self.assertEqual(source, TEMPLATE, "the stock template was edited in place")

    def test_a_fragment_that_does_not_exist_stops_the_build(self):
        tmp, root = self._project()
        self.addCleanup(tmp.cleanup)
        (root / ".specify" / "companion.yml").write_text(
            'templates:\n  specify:\n    sections:\n      "Requirements": no-such-fragment\n',
            encoding="utf-8")
        config = build.load_config(str(root))
        with self.assertRaises(build.BuildError) as caught:
            build.plan_templates(config, str(root))
        self.assertIn("no-such-fragment", str(caught.exception))


class QuotedKeysSurviveTheReader(unittest.TestCase):
    """A section heading usually has to be quoted, and the quotes are syntax."""

    def test_a_quoted_key_loses_its_quotes(self):
        parsed = cc.load_yaml('a:\n  "User Scenarios & Testing": outcomes\n')
        self.assertEqual(parsed["a"], {"User Scenarios & Testing": "outcomes"})

    def test_a_colon_inside_a_quoted_key_stays_part_of_the_name(self):
        parsed = cc.load_yaml('a:\n  "Note: read this": value\n')
        self.assertEqual(parsed["a"], {"Note: read this": "value"})

    def test_an_unquoted_key_is_unaffected(self):
        parsed = cc.load_yaml("a:\n  plain: value\n")
        self.assertEqual(parsed["a"], {"plain": "value"})


if __name__ == "__main__":
    unittest.main()
