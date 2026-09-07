"""#625 the inert third size, #613 a verdict that can fail, #614 the directive counter."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "speckit-extension" / "scripts"
sys.path.insert(0, str(SCRIPTS))
import capture  # noqa: E402  — the module under test, reached through SCRIPTS
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

    def test_the_corpus_is_at_or_under_its_recorded_marks(self):
        """--strict is a ratchet, so a clean tree passes by construction. A tree
        that has grown a directive does not, which is the case below."""
        self.assertEqual(self._run("--strict").returncode, 0)

    def test_a_command_that_grows_a_directive_fails_and_is_named(self):
        cmd = COMMANDS / "speckit.companion.status.md"
        before = cmd.read_text(encoding="utf-8")
        try:
            cmd.write_text(before + "\n- one more rule to remember\n", encoding="utf-8")
            run = self._run("--strict")
        finally:
            cmd.write_text(before, encoding="utf-8")
        self.assertEqual(run.returncode, 1)
        self.assertIn("speckit.companion.status.md", run.stderr)
        self.assertIn("up from", run.stderr)


if __name__ == "__main__":
    unittest.main()


class TheSpecNameDoesNotFreezeToThePlaceholder(unittest.TestCase):
    """#622 — the name resolved on the first write, before the spec was drafted."""

    def _cell(self):
        import tempfile
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name)
        (d / "specs" / "001-tag-management").mkdir(parents=True)
        subprocess.run(["git", "init", "-q", "."], cwd=d, check=True)
        return d

    def _name(self, d):
        import json
        return json.loads(
            (d / "specs" / "001-tag-management" / ".spec-context.json").read_text())["specName"]

    def _write(self, d, *args):
        subprocess.run([sys.executable, str(SCRIPTS / "write-context.py"),
                        "--feature-dir", "specs/001-tag-management", *args],
                       cwd=d, capture_output=True, text=True)

    def test_the_template_placeholder_never_becomes_the_name(self):
        d = self._cell()
        spec = d / "specs" / "001-tag-management" / "spec.md"
        spec.write_text("# Feature Specification: [FEATURE NAME]\n")
        self._write(d, "--step", "specify", "--status", "specifying", "--kind", "start")
        self.assertNotIn("[FEATURE NAME]", self._name(d))

    def test_the_real_title_replaces_the_fallback_once_it_exists(self):
        d = self._cell()
        spec = d / "specs" / "001-tag-management" / "spec.md"
        spec.write_text("# Feature Specification: [FEATURE NAME]\n")
        self._write(d, "--step", "specify", "--status", "specifying", "--kind", "start")
        spec.write_text("# Feature Specification: Tag Management\n")
        self._write(d, "--step", "specify", "--status", "specified", "--kind", "complete")
        self.assertEqual(self._name(d), "Tag Management")

    def test_a_name_someone_chose_is_left_alone(self):
        d = self._cell()
        spec = d / "specs" / "001-tag-management" / "spec.md"
        spec.write_text("# Feature Specification: Tag Management\n")
        self._write(d, "--step", "specify", "--status", "specifying", "--kind", "start")
        self._write(d, "--set", "specName=My Own Name")
        spec.write_text("# Feature Specification: Something Else\n")
        self._write(d, "--step", "specify", "--status", "specified", "--kind", "complete")
        self.assertEqual(self._name(d), "My Own Name")


class AWriteWithNoTraceEntryIsVisible(unittest.TestCase):
    """#622 — a capture could succeed while its trace entry could not be written."""

    def _cell(self):
        import tempfile
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name)
        (d / "specs" / "001-x").mkdir(parents=True)
        subprocess.run(["git", "init", "-q", "."], cwd=d, check=True)
        return d

    def _write(self, d, *args):
        return subprocess.run([sys.executable, str(SCRIPTS / "write-context.py"),
                               "--feature-dir", "specs/001-x", *args],
                              cwd=d, capture_output=True, text=True)

    def test_the_run_says_so_and_leaves_evidence(self):
        import json, os
        d = self._cell()
        self._write(d, "--set", "size=simple")
        trace = d / "specs" / "001-x" / ".trace.jsonl"
        os.chmod(trace, 0o444)
        try:
            r = self._write(d, "--set", "other=1")
        finally:
            os.chmod(trace, 0o644)
        self.assertIn("not recorded", r.stderr)
        # the write itself must still have landed
        ctx = json.loads((d / "specs" / "001-x" / ".spec-context.json").read_text())
        self.assertEqual(ctx.get("other"), 1)
        self.assertTrue((d / "specs" / "001-x" / ".trace-lost").is_file())

    def test_the_health_check_calls_its_counts_lower_bounds(self):
        import os
        d = self._cell()
        self._write(d, "--set", "size=simple")
        trace = d / "specs" / "001-x" / ".trace.jsonl"
        os.chmod(trace, 0o444)
        try:
            self._write(d, "--set", "other=1")
        finally:
            os.chmod(trace, 0o644)
        out = subprocess.run(
            [sys.executable, str(SCRIPTS / "doctor.py"), "--feature-dir",
             str(d / "specs" / "001-x")], capture_output=True, text=True).stdout
        self.assertIn("could not be recorded", out)
        self.assertIn("lower bound", out)


