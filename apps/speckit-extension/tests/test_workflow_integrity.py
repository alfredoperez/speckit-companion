"""Tests for the workflow-integrity batch (#607 #584 #611 #603 #593 #615)."""
import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
SCRIPTS = REPO / "apps" / "speckit-extension" / "scripts"
sys.path.insert(0, str(SCRIPTS))
WRITER = SCRIPTS / "write-context.py"


def run_writer(cwd, *args):
    return subprocess.run([sys.executable, str(WRITER), *args], cwd=cwd,
                          capture_output=True, text=True)


class PointerFailsLoudly(unittest.TestCase):
    """#607 — a pointer that cannot resolve must say so, not resolve to nothing."""

    def _cell(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name)
        (d / ".specify").mkdir()
        (d / "specs" / "001-x").mkdir(parents=True)
        subprocess.run(["git", "init", "-q", "."], cwd=d, check=True)
        return d

    def test_a_stale_pointer_names_the_missing_directory(self):
        d = self._cell()
        (d / ".specify" / "feature.json").write_text(
            json.dumps({"feature_directory": "specs/999-gone"}))
        r = run_writer(d, "--set", "size=simple")
        self.assertIn("does not exist", r.stderr)
        self.assertIn("stale", r.stderr)

    def test_an_unrecognised_key_names_the_keys_that_work(self):
        d = self._cell()
        (d / ".specify" / "feature.json").write_text(json.dumps({"featureDir": "specs/001-x"}))
        r = run_writer(d, "--set", "size=simple")
        self.assertIn("no recognised key", r.stderr)
        self.assertIn("feature_directory", r.stderr)
        self.assertIn("featureDir", r.stderr)  # says what it actually found

    def test_a_good_pointer_still_resolves_silently(self):
        d = self._cell()
        (d / ".specify" / "feature.json").write_text(
            json.dumps({"feature_directory": "specs/001-x"}))
        r = run_writer(d, "--set", "size=simple")
        self.assertNotIn("no recognised key", r.stderr)
        self.assertNotIn("stale", r.stderr)
        ctx = json.loads((d / "specs" / "001-x" / ".spec-context.json").read_text())
        self.assertEqual(ctx.get("size"), "simple")


