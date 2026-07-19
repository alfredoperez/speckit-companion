#!/usr/bin/env python3
"""Tests for the command-inventory gate.

Every drift direction the gate claims to catch gets a case built from a synthetic
broken input, so a `check()` hardcoded to return `[]` would fail this suite rather
than pass it. The clean-tree cases alone would not.

Stdlib `unittest` only (runs under pytest too), so the existing CI discover sweep
picks it up.
"""
from __future__ import annotations

import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
REPO_ROOT = SCRIPTS.parent.parent

_spec = importlib.util.spec_from_file_location("check_command_emissions", SCRIPTS / "check-command-emissions.py")
ce = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ce)

NAMES = ["speckit.companion.specify", "speckit.companion.living-move"]


def build_area(root: str, area: str, names: list[str], extra: list[str] | None = None) -> None:
    """Materialize an install area under `root` holding exactly `names` (+ `extra`
    raw entry names, for planting an orphan or an unresolvable entry)."""
    style, _suffix = ce.KNOWN_AREAS[area]
    base = os.path.join(root, area)
    os.makedirs(base, exist_ok=True)
    entries = [ce.entry_for(n, area) for n in names] + list(extra or [])
    for entry in entries:
        if style == "dir":
            os.makedirs(os.path.join(base, entry), exist_ok=True)
            Path(base, entry, "SKILL.md").write_text("x", encoding="utf-8")
        else:
            Path(base, entry).write_text("x", encoding="utf-8")


class TestNameTranslation(unittest.TestCase):
    def test_dashed_round_trips(self):
        for name in NAMES:
            entry = ce.entry_for(name, ".claude/skills")
            self.assertEqual(ce.name_for(entry, ".claude/skills"), name)

    def test_dotted_round_trips(self):
        for area in (".github/prompts", ".gemini/commands"):
            for name in NAMES:
                self.assertEqual(ce.name_for(ce.entry_for(name, area), area), name)

    def test_only_the_prefix_is_translated(self):
        """A hyphenated command must not have its own hyphens turned into dots."""
        entry = ce.entry_for("speckit.companion.living-move", ".claude/skills")
        self.assertEqual(entry, "speckit-companion-living-move")
        self.assertEqual(ce.name_for(entry, ".claude/skills"), "speckit.companion.living-move")

    def test_unrecognized_entry_has_no_name(self):
        self.assertIsNone(ce.name_for("README.md", ".claude/skills"))
        self.assertIsNone(ce.name_for("speckit.git.commit.prompt.md", ".github/prompts"))


class TestDiskDrift(unittest.TestCase):
    """Each case plants a genuinely broken tree, so a check that returned [] would fail."""

    def test_clean_area_reports_nothing(self):
        with tempfile.TemporaryDirectory() as root:
            build_area(root, ".claude/skills", NAMES)
            self.assertEqual(ce.check_area(".claude/skills", NAMES, root), [])

    def test_orphan_emission_is_reported_with_its_path(self):
        with tempfile.TemporaryDirectory() as root:
            build_area(root, ".claude/skills", NAMES, extra=["speckit-companion-relocate"])
            problems = ce.check_area(".claude/skills", NAMES, root)
            self.assertEqual(len(problems), 1, problems)
            self.assertIn("orphan emission: .claude/skills/speckit-companion-relocate", problems[0])
            self.assertIn("speckit.companion.relocate", problems[0])

    def test_missing_emission_is_reported(self):
        with tempfile.TemporaryDirectory() as root:
            build_area(root, ".claude/skills", NAMES[:1])
            problems = ce.check_area(".claude/skills", NAMES, root)
            self.assertEqual(len(problems), 1, problems)
            self.assertIn("missing emission: speckit.companion.living-move", problems[0])
            self.assertIn(".claude/skills", problems[0])

    def test_orphan_is_caught_in_a_file_style_area_too(self):
        """Both naming shapes must be reversible, not just the dashed one."""
        with tempfile.TemporaryDirectory() as root:
            build_area(root, ".gemini/commands", NAMES, extra=["speckit.companion.drift.toml"])
            problems = ce.check_area(".gemini/commands", NAMES, root)
            self.assertEqual(len(problems), 1, problems)
            self.assertIn("orphan emission:", problems[0])
            self.assertIn("speckit.companion.drift", problems[0])

    def test_companion_shaped_entry_of_the_wrong_type_is_unresolvable(self):
        with tempfile.TemporaryDirectory() as root:
            build_area(root, ".claude/skills", NAMES)
            # A dotted FILE inside a dashed-DIR area fits no shape here.
            Path(root, ".claude/skills", "speckit.companion.notes.md").write_text("x", encoding="utf-8")
            problems = ce.check_area(".claude/skills", NAMES, root)
            self.assertEqual(len(problems), 1, problems)
            self.assertIn("unresolvable entry:", problems[0])

    def test_unknown_install_area_fails_loudly(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, ".newagent/commands/speckit-companion-specify"))
            problems = ce.check_areas(NAMES, root)
            self.assertEqual(len(problems), 1, problems)
            self.assertIn("unknown install area: .newagent/commands", problems[0])

    def test_excluded_trees_are_not_scanned(self):
        """examples/ is frozen at pre-rename names — scanning it would drown the gate."""
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, "examples/demo/.claude/skills/speckit-companion-relocate"))
            self.assertEqual(ce.discover_areas(root), [])
            self.assertEqual(ce.check_areas(NAMES, root), [])