class ImplementVerifiesItsOwnWork(unittest.TestCase):
    """Three of six bench cells shipped a failing suite; stock shipped none.

    The pipeline wrote tests and never ran them, and 'validate against the spec'
    was satisfied by reading. These pin the instruction that closes that gap.
    """

    BODY = COMMANDS / "speckit.companion.implement.md"

    def setUp(self):
        self.text = self.BODY.read_text()

    def test_the_step_requires_running_the_projects_checks(self):
        self.assertIn("Run the project's own checks before you call this done", self.text)
        self.assertIn("a test you wrote and never executed is a guess about your own code", self.text)
        self.assertIn("do not invent a command", self.text)

    def test_a_failing_test_it_authored_is_its_own_task(self):
        self.assertIn("is your task, not a follow-up", self.text)

    def test_a_test_invalidated_by_the_change_counts_too(self):
        self.assertIn("pre-existing test your change invalidated is also yours", self.text)

    def test_a_file_that_does_not_compile_counts_as_failing(self):
        self.assertIn("does not compile counts as failing", self.text)

    def test_an_unrunnable_check_is_declared_not_implied(self):
        self.assertIn("Do not describe a read-through as though it were a run", self.text)
        self.assertIn("do **not** record a `--verified` for it", self.text)

    def test_completion_is_gated_on_the_checks_having_passed(self):
        self.assertIn("MUST NOT be marked complete over a failing suite", self.text)
        self.assertIn("finished, unverified", self.text)

    def test_the_cost_is_bounded(self):
        # The counter exists so this is measured rather than argued (#614).
        import json
        out = subprocess.run(
            [sys.executable, str(SCRIPTS / "instruction-budget.py"), "--json"],
            capture_output=True, text=True).stdout
        impl = next(c for c in json.loads(out)["commands"]
                    if c["command"] == "speckit.companion.implement.md")
        self.assertLess(impl["total"], 60, "the verification rules must not blow the budget")


def _batch_error(raw):
    try:
        capture._parsed_batch(raw)
    except ValueError as exc:
        return str(exc)
    return None


class ABatchSetTakesFlatFieldsOnly(unittest.TestCase):
    """`set` lands as plain `key=value` pairs, so a nested value has nowhere to
    go: it used to be stringified into a Python repr and stored as that."""

    def test_a_scalar_of_any_kind_is_accepted(self):
        self.assertIsNone(_batch_error(
            '{"set": {"intent": "a", "flag": true, "n": 3, "nothing": null}}'))

    def test_a_nested_object_is_refused_by_name(self):
        err = _batch_error('{"set": {"intent": "a", "nested": {"k": 1}}}')
        self.assertIn("set.nested", err or "")

    def test_a_list_is_refused_by_name(self):
        err = _batch_error('{"set": {"tags": ["a", "b"]}}')
        self.assertIn("set.tags", err or "")

    def test_set_itself_must_be_a_map(self):
        self.assertIn("map of field", _batch_error('{"set": ["a=b"]}') or "")


class TheWrapUpIsOneCall(unittest.TestCase):
    """Specify's wrap-up spent one call per plain field. `--batch` takes them
    together, and the result has to be byte-identical to the separate calls."""

    def _ctx(self, tmp):
        return json.loads((Path(tmp) / ".spec-context.json").read_text())

    def test_a_set_map_lands_exactly_like_separate_calls(self):
        pairs = {"intent": "why this exists", "approach": "how", "workflow": "companion"}

        with tempfile.TemporaryDirectory() as one, tempfile.TemporaryDirectory() as many:
            for d in (one, many):
                (Path(d) / ".spec-context.json").write_text('{"specName":"x"}')

            capture.apply_batch(Path(one), json.dumps({"set": pairs}), "specify")
            for k, v in pairs.items():
                capture.set_fields(Path(many), [f"{k}={v}"])

            batched, separate = self._ctx(one), self._ctx(many)
            for k, v in pairs.items():
                self.assertEqual(batched.get(k), v, f"{k} did not land in the batch")
            self.assertEqual(batched, separate, "the batch must be byte-equivalent")

    def test_an_absent_or_empty_set_writes_nothing(self):
        for payload in ({}, {"set": {}}, {"set": None}):
            with tempfile.TemporaryDirectory() as d:
                (Path(d) / ".spec-context.json").write_text('{"specName":"x"}')
                capture.apply_batch(Path(d), json.dumps(payload), "specify")
                self.assertEqual(self._ctx(d), {"specName": "x"}, f"{payload} wrote something")

    def test_a_set_that_is_not_a_map_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / ".spec-context.json").write_text('{"specName":"x"}')
            with self.assertRaises(ValueError):
                capture.apply_batch(Path(d), json.dumps({"set": "not a map"}), "specify")
