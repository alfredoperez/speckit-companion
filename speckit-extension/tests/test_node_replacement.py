#!/usr/bin/env python3
"""A project can replace a node's instructions with its own.

A recipe could already drop, add and reorder nodes, and hooks could add text
around them — but the text *inside* a node was the extension's alone. That left
the most common ask ("we write specs differently here") with nowhere to go
except forking the extension.

A node file under `.specify/companion/nodes/<command>/<id>.md` now wins over the
shipped one of the same id. These tests hold the two halves of that: the
replacement reaches the built body, and the shipped goldens cannot move because
of it — parity never points at a project.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import _command_parts as cp  # noqa: E402

graph_mod = importlib.import_module("pipeline-graph")

OURS = "Draft the spec the way THIS TEAM writes specs."


def project_replacing(command: str, node_id: str) -> tempfile.TemporaryDirectory:
    """A project whose own copy of one node says something recognisable."""
    tmp = tempfile.TemporaryDirectory()
    own = Path(tmp.name) / cp.PROJECT_NODES_REL / command
    own.mkdir(parents=True)
    (own / f"{node_id}.md").write_text(
        f"name: Draft the spec (ours)\nkind: author\nwrites: spec.md\n---\n\n{OURS}\n",
        encoding="utf-8",
    )
    return tmp


class ReplacementIsScopedToOneProject(unittest.TestCase):
    def tearDown(self):
        cp.use_project_nodes(None)

    def test_without_a_project_only_the_shipped_node_is_read(self):
        path, replaced = cp.node_source("specify", "draft-spec")
        self.assertFalse(replaced)
        self.assertTrue(path.startswith(str(EXT)))

    def test_a_project_without_its_own_copy_still_reads_the_shipped_node(self):
        with tempfile.TemporaryDirectory() as empty:
            cp.use_project_nodes(empty)
            _path, replaced = cp.node_source("specify", "draft-spec")
        self.assertFalse(replaced)

    def test_a_projects_own_copy_wins(self):
        with project_replacing("specify", "draft-spec") as project:
            cp.use_project_nodes(project)
            path, replaced = cp.node_source("specify", "draft-spec")
            _meta, body = cp.read_node("specify", "draft-spec")
        self.assertTrue(replaced)
        self.assertTrue(path.startswith(project))
        self.assertIn(OURS, body)


class ReplacementReachesTheBuiltBody(unittest.TestCase):
    def test_the_built_command_carries_the_projects_words(self):
        with project_replacing("specify", "draft-spec") as project:
            result = subprocess.run(
                [sys.executable, str(SCRIPTS / "build-pipeline.py"), "--project", project],
                capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            built = (Path(project) / ".specify" / "extensions" / "companion" / "commands"
                     / "speckit.companion.specify.md").read_text(encoding="utf-8")

        self.assertIn(OURS, built)
        self.assertIn("1 node replaced", result.stdout)
        self.assertIn("specify: draft-spec", result.stdout)

    def test_the_builder_says_which_node_is_the_projects_and_where_it_lives(self):
        with project_replacing("specify", "draft-spec") as project:
            graph = graph_mod.build_graph(project)
        cp.use_project_nodes(None)

        specify = next(s for s in graph["steps"] if s["name"] == "specify")
        self.assertEqual(specify["changes"]["replaced"], ["draft-spec"])
        self.assertTrue(graph["customised"])

        nodes = {n["id"]: n for phase in specify["phases"] for n in phase["nodes"]}
        self.assertTrue(nodes["draft-spec"]["replaced"])
        self.assertTrue(nodes["draft-spec"]["source"].startswith(project))
        # Every other node still points at the file it actually came from, so
        # opening one in the builder opens instructions and not an assembled body.
        self.assertFalse(nodes["resolve-dir"]["replaced"])
        self.assertTrue(Path(nodes["resolve-dir"]["source"]).is_file())


class ParityNeverPointsAtAProject(unittest.TestCase):
    """A project's replacement must not be able to move the shipped goldens."""

    def test_the_golden_check_passes_while_a_project_replaces_a_node(self):
        with project_replacing("specify", "draft-spec") as project:
            cp.use_project_nodes(project)
            try:
                result = subprocess.run(
                    [sys.executable, str(SCRIPTS / "assemble-nodes.py"), "--check"],
                    capture_output=True, text=True,
                )
            finally:
                cp.use_project_nodes(None)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
