#!/usr/bin/env python3
"""A scratch project, driven the way the pipeline builder drives one.

The builder's write paths are a CLI, so a test can be the panel: write through
`config_write.py`, build, and read the built command bodies back. Shared by the
flow tests and the customised-quality tests because both need the same thing —
a throwaway project that can be customised and built without touching the repo.

Stdlib only; not named `test_*` so discovery leaves it alone.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

COMMANDS_REL = Path(".specify") / "extensions" / "companion" / "commands"


class Refused(Exception):
    """A write the configuration would not accept, carrying its reason."""


class Project:
    """A scratch project, driven the way the panel drives one."""

    def __init__(self, root: Path | None = None) -> None:
        """A bare scratch project, or a wrapper around one already prepared.

        `root` is for a project that had to be made some other way — a real
        `specify init`, say — so the run tests can drive one of those through
        the same writes the panel uses.
        """
        self._tmp = None if root else tempfile.TemporaryDirectory(prefix="builder-flow-")
        self.root = Path(root) if root else Path(self._tmp.name)
        (self.root / ".specify").mkdir(parents=True, exist_ok=True)

    def close(self) -> None:
        if self._tmp:
            self._tmp.cleanup()

    # ── writing ────────────────────────────────────────────

    def write(self, *args: str) -> str:
        """One `config_write.py` call. Raises `Refused` with the reason it gave."""
        done = self._run(SCRIPTS / "config_write.py", *args)
        if done.returncode:
            raise Refused((done.stdout + done.stderr).strip())
        return done.stdout.strip()

    def repair(self, repair_id: str) -> str:
        return self._run(SCRIPTS / "config_repair.py", "--apply", repair_id).stdout.strip()

    def repairs(self) -> list:
        out = self._run(SCRIPTS / "config_repair.py", "--list").stdout
        return json.loads(out)

    def node(self, command: str, node_id: str, body: str) -> None:
        """Write one of the project's own nodes, as saving in the inspector does."""
        path = self.root / ".specify" / "companion" / "nodes" / command / f"{node_id}.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding="utf-8")

    def shared_node(self, node_id: str, body: str) -> None:
        """A node of the project's own that is not tied to one step."""
        path = self.root / ".specify" / "companion" / "nodes" / f"{node_id}.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding="utf-8")

    def config_text(self) -> str:
        path = self.root / ".specify" / "companion.yml"
        return path.read_text(encoding="utf-8") if path.exists() else ""

    def set_config(self, text: str) -> None:
        """Put a configuration there by hand.

        The write path refuses to produce a broken one, so the only way to be
        in that state is to arrive in it — an older build, or someone editing
        the file. That is what this stands in for.
        """
        (self.root / ".specify" / "companion.yml").write_text(text, encoding="utf-8")

    # ── building and reading back ──────────────────────────

    def build(self, *extra: str) -> subprocess.CompletedProcess:
        return self._run(SCRIPTS / "build-pipeline.py", *extra)

    def build_ok(self, *extra: str) -> str:
        done = self.build(*extra)
        if done.returncode:
            raise AssertionError(f"the build failed:\n{done.stdout}{done.stderr}")
        return done.stdout

    def body(self, command: str) -> str:
        """One built command body — what the assistant is actually handed."""
        return (self.root / COMMANDS_REL
                / f"speckit.companion.{command}.md").read_text(encoding="utf-8")

    def graph(self) -> dict:
        return json.loads(self._run(SCRIPTS / "pipeline-graph.py").stdout)

    # ── reading the markers a build writes ─────────────────

    def nodes_in(self, command: str) -> list:
        return self._markers(command, "node")

    def phases_in(self, command: str) -> list:
        return self._markers(command, "phase")

    def hooks_in(self, command: str) -> list:
        return self._markers(command, "hook")

    def _markers(self, command: str, kind: str) -> list:
        """Opening markers of one kind, in the order the built body has them."""
        opening = f"<!-- speckit-companion:{kind} "
        found = []
        for line in self.body(command).splitlines():
            line = line.strip()
            if line.startswith(opening):
                found.append(line[len(opening):-len(" -->")])
        return found

    def _run(self, script: Path, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(script), "--project", str(self.root), *args],
            capture_output=True, text=True)
