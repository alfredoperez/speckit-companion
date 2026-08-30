#!/usr/bin/env python3
"""Getting out of a broken pipeline without opening the file.

The builder refuses to write an invalid configuration, but it can be handed one:
edited by hand, written by an older build, or left behind by a version whose
guard did not exist yet. Until now that put the panel on an error screen whose
only action was "open companion.yml" — the YAML editing the panel exists to
replace, offered at the moment someone is least able to use it.

These hold the recovery: that a repair is offered from what the file contains,
that the narrow one keeps the rest of the project's work, and that applying it
leaves a configuration the graph can actually read.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import config_repair as repair  # noqa: E402
import config_write as cw  # noqa: E402

#: A step with a phase whose last node was dragged out — the accident the panel
#: itself used to produce, and the one a real project arrived in.
EMPTY_PHASE = """\
commands:
  tasks:
    phases:
      - name: "gather"
        nodes:
      - name: "author"
        nodes:
          - size-budget
          - tasks-doc
      - name: "wrap-up"
        nodes:
          - handoff
    hooks:
      before:
        tasks-doc:
          - { type: prompt, text: "ours" }
"""


class ADiagnosisComesFromTheFile(unittest.TestCase):
    def setUp(self):
        self.project = Path(tempfile.mkdtemp(prefix="pb-repair-"))
        (self.project / ".specify").mkdir(parents=True)
        self.path = self.project / ".specify" / "companion.yml"

    def write(self, text: str) -> None:
        self.path.write_text(text, encoding="utf-8")

    def ids(self) -> list:
        return [r["id"] for r in repair.diagnose(str(self.project))]

    def test_an_empty_phase_is_offered_by_name(self):
        self.write(EMPTY_PHASE)
        self.assertIn("drop-empty-phases:tasks", self.ids())
        offered = next(r for r in repair.diagnose(str(self.project))
                       if r["id"] == "drop-empty-phases:tasks")
        # Naming the phase is the whole point — "a phase is empty" sends someone
        # back to the file to find out which.
        self.assertIn("'gather'", offered["detail"])
        self.assertNotIn("'author'", offered["detail"])

    def test_a_configuration_with_nothing_to_reset_offers_nothing(self):
        self.write("commands:\n  tasks:\n    hooks:\n      before:\n"
                   "        tasks-doc:\n          - { type: prompt, text: \"ours\" }\n")
        self.assertEqual(self.ids(), [])

    def test_every_step_that_customises_can_be_put_back(self):
        self.write("commands:\n  specify:\n    nodes:\n      - draft-spec\n" + EMPTY_PHASE[len("commands:\n"):])
        ids = self.ids()
        self.assertIn("reset-nodes:specify", ids)
        self.assertIn("reset-phases:tasks", ids)
        self.assertIn("reset-all", ids)

    def test_the_narrow_repair_is_offered_before_the_broad_one(self):
        self.write(EMPTY_PHASE)
        ids = self.ids()
        self.assertLess(ids.index("drop-empty-phases:tasks"), ids.index("reset-all"))

    def test_only_the_broadest_retreat_is_marked_destructive(self):
        # It is the one that discards work across every step, and the panel
        # draws it as the last resort rather than as another safe button.
        self.write(EMPTY_PHASE)
        offered = repair.diagnose(str(self.project))
        marked = [r["id"] for r in offered if r.get("destructive")]
        self.assertEqual(marked, ["reset-all"])

    def test_no_file_means_no_repairs_rather_than_a_crash(self):
        self.assertEqual(self.ids(), [])


class ARepairKeepsWhatItCan(unittest.TestCase):
    def setUp(self):
        self.project = Path(tempfile.mkdtemp(prefix="pb-repair-"))
        (self.project / ".specify").mkdir(parents=True)
        self.path = self.project / ".specify" / "companion.yml"
        self.path.write_text(EMPTY_PHASE, encoding="utf-8")

    def test_dropping_the_empty_phase_keeps_the_other_phases(self):
        repair.apply(str(self.project), "drop-empty-phases:tasks")
        text = self.path.read_text(encoding="utf-8")
        self.assertNotIn("gather", text)
        self.assertIn("author", text)
        self.assertIn("size-budget", text)
        self.assertIn("wrap-up", text)

    def test_dropping_the_empty_phase_keeps_the_hooks(self):
        # A recovery that quietly dropped the project's own work would be worse
        # than the breakage, so this is held explicitly.
        repair.apply(str(self.project), "drop-empty-phases:tasks")
        self.assertIn('{ type: prompt, text: "ours" }',
                      self.path.read_text(encoding="utf-8"))

    def test_resetting_the_phases_removes_the_block_entirely(self):
        repair.apply(str(self.project), "reset-phases:tasks")
        text = self.path.read_text(encoding="utf-8")
        # Removed, not rewritten with today's shipped values — a project pinned
        # to those would go stale on the next upgrade without anyone asking.
        self.assertNotIn("phases:", text)
        self.assertIn("hooks:", text)

    def test_reset_all_keeps_every_hook(self):
        repair.apply(str(self.project), "reset-all")
        text = self.path.read_text(encoding="utf-8")
        self.assertNotIn("phases:", text)
        self.assertIn('{ type: prompt, text: "ours" }', text)

    def test_an_unknown_repair_is_refused_rather_than_guessed(self):
        with self.assertRaises(cw.ConfigWriteError):
            repair.apply(str(self.project), "reset-everything-please")

    def test_a_repair_with_nothing_to_do_says_so(self):
        with self.assertRaises(cw.ConfigWriteError):
            repair.apply(str(self.project), "reset-nodes:tasks")


class TheGraphCanReadWhatTheRepairLeaves(unittest.TestCase):
    """The point of the whole thing: the panel draws again afterwards."""

    def setUp(self):
        self.project = Path(tempfile.mkdtemp(prefix="pb-repair-"))
        (self.project / ".specify").mkdir(parents=True)
        (self.project / ".specify" / "companion.yml").write_text(
            EMPTY_PHASE, encoding="utf-8")

    def graph(self) -> dict:
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "pipeline-graph.py"),
             "--project", str(self.project)],
            capture_output=True, text=True)
        return json.loads(result.stdout)

    def test_the_error_carries_the_ways_out(self):
        before = self.graph()
        self.assertIn("error", before)
        self.assertTrue(before.get("repairs"),
                        "an error with no way out is the dead end this fixes")

    def test_the_offered_repair_actually_makes_it_readable(self):
        offered = self.graph()["repairs"][0]["id"]
        repair.apply(str(self.project), offered)
        after = self.graph()
        self.assertNotIn("error", after,
                         f"{offered} was offered but did not fix the pipeline")
        self.assertTrue(after["steps"])

    def test_the_repaired_step_kept_the_move_that_broke_it(self):
        # Emptying `gather` was someone dragging its node into `author`. The
        # repair has to preserve that intent, not undo the drag.
        repair.apply(str(self.project), "drop-empty-phases:tasks")
        tasks = next(s for s in self.graph()["steps"] if s["name"] == "tasks")
        author = next(p for p in tasks["phases"] if p["name"] == "author")
        self.assertEqual([n["id"] for n in author["nodes"]],
                         ["size-budget", "tasks-doc"])


class TheDiagnosisNeverCostsTheError(unittest.TestCase):
    def test_a_file_it_cannot_read_still_reports_the_error(self):
        project = Path(tempfile.mkdtemp(prefix="pb-repair-"))
        (project / ".specify").mkdir(parents=True)
        (project / ".specify" / "companion.yml").write_text(
            "commands:\n\ttasks:\n\t\tnodes: [a]\n", encoding="utf-8")
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "pipeline-graph.py"), "--project", str(project)],
            capture_output=True, text=True)
        payload = json.loads(result.stdout)
        # Whatever the diagnosis manages, the error itself always arrives.
        self.assertIn("error", payload)
        self.assertIsInstance(payload.get("repairs", []), list)


class TheCliIsTheSameAnswer(unittest.TestCase):
    def test_list_and_apply_work_from_the_command_line(self):
        project = Path(tempfile.mkdtemp(prefix="pb-repair-"))
        (project / ".specify").mkdir(parents=True)
        (project / ".specify" / "companion.yml").write_text(EMPTY_PHASE, encoding="utf-8")

        listed = subprocess.run(
            [sys.executable, str(SCRIPTS / "config_repair.py"),
             "--project", str(project), "--list"],
            capture_output=True, text=True)
        self.assertEqual(listed.returncode, 0)
        self.assertTrue(json.loads(listed.stdout))

        applied = subprocess.run(
            [sys.executable, str(SCRIPTS / "config_repair.py"),
             "--project", str(project), "--apply", "drop-empty-phases:tasks"],
            capture_output=True, text=True)
        self.assertEqual(applied.returncode, 0)

        refused = subprocess.run(
            [sys.executable, str(SCRIPTS / "config_repair.py"),
             "--project", str(project), "--apply", "nonsense"],
            capture_output=True, text=True)
        self.assertEqual(refused.returncode, 1)


class ReadingPhasesFromText(unittest.TestCase):
    """The diagnosis parses the file itself, because the reader is what failed."""

    def parse(self, text: str) -> list:
        lines = text.splitlines()
        step = repair._steps(lines)[0]
        return repair.phases_in(lines, step[1], step[2], step[3])

    def test_a_node_item_is_not_read_as_a_phase(self):
        parsed = self.parse(EMPTY_PHASE)
        self.assertEqual([name for name, _ in parsed], ["gather", "author", "wrap-up"])
        self.assertEqual([nodes for _, nodes in parsed],
                         [[], ["size-budget", "tasks-doc"], ["handoff"]])

    def test_an_inline_node_list_is_understood(self):
        parsed = self.parse(
            "commands:\n  tasks:\n    phases:\n"
            "      - name: gather\n        nodes: [size-budget, tasks-doc]\n")
        self.assertEqual(parsed, [("gather", ["size-budget", "tasks-doc"])])


if __name__ == "__main__":
    unittest.main()
