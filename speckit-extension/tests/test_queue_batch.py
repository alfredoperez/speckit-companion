"""#625 the inert third size, #613 a verdict that can fail, #614 the directive counter."""
import subprocess
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "speckit-extension" / "scripts"
NODES = REPO / "speckit-extension" / "nodes"
COMMANDS = REPO / "speckit-extension" / "commands"


class TheThirdSizeIsReachableAndDoesSomething(unittest.TestCase):
    """#625 — three sizes were documented and only two behaved."""

    def test_the_classifier_can_reach_oversized(self):
        body = (NODES / "specify" / "classify-size.md").read_text()
        verdict = body.split("crossedGuardrail")[1].split("```")[0]
        self.assertIn('"oversized"', verdict,
                      "the verdict expression must be able to produce the third size")

    def test_oversized_and_normal_no_longer_prescribe_the_same_thing(self):
        for step in ("plan", "tasks"):
            body = (NODES / step / "size-budget.md").read_text()
            self.assertNotIn("**`normal` or `oversized`**", body,
                             f"{step} still treats the two sizes identically")
            self.assertIn("Scale note", body,
                          f"{step} gives oversized no observable behaviour")

    def test_the_shipped_commands_carry_it(self):
        for step in ("plan", "tasks"):
            self.assertIn("Scale note",
                          (COMMANDS / f"speckit.companion.{step}.md").read_text())


class TheHealthCheckCanBeMadeToFail(unittest.TestCase):
    """#613 — a constraint nobody can fail is a constraint nobody can demonstrate."""

    FIXTURE = REPO / "speckit-extension" / "tests" / "fixtures" / "doctor" / "dangling-start"

    def _run(self, *args):
        return subprocess.run(
            [sys.executable, str(SCRIPTS / "doctor.py"), "--feature-dir", str(self.FIXTURE), *args],
            capture_output=True, text=True)

    def test_the_default_still_always_succeeds(self):
        self.assertEqual(self._run().returncode, 0)
        self.assertEqual(self._run("--json").returncode, 0)

    def test_strict_fails_when_problems_are_present(self):
        r = self._run("--strict")
        self.assertEqual(r.returncode, 1)
        self.assertIn("--strict", r.stdout + r.stderr)

    def test_strict_succeeds_when_there_is_nothing_to_report(self):
        clean = REPO / "speckit-extension" / "tests" / "fixtures" / "doctor" / "clean"
        if not clean.is_dir():
            self.skipTest("no clean fixture in this tree")
        r = subprocess.run(
            [sys.executable, str(SCRIPTS / "doctor.py"), "--strict", "--feature-dir", str(clean)],
            capture_output=True, text=True)
        self.assertEqual(r.returncode, 0)


class DirectivesCanBeCounted(unittest.TestCase):
    """#614 — the number could only be produced by hand."""

    def _run(self, *args):
        return subprocess.run(
            [sys.executable, str(SCRIPTS / "instruction-budget.py"), *args],
            capture_output=True, text=True)

    def test_it_reports_every_command(self):
        import json
        data = json.loads(self._run("--json").stdout)
        names = {c["command"] for c in data["commands"]}
        for step in ("specify", "plan", "tasks", "implement"):
            self.assertIn(f"speckit.companion.{step}.md", names)

    def test_it_separates_a_command_s_own_load_from_the_shared_load(self):
        import json
        data = json.loads(self._run("--json").stdout)
        by = {c["command"]: c for c in data["commands"]}
        impl = by["speckit.companion.implement.md"]
        self.assertEqual(impl["total"], impl["own"] + impl["shared"])
        # The finding this exists to make visible: most of implement is not its own.
        self.assertGreater(impl["shared"], impl["own"])

    def test_it_can_gate_on_a_ceiling(self):
        self.assertEqual(self._run("--ceiling", "1000").returncode, 0)
        self.assertEqual(self._run("--strict", "--ceiling", "1").returncode, 1)


if __name__ == "__main__":
    unittest.main()
