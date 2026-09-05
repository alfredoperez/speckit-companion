#!/usr/bin/env python3
"""Building a real project must not change what the assistant is asked to do.

The whole architecture — node boundaries, phases, hooks, decisions, templates —
is only safe if a project that configured nothing gets exactly the pipeline it
had before. Everything added is scaffolding: markers a tool reads, and text only
where a project asked for it.

This builds a copy of one of the repository's own sandbox projects and holds
the output against the shipped bodies. It is the test that would fail if any of
this had started quietly editing instructions.

The copy leaves out the sandbox's gitignored `.specify/companion.yml` and the
other install artifacts, so the project under test is unconfigured by
construction rather than by whatever a developer last tried there.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import re
import shutil
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

#: Gitignored in the sandbox: local experiments and install output the build reads.
LOCAL_ONLY = shutil.ignore_patterns("companion.yml", "extensions.yml", "extensions", "presets")


def copy_sandbox(into: Path, config: str = "") -> Path:
    """A fresh copy of the sandbox's `.specify/` holding exactly the given config."""
    project = into / "project"
    shutil.copytree(SANDBOX / ".specify", project / ".specify", ignore=LOCAL_ONLY)
    if config:
        (project / ".specify" / "companion.yml").write_text(config, encoding="utf-8")
    return project


def build(project: Path, out: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPTS / "build-pipeline.py"),
         "--project", str(project), "--out", str(out)],
        capture_output=True, text=True,
    )


class BuildingASandboxProjectChangesNothing(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not SANDBOX.is_dir():
            raise unittest.SkipTest(f"no sandbox project at {SANDBOX}")
        cls._tmp = tempfile.TemporaryDirectory()
        cls.project = copy_sandbox(Path(cls._tmp.name))
        out = Path(cls._tmp.name) / "out"
        result = build(cls.project, out)
        if result.returncode != 0:
            raise AssertionError(f"the sandbox build failed:\n{result.stdout}\n{result.stderr}")
        cls.stdout = result.stdout
        cls.built = {
            command: (out / f"speckit.companion.{command}.md").read_text(encoding="utf-8")
            for command in assemble.decomposed_commands()
        }

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

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
        self.assertFalse((self.project / ".specify" / "extensions" / "companion" / "commands").exists(),
                         "the build wrote into the sandbox instead of the output directory")


class AConfiguredSandboxGetsItsHooks(unittest.TestCase):
    # The same project with one hook written into it: the marker lands and the
    # body stops being the shipped one. The config under test is written here,
    # so this holds whatever a developer left in the real sandbox.
    CONFIG = (
        "commands:\n  implement:\n    hooks:\n      after:\n"
        "        implement-exec:\n          - { type: prompt, text: \"x\" }\n"
    )

    def test_a_written_hook_shows_up_as_a_hook_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = copy_sandbox(Path(tmp), self.CONFIG)
            result = build(project, Path(tmp) / "out")
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            body = (Path(tmp) / "out" / "speckit.companion.implement.md").read_text(encoding="utf-8")
        shipped = (EXT / "commands" / "speckit.companion.implement.md").read_text(encoding="utf-8")
        self.assertIn("<!-- speckit-companion:hook after-implement-exec", body)
        self.assertNotEqual(body, shipped)


if __name__ == "__main__":
    unittest.main()
