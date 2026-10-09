import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("grade_scripted", Path(__file__).with_name("grade-scripted.py"))
grader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(grader)

MAP = """checks:
  jest: { kind: auto, run: "npm test" }
  narrow: { kind: scripted, run: "npm run check:desktop", steps: [one, two], what: "fits" }
  looks: { kind: scripted, run: "npm run check:desktop", steps: [one], themes: both, what: "both themes" }
  eyes: { kind: desktop, recipe: "A", what: "needs eyes" }
"""


def step(name, ok=True, **extra):
    return {"name": name, "what": "", "ok": ok, "note": extra.pop("note", ""), **extra}


class GradeScripted(unittest.TestCase):
    def setUp(self):
        self.folder = Path(tempfile.mkdtemp())
        self.map = self.folder / "surface-map.yml"
        self.map.write_text(MAP, encoding="utf-8")

    def write(self, theme, steps):
        (self.folder / f"results.{theme}.json").write_text(json.dumps(steps), encoding="utf-8")

    def run_grader(self, *extra):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            code = grader.main(["--map", str(self.map), "--results", str(self.folder), *extra])
        return code, out.getvalue().splitlines()

    def test_reads_only_scripted_checks_with_their_steps_and_themes(self):
        self.assertEqual(grader.scripted_checks(MAP), [("narrow", ["one", "two"], ["light"]), ("looks", ["one"], ["light", "dark"])])

    def test_passes_when_every_step_passed_in_every_required_theme(self):
        self.write("light", [step("one"), step("two")])
        self.write("dark", [step("one")])
        code, lines = self.run_grader()
        self.assertEqual(code, 0)
        self.assertEqual(lines, ["narrow PASS: 2 steps ok (light)", "looks PASS: 1 steps ok (light, dark)"])

    def test_fails_naming_the_first_failed_step_and_its_note(self):
        self.write("light", [step("one"), step("two", ok=False, note="overflows at 426px\nstack")])
        self.write("dark", [step("one")])
        code, lines = self.run_grader()
        self.assertEqual(code, 1)
        self.assertEqual(lines[0], "narrow FAIL: two (light): overflows at 426px")

    def test_a_dark_only_failure_fails_the_check_that_needs_both_themes(self):
        self.write("light", [step("one"), step("two")])
        self.write("dark", [step("one", ok=False, note="unreadable")])
        code, lines = self.run_grader()
        self.assertEqual(code, 1)
        self.assertEqual(lines, ["narrow PASS: 2 steps ok (light)", "looks FAIL: one (dark): unreadable"])

    def test_a_missing_results_file_blocks(self):
        self.write("light", [step("one"), step("two")])
        code, lines = self.run_grader()
        self.assertEqual(code, 1)
        self.assertTrue(lines[1].startswith("looks BLOCKED: results.dark.json not found"))

    def test_a_step_that_did_not_run_blocks(self):
        self.write("light", [step("one")])
        code, lines = self.run_grader("--check", "narrow")
        self.assertEqual(code, 1)
        self.assertEqual(lines, ["narrow BLOCKED: two (light) did not run"])

    def test_a_skipped_step_blocks_even_though_it_reads_ok(self):
        self.write("light", [step("one"), step("two", skipped=True)])
        code, lines = self.run_grader("--check", "narrow")
        self.assertEqual(code, 1)
        self.assertEqual(lines, ["narrow BLOCKED: two (light) was skipped"])

    def test_an_unreadable_results_file_blocks(self):
        (self.folder / "results.light.json").write_text("{not json", encoding="utf-8")
        code, lines = self.run_grader("--check", "narrow")
        self.assertEqual(code, 1)
        self.assertTrue(lines[0].startswith("narrow BLOCKED: results.light.json not found"))

    def test_a_scripted_check_written_in_another_shape_is_refused_not_dropped(self):
        self.map.write_text(MAP + '  odd: {kind: scripted, steps: [one]}\n', encoding="utf-8")
        self.write("light", [step("one"), step("two")])
        self.write("dark", [step("one")])
        code, lines = self.run_grader()
        self.assertEqual((code, lines), (2, []))

    def test_an_unknown_check_id_is_refused(self):
        self.write("light", [step("one"), step("two")])
        code, lines = self.run_grader("--check", "eyes")
        self.assertEqual((code, lines), (2, []))


if __name__ == "__main__":
    unittest.main()
