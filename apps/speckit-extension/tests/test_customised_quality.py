#!/usr/bin/env python3
"""Does customising the pipeline break the gates the shipped one passes?

`test_builder_flow` proves a project's edits reach the built bodies. This asks
the next question: are those bodies still good commands. It builds a customised
pipeline, overlays it on the full installed command set, and runs the same
command-quality eval and instruction-budget count the shipped set is held to.

A build that applies your configuration and quietly produces commands that
prompt for input, blow the budget, or lose a required instruction would be worse
than one that refused — the pipeline would still run, and would run worse, with
nothing to say so.

The eval lives in the repository rather than the extension, so these skip rather
than fail wherever the extension is checked out on its own.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

from builder_harness import EXT, SCRIPTS, Project

REPO = EXT.parent
EVAL = REPO / ".claude" / "skills" / "eval-speckit-extension" / "check_quality.py"
SHIPPED_COMMANDS = EXT / "commands"
PRESETS = EXT / "presets"


def evaluate(commands_dir: Path) -> dict:
    done = subprocess.run(
        [sys.executable, str(EVAL), "--commands-dir", str(commands_dir), "--json"],
        capture_output=True, text=True)
    return json.loads(done.stdout)


def failing(report: dict) -> set:
    return {check["id"] for check in report.get("checks", []) if check["status"] == "FAIL"}


def directives(path: Path) -> int:
    """How many instructions one command body carries, by the repo's own count."""
    sys.path.insert(0, str(SCRIPTS))
    counter = importlib.import_module("instruction-budget")
    return counter.directives(path.read_text(encoding="utf-8"))


@unittest.skipUnless(EVAL.exists(), "needs the repository's command-quality eval")
class ACustomisedBuildIsHeldToTheSameGates(unittest.TestCase):
    """The shipped set and a customised set, judged by the same eval."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.before = evaluate(SHIPPED_COMMANDS)
        cls.project = p = Project()

        p.write("--new-workflow", "demo", "--seed-from", "")
        p.write("--command", "specify", "--hook", "skill", "--when", "after",
                "--anchor", "author", "--ref", "verify-code-review",
                "--text", "Block the spec on a regression.")
        p.write("--command", "plan", "--hook", "command", "--when", "before",
                "--anchor", "plan-doc", "--run", "npm run lint-spec")
        p.write("--command", "specify", "--renamed", "author", "our review",
                "--phases", json.dumps([
                    {"name": "set up", "nodes": ["resolve-dir", "load-living-specs"]},
                    {"name": "our review", "nodes": ["draft-spec", "quality-checklist"]},
                    {"name": "size it", "nodes": ["classify-size", "persist-size"]},
                    {"name": "finish", "nodes": ["branch", "finalize", "handoff"]},
                ]))
        p.node("specify", "draft-spec",
               "---\nid: draft-spec\nname: Draft the spec (ours)\nkind: author\n"
               "writes: spec.md\n---\n\n"
               "Load `spec-template.md` and write the specification the way this "
               "team writes them.\nKeep every section the template declares, in "
               "its order.\n")

        # The eval judges a whole installed command set, and a build only
        # rewrites the five assembled from nodes — so the rest are laid down
        # first, exactly as an install would have left them.
        cls.built = p.root / ".specify" / "extensions" / "companion" / "commands"
        cls.built.mkdir(parents=True, exist_ok=True)
        for path in SHIPPED_COMMANDS.glob("*.md"):
            shutil.copy(path, cls.built / path.name)
        if PRESETS.is_dir():
            shutil.copytree(
                PRESETS, p.root / ".specify" / "extensions" / "companion" / "presets",
                dirs_exist_ok=True)

        p.build_ok()
        cls.after = evaluate(cls.built)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.project.close()

    def test_customising_breaks_no_gate_the_shipped_set_passes(self):
        introduced = failing(self.after) - failing(self.before)
        detail = {c["id"]: c.get("detail", "") for c in self.after.get("checks", [])
                  if c["id"] in introduced}
        self.assertEqual(introduced, set(), f"customising broke: {detail}")

    def test_the_customisation_actually_landed_in_what_was_judged(self):
        # Without this the test above passes trivially on a build that changed
        # nothing — the eval would be grading the shipped set twice.
        body = (self.built / "speckit.companion.specify.md").read_text(encoding="utf-8")
        self.assertIn("the way this team writes them", body)
        self.assertIn("verify-code-review", body)

    def test_every_command_the_eval_reads_is_still_there(self):
        shipped = {p.name for p in SHIPPED_COMMANDS.glob("*.md")}
        built = {p.name for p in self.built.glob("*.md")}
        self.assertEqual(shipped - built, set(), "a build must not remove a command")

    def test_what_the_customisation_cost_is_visible_per_command(self):
        # Not a ceiling — a budget a change has to be able to show. A hook that
        # doubled a command's instructions should be legible in the diff that
        # added it, rather than found later.
        for command in ("specify", "plan", "tasks", "implement"):
            name = f"speckit.companion.{command}.md"
            was = directives(SHIPPED_COMMANDS / name)
            now = directives(self.built / name)
            with self.subTest(command=command):
                self.assertGreater(now, 0)
                self.assertLess(
                    now, was * 2,
                    f"{command}: {was} -> {now} directives; a customisation that "
                    f"doubles a command's instructions needs saying out loud")


if __name__ == "__main__":
    unittest.main()
