#!/usr/bin/env python3
"""Building a real project must not change what the assistant is asked to do.

The whole architecture — node boundaries, phases, hooks, decisions, templates —
is only safe if a project that configured nothing gets exactly the pipeline it
had before. Everything added is scaffolding: markers a tool reads, and text only
where a project asked for it.

This builds one of the repository's own sandbox projects and holds the output
against the shipped bodies. It is the test that would fail if any of this had
started quietly editing instructions.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
REPO = EXT.parent
SANDBOX = REPO / "examples" / "todo-claude"
sys.path.insert(0, str(SCRIPTS))

import _command_parts as cp  # noqa: E402

assemble = importlib.import_module("assemble-nodes")

MARKER = re.compile(r"<!-- /?speckit-companion:(?:node|phase|hook) [\w-]+ -->")


class BuildingASandboxProjectChangesNothing(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not SANDBOX.is_dir():
            raise unittest.SkipTest(f"no sandbox project at {SANDBOX}")
        cls._out = tempfile.TemporaryDirectory()
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "build-pipeline.py"),
             "--project", str(SANDBOX), "--out", cls._out.name],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            raise AssertionError(f"the sandbox build failed:\n{result.stdout}\n{result.stderr}")
        cls.stdout = result.stdout
        cls.built = {
            command: (Path(cls._out.name) / f"speckit.companion.{command}.md").read_text(encoding="utf-8")
            for command in assemble.decomposed_commands()
        }

    @classmethod
    def tearDownClass(cls):
        cls._out.cleanup()

    def test_an_unconfigured_project_gets_the_shipped_bodies_byte_for_byte(self):
        for command, body in self.built.items():
            with self.subTest(command=command):
                shipped = (EXT / "commands" / f"speckit.companion.{command}.md").read_text(encoding="utf-8")
                self.assertEqual(body, shipped)

    def test_the_instructions_are_untouched_once_the_scaffolding_comes_off(self):
        # The stronger form of the same claim: even if the markers moved, the
        # text the assistant reads must equal the frozen golden.
        for command, body in self.built.items():
            with self.subTest(command=command):
                golden = Path(cp.golden_path(f"commands/speckit.companion.{command}.md"))
                self.assertEqual(cp.strip_node_markers(body),
                                 golden.read_text(encoding="utf-8"))

    def test_the_only_additions_are_comment_markers(self):
        # Every line the build added must be an HTML comment: invisible when the
        # body is rendered, and never another thing for the assistant to obey.
        for command, body in self.built.items():
            with self.subTest(command=command):
                added = set(body.splitlines()) - set(
                    cp.strip_node_markers(body).splitlines())
                for line in added:
                    self.assertRegex(line.strip(), MARKER.pattern)

    def test_the_scaffolding_stays_a_small_share_of_the_body(self):
        # It is not free — the markers are characters the model reads — so the
        # cost is asserted rather than assumed. A jump here means something
        # started emitting per-line markers.
        for command, body in self.built.items():
            with self.subTest(command=command):
                marker_chars = sum(len(line) + 1 for line in body.splitlines()
                                   if "speckit-companion:" in line)
                self.assertLess(marker_chars / len(body), 0.08,
                                "the boundary markers grew past a twelfth of the body")

    def test_the_build_reports_the_routing_and_the_artifacts(self):
        self.assertIn("classify-size = simple", self.stdout)
        self.assertIn("a run of this pipeline writes", self.stdout)

    def test_nothing_was_written_into_the_sandbox_itself(self):
        # A build writes to its output directory. Reaching into the project's own
        # `.specify/` uninvited is how a trial run becomes a change nobody asked
        # for.
        self.assertFalse((SANDBOX / ".specify" / "extensions" / "companion" / "commands").exists(),
                         "the build wrote into the sandbox instead of the output directory")


if __name__ == "__main__":
    unittest.main()
