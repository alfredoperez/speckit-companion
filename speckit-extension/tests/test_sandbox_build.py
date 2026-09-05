#!/usr/bin/env python3
"""Building an unconfigured project must not change what the assistant is asked to do.

Node boundaries, phases, hooks, decisions and templates are only safe if a
project that configured nothing gets exactly the shipped pipeline. Everything
added is scaffolding: markers a tool reads, and text only where a project asked.

Stdlib `unittest` only.
"""
from __future__ import annotations

import hashlib
import importlib
import re
import sys
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import _command_parts as cp  # noqa: E402
from builder_harness import Project  # noqa: E402

assemble = importlib.import_module("assemble-nodes")

MARKER = re.compile(r"<!-- /?speckit-companion:(?:node|phase|hook) [\w-]+ -->")


def snapshot(root: Path) -> dict:
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in root.rglob("*") if p.is_file()}


class BuildingAnUnconfiguredProjectChangesNothing(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.project = Project()
        cls.addClassCleanup(cls.project.close)
        specify = cls.project.root / ".specify"
        cls.before = snapshot(specify)
        out = cls.project.root / "out"
        cls.stdout = cls.project.build_ok("--out", str(out))
        cls.after = snapshot(specify)
        cls.built = {
            command: (out / f"speckit.companion.{command}.md").read_text(encoding="utf-8")
            for command in assemble.decomposed_commands()
        }

    def test_an_unconfigured_project_gets_the_shipped_bodies_byte_for_byte(self):
        for command, body in self.built.items():
            with self.subTest(command=command):
                shipped = (EXT / "commands" / f"speckit.companion.{command}.md").read_text(encoding="utf-8")
                self.assertEqual(body, shipped)

    def test_the_instructions_are_untouched_once_the_scaffolding_comes_off(self):
        for command, body in self.built.items():
            with self.subTest(command=command):
                golden = Path(cp.golden_path(f"commands/speckit.companion.{command}.md"))
                self.assertEqual(cp.strip_node_markers(body),
                                 golden.read_text(encoding="utf-8"))

    def test_the_only_additions_are_comment_markers(self):
        for command, body in self.built.items():
            with self.subTest(command=command):
                added = set(body.splitlines()) - set(
                    cp.strip_node_markers(body).splitlines())
                for line in added:
                    self.assertRegex(line.strip(), MARKER.pattern)

    def test_the_scaffolding_stays_a_small_share_of_the_body(self):
        for command, body in self.built.items():
            with self.subTest(command=command):
                marker_chars = sum(len(line) + 1 for line in body.splitlines()
                                   if "speckit-companion:" in line)
                self.assertLess(marker_chars / len(body), 0.08,
                                "the boundary markers grew past a twelfth of the body")

    def test_the_build_reports_the_routing_and_the_artifacts(self):
        self.assertIn("classify-size = simple", self.stdout)
        self.assertIn("a run of this pipeline writes", self.stdout)

    def test_nothing_was_written_into_the_project_itself(self):
        self.assertEqual(self.before, self.after,
                         "the build wrote into the project instead of the output directory")


class AConfiguredProjectGetsItsHooks(unittest.TestCase):
    CONFIG = (
        "commands:\n  implement:\n    hooks:\n      after:\n"
        "        implement-exec:\n          - { type: prompt, text: \"x\" }\n"
    )

    def test_a_written_hook_shows_up_as_a_hook_marker(self):
        project = Project()
        self.addCleanup(project.close)
        project.set_config(self.CONFIG)
        out = project.root / "out"
        project.build_ok("--out", str(out))
        body = (out / "speckit.companion.implement.md").read_text(encoding="utf-8")
        self.assertIn("<!-- speckit-companion:hook after-implement-exec-0 -->\nx\n"
                      "<!-- /speckit-companion:hook after-implement-exec-0 -->", body)


if __name__ == "__main__":
    unittest.main()