class TestRecordDrift(unittest.TestCase):
    def _registry(self, root: str, commands: list[str]) -> str:
        path = os.path.join(root, "registry.json")
        Path(path).write_text(
            json.dumps({"extensions": {"companion": {"registered_commands": {"claude": commands}}}}),
            encoding="utf-8",
        )
        return path

    def _hooks(self, root: str, command: str) -> str:
        path = os.path.join(root, "extensions.yml")
        Path(path).write_text(
            "extensions:\n- companion\nhooks:\n"
            "  after_specify:\n  - extension: companion\n"
            f"    command: {command}\n    enabled: true\n",
            encoding="utf-8",
        )
        return path

    def test_matching_records_report_nothing(self):
        with tempfile.TemporaryDirectory() as root:
            reg = self._registry(root, NAMES)
            yml = self._hooks(root, NAMES[0])
            self.assertEqual(ce.check_records(NAMES, reg, yml), [])

    def test_stale_record_is_reported(self):
        with tempfile.TemporaryDirectory() as root:
            reg = self._registry(root, NAMES + ["speckit.companion.capture-plan"])
            yml = self._hooks(root, NAMES[0])
            problems = ce.check_records(NAMES, reg, yml)
            self.assertEqual(len(problems), 1, problems)
            self.assertIn("stale record: speckit.companion.capture-plan", problems[0])
            self.assertIn("claude", problems[0])

    def test_unrecorded_command_is_reported(self):
        with tempfile.TemporaryDirectory() as root:
            reg = self._registry(root, NAMES[:1])
            yml = self._hooks(root, NAMES[0])
            problems = ce.check_records(NAMES, reg, yml)
            self.assertEqual(len(problems), 1, problems)
            self.assertIn("unrecorded command: speckit.companion.living-move", problems[0])

    def test_stale_hook_is_reported_with_its_event(self):
        with tempfile.TemporaryDirectory() as root:
            reg = self._registry(root, NAMES)
            yml = self._hooks(root, "speckit.companion.capture")
            problems = ce.check_records(NAMES, reg, yml)
            self.assertEqual(len(problems), 1, problems)
            self.assertIn("stale hook: after_specify triggers speckit.companion.capture", problems[0])