class DeclineCarriesItsReason(unittest.TestCase):
    """#615 — a recorded failure must carry the cause, not a pointer to lost output."""

    def _cell(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name)
        (d / "specs" / "001-x").mkdir(parents=True)
        subprocess.run(["git", "init", "-q", "."], cwd=d, check=True)
        return d

    def _failures(self, d):
        p = d / "specs" / "001-x" / ".trace.jsonl"
        rows = [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
        return [r for r in rows if not r.get("ok")]

    def test_a_declined_write_records_why(self):
        d = self._cell()
        run_writer(d, "--feature-dir", "specs/001-x", "--coverage-req", "FR-002", "--tests", "")
        fails = self._failures(d)
        self.assertTrue(fails, "the decline must be recorded as a failure")
        reason = fails[-1]["reason"] or ""
        self.assertNotIn("see the reason above", reason)
        self.assertIn("FR-002", reason)

    def test_a_decline_is_never_counted_as_a_write(self):
        d = self._cell()
        r = run_writer(d, "--feature-dir", "specs/001-x", "--coverage-req", "FR-002", "--tests", "")
        self.assertNotIn("Upserted coverage for FR-002 in None", r.stdout)
        self.assertTrue(self._failures(d))


class ClassifySpeaksTheSharedVocabulary(unittest.TestCase):
    """#611 — the standalone command must emit the word every consumer reads."""

    BODY = REPO / "apps" / "speckit-extension" / "commands" / "speckit.companion.classify.md"

    def test_the_emitted_verdict_is_simple_not_small(self):
        text = self.BODY.read_text()
        self.assertIn("size=<simple|normal|oversized>", text)
        self.assertNotIn("size=<small|normal|oversized>", text)

    def test_the_routing_contract_names_simple(self):
        text = self.BODY.read_text()
        routing = text.split("part routing -->")[1].split("<!-- /speckit-companion:part routing")[0]
        self.assertIn("`simple`", routing)

    def test_the_writer_accepts_the_word_the_command_emits(self):
        import re
        text = self.BODY.read_text()
        emitted = set(re.search(r"size=<([^>]+)>", text).group(1).split("|"))
        accepted = set(re.search(r"verdict \(([a-z|]+)\)",
                                 (SCRIPTS / "write-context.py").read_text()).group(1).split("|"))
        self.assertEqual(emitted, accepted)

class EngineWorkflowRoutesAndResumes(unittest.TestCase):
    """#933 — on `specify workflow run`, the switch must read a value a step can
    carry, route on the recorded verdicts, and every gate must pass headless."""

    EXT = REPO / "apps" / "speckit-extension"

    def setUp(self):
        import re
        import companion_config as cc
        self.wf = cc.load_yaml((self.EXT / "workflows" / "speckit-companion.workflow.yml").read_text())
        order = cc.load_yaml((self.EXT / "nodes" / "specify" / "_order.yml").read_text())
        self.verdicts = order["decisions"][0]["verdicts"]
        self.steps = {s["id"]: s for s in self.wf["steps"]}
        self.route = next(s for s in self.wf["steps"] if s.get("type") == "switch")
        self.re = re

    def _gates(self, steps):
        for step in steps:
            if step.get("type") == "gate":
                yield step
            for branch in list((step.get("cases") or {}).values()) + [step.get("default") or []]:
                yield from self._gates(branch)

    def test_the_switch_reads_the_stdout_of_a_shell_step(self):
        ref = self.re.fullmatch(r"\{\{\s*steps\.([\w-]+)\.output\.stdout\s*\}\}", self.route["expression"])
        self.assertIsNotNone(ref, f"the switch reads {self.route['expression']!r}, which no step outputs")
        self.assertEqual(self.steps[ref.group(1)].get("type"), "shell",
                         "only a shell step carries stdout for the switch to read")

    def test_the_cases_are_the_verdicts_that_change_the_route(self):
        changing = {v["name"] for v in self.verdicts if v.get("folds") or v.get("warns")}
        self.assertEqual(set(self.route["cases"]), changing)
        self.assertTrue(self.route.get("default"), "an unknown or missing size has no route")

    def _commands(self, steps):
        for step in steps:
            if step.get("command"):
                yield step
            for branch in list((step.get("cases") or {}).values()) + [step.get("default") or []]:
                yield from self._commands(branch)

    def test_every_companion_step_is_told_not_to_hand_off(self):
        """Without the marker a step self-advances through the gates the engine owns."""
        part = (self.EXT / "presets" / "_parts" / "self-advance.md").read_text()
        marker = self.re.search(r"input says `([^`]+)`", part).group(1)
        for step in self._commands(self.wf["steps"]):
            if step["command"].startswith("speckit.companion."):
                self.assertIn(marker, step["input"]["args"], f"{step['id']} would run past the engine's gates")

    def test_the_unused_scope_input_is_gone(self):
        self.assertNotIn("scope", self.wf["inputs"])

    def test_every_gate_names_its_own_resumable_verdict_input(self):
        gates = list(self._gates(self.wf["steps"]))
        self.assertTrue(gates)
        for gate in gates:
            name = gate.get("verdict_input")
            self.assertIn(name, self.wf["inputs"], f"{gate['id']} cannot be passed headless")
            self.assertEqual(self.wf["inputs"][name].get("enum"), ["", "approve", "reject"])
        # A route never reuses an input, or approving one gate would pass the next.
        for branch in [self.route["default"], *self.route["cases"].values()]:
            names = [g["verdict_input"] for g in self._gates(branch)]
            self.assertEqual(len(names), len(set(names)))


class WorkflowIdentityIsPinnedEveryStep(unittest.TestCase):
    """#584 — a spec joining mid-run must be pinned before the next dispatch."""

    def test_every_pipeline_command_pins_the_workflow(self):
        cmds = REPO / "apps" / "speckit-extension" / "commands"
        for step in ("specify", "plan", "tasks", "implement"):
            body = (cmds / f"speckit.companion.{step}.md").read_text()
            # The invariant is that the step pins it, not how it spells it: the
            # flag form, or the `set` map inside a batched wrap-up.
            pinned = ("--set workflow=companion" in body
                      or '"workflow": "companion"' in body)
            self.assertTrue(pinned,
                            f"{step} never pins the workflow, so a mid-run join keeps stock dispatch")


class CaptureWritesAreAtomic(unittest.TestCase):
    """#603 — the capture runtime must not use a shared temp name."""

    def test_no_capture_script_uses_a_fixed_temp_suffix_as_its_only_path(self):
        import companion_config as cc
        self.assertTrue(hasattr(cc, "atomic_write_text"))
        for name in ("spec_context.py", "task_sync.py", "run_trace.py"):
            src = (SCRIPTS / name).read_text()
            self.assertIn("atomic_write_text", src,
                          f"{name} still publishes without the shared atomic helper")

    def test_the_context_writer_publishes_through_the_helper(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name)
        (d / "specs" / "001-x").mkdir(parents=True)
        subprocess.run(["git", "init", "-q", "."], cwd=d, check=True)
        run_writer(d, "--feature-dir", "specs/001-x", "--set", "size=simple")
        target = d / "specs" / "001-x" / ".spec-context.json"
        self.assertEqual(json.loads(target.read_text())["size"], "simple")
        leftovers = list(target.parent.glob("*.tmp"))
        self.assertEqual(leftovers, [], "a completed write left temp debris")


class SilentPaletteCommandsAreGone(unittest.TestCase):
    """#593 hid six commands that only wrote a log line; the editor they belonged
    to has since been deleted, so the stronger property holds: they do not exist."""

    def setUp(self):
        self.pkg = json.loads((REPO / "package.json").read_text())

    def test_no_workflow_editor_command_is_contributed_at_all(self):
        contributed = {c["command"] for c in self.pkg["contributes"]["commands"]
                       if c["command"].startswith("speckit.workflowEditor.")}
        self.assertEqual(contributed, set(), f"still contributed: {sorted(contributed)}")

    def test_no_menu_entry_points_at_a_workflow_editor_command(self):
        offenders = sorted(
            e["command"]
            for entries in self.pkg["contributes"]["menus"].values()
            for e in entries
            if str(e.get("command", "")).startswith("speckit.workflowEditor.")
        )
        self.assertEqual(offenders, [], f"menu entries survive their command: {offenders}")


class PartialCaptureIsNotClean(unittest.TestCase):
    """#615 review — a call that wrote some of what was asked must not report ok."""

    def _cell(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name)
        (d / "specs" / "001-x").mkdir(parents=True)
        subprocess.run(["git", "init", "-q", "."], cwd=d, check=True)
        return d

    def test_a_decline_beside_a_write_still_reaches_the_trace(self):
        d = self._cell()
        run_writer(d, "--feature-dir", "specs/001-x", "--step", "plan",
                   "--step-summary", "did stuff", "--coverage-req", "FR-002", "--tests", "")
        rows = [json.loads(l) for l in
                (d / "specs" / "001-x" / ".trace.jsonl").read_text().splitlines() if l.strip()]
        last = rows[-1]
        self.assertFalse(last["ok"], "a partly-dropped capture must not report clean")
        self.assertIn("FR-002", last["reason"] or "")
        self.assertIn("landed", last["reason"] or "")


class StalePointerFallsThroughToTheBranch(unittest.TestCase):
    """#607 review — complaining must not skip the remaining resolution rungs."""

    def test_a_stale_pointer_still_resolves_by_branch(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name)
        (d / ".specify").mkdir()
        (d / "specs" / "001-x").mkdir(parents=True)
        for cmd in (["git", "init", "-q", "."], ["git", "checkout", "-q", "-b", "001-x"]):
            subprocess.run(cmd, cwd=d, check=True)
        (d / "specs" / "001-x" / "spec.md").write_text("# x\n")
        subprocess.run(["git", "add", "-A"], cwd=d, check=True)
        subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t",
                        "commit", "-q", "-m", "init"], cwd=d, check=True)
        (d / ".specify" / "feature.json").write_text(
            json.dumps({"feature_directory": "specs/999-gone"}))
        r = run_writer(d, "--set", "size=simple")
        self.assertIn("stale", r.stderr)
        self.assertTrue((d / "specs" / "001-x" / ".spec-context.json").is_file(),
                        "the branch rung must still be reached after the complaint")

    def test_a_stale_pointer_is_not_also_called_keyless(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name)
        (d / ".specify").mkdir()
        (d / "specs" / "001-x").mkdir(parents=True)
        subprocess.run(["git", "init", "-q", "."], cwd=d, check=True)
        (d / ".specify" / "feature.json").write_text(
            json.dumps({"feature_directory": "specs/999-gone"}))
        r = run_writer(d, "--set", "size=simple")
        self.assertNotIn("no recognised key", r.stderr)

    def test_the_complaint_is_printed_once(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name)
        (d / ".specify").mkdir()
        (d / "specs" / "001-x").mkdir(parents=True)
        subprocess.run(["git", "init", "-q", "."], cwd=d, check=True)
        (d / ".specify" / "feature.json").write_text(
            json.dumps({"feature_directory": "specs/999-gone"}))
        r = run_writer(d, "--set", "size=simple")
        self.assertEqual(r.stderr.count("the pointer is stale"), 1)


if __name__ == "__main__":
    unittest.main(verbosity=1)