class TestDocDrift(unittest.TestCase):
    def _doc(self, root: str, text: str) -> dict:
        path = os.path.join(root, "doc.md")
        Path(path).write_text(text, encoding="utf-8")
        return {path: "the test document"}

    def test_documented_commands_report_nothing(self):
        with tempfile.TemporaryDirectory() as root:
            docs = self._doc(root, "\n".join(NAMES))
            self.assertEqual(ce.check_docs(NAMES, docs), [])

    def test_undocumented_command_is_reported_with_its_document(self):
        with tempfile.TemporaryDirectory() as root:
            docs = self._doc(root, NAMES[0])
            problems = ce.check_docs(NAMES, docs)
            self.assertEqual(len(problems), 1, problems)
            self.assertIn("undocumented command: speckit.companion.living-move", problems[0])

    def test_a_gated_document_that_vanished_is_reported(self):
        problems = ce.check_docs(NAMES, {"/nonexistent/doc.md": "a doc"})
        self.assertEqual(len(problems), 1, problems)
        self.assertIn("missing document:", problems[0])

    def test_a_count_match_is_not_enough(self):
        """One command added and another dropped keeps the count — names must be matched."""
        with tempfile.TemporaryDirectory() as root:
            docs = self._doc(root, "speckit.companion.specify\nspeckit.companion.relocate")
            problems = ce.check_docs(NAMES, docs)
            self.assertEqual(len(problems), 1, problems)
            self.assertIn("speckit.companion.living-move", problems[0])


class TestComposition(unittest.TestCase):
    """`check()` must actually run its parts. Asserting only that it is empty on the
    healthy repo would pass against a `check()` hardcoded to return nothing."""

    def test_check_reports_drift_from_every_surface_at_once(self):
        real = ce.declared_command_names()
        with tempfile.TemporaryDirectory() as root:
            # A disk orphan, a stale record, a stale hook, and an undocumented command.
            build_area(root, ".claude/skills", real, extra=["speckit-companion-relocate"])
            os.makedirs(os.path.join(root, ".specify/extensions"))
            Path(root, ".specify/extensions/.registry").write_text(
                json.dumps({"extensions": {"companion": {"registered_commands": {
                    "claude": real + ["speckit.companion.capture-plan"]}}}}),
                encoding="utf-8",
            )
            Path(root, ".specify/extensions.yml").write_text(
                "hooks:\n  after_specify:\n  - extension: companion\n"
                "    command: speckit.companion.capture\n",
                encoding="utf-8",
            )
            doc = os.path.join(root, "doc.md")
            Path(doc).write_text("nothing here", encoding="utf-8")

            problems = ce.check(root=root, docs={doc: "the test document"})

            kinds = {p.split(":")[0] for p in problems}
            for expected in ("orphan emission", "stale record", "stale hook", "undocumented command"):
                self.assertIn(expected, kinds, f"check() never ran the {expected} comparison")

    def test_check_is_clean_on_a_fully_consistent_synthetic_tree(self):
        real = ce.declared_command_names()
        with tempfile.TemporaryDirectory() as root:
            for area in ce.KNOWN_AREAS:
                build_area(root, area, real)
            os.makedirs(os.path.join(root, ".specify/extensions"))
            Path(root, ".specify/extensions/.registry").write_text(
                json.dumps({"extensions": {"companion": {"registered_commands": {"claude": real}}}}),
                encoding="utf-8",
            )
            Path(root, ".specify/extensions.yml").write_text("hooks:\n", encoding="utf-8")
            doc = os.path.join(root, "doc.md")
            Path(doc).write_text("\n".join(real), encoding="utf-8")

            self.assertEqual(ce.check(root=root, docs={doc: "the test document"}), [])


class TestRealRepo(unittest.TestCase):
    def test_gate_passes_on_the_real_repo(self):
        problems = ce.check()
        self.assertEqual(problems, [], "inventory gate found problems:\n" + "\n".join(problems))

    def test_every_discovered_area_is_known(self):
        """The guard against the gate silently shrinking its own scanned surface."""
        for area in ce.discover_areas(str(REPO_ROOT)):
            self.assertIn(area, ce.KNOWN_AREAS, f"{area} holds Companion commands but is unscanned")

    def test_it_scans_a_non_trivial_surface(self):
        """A gate that discovered nothing would pass vacuously."""
        self.assertGreaterEqual(len(ce.discover_areas(str(REPO_ROOT))), 1)


if __name__ == "__main__":
    unittest.main()
