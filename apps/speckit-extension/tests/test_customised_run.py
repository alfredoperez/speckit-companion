#!/usr/bin/env python3
"""Does a customised pipeline still RUN?

Everything else here proves a customisation reaches the built command body.
Nothing proved the built body still works when an assistant is handed it — and
those are different questions. A hook can render perfectly into the text and
never fire; a replaced node can be spliced in and be ignored; the capture calls
can be present and record nothing.

So this builds a project, customises it the way somebody would, and then
actually runs the specify step through the `claude` CLI against a real
`specify init` project. The assertion that earns the cost is `HOUSE-LOG.md`:
a file that exists only if the project's own hook really executed.

The assertions are deliberately structural. A model run is not deterministic,
so anything graded on the prose would flake — but "did the hook fire" cannot,
and neither can "was the step recorded".

Opt-in: it costs real tokens and takes minutes, so it skips unless asked.

    SPECKIT_RUN_E2E=1 python3 -m unittest discover -s speckit-extension/tests \\
        -p "test_customised_run.py"
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from builder_harness import EXT, Project

REPO = EXT.parent
CAPTURE_EVAL = REPO / ".claude" / "skills" / "eval-speckit-extension" / "check_capture.py"

#: Long enough for a real specify run; a hang past this is a failure, not slowness.
RUN_TIMEOUT_S = 900

#: What the run is asked to specify. Small and self-contained on purpose — the
#: point is whether the pipeline ran, not how hard a feature it can handle.
FEATURE = ("Let a reader mark any todo as starred, and add a Starred filter to "
           "the list view that shows only starred todos.")

#: The project's own version of the node that writes the spec. The extra section
#: is the tell: it appears in the output only if this text, and not the shipped
#: node, is what the assistant followed.
OUR_DRAFT_NODE = """\
---
id: draft-spec
name: Draft the spec (ours)
kind: author
writes: spec.md
---

Load `.specify/templates/spec-template.md` and write the specification.
Keep every section the template declares, in its order.
Add a final section headed `## House Rules Applied` listing the house rules you followed.
"""

#: The shell hook. Its whole job is to leave a trace nothing else would leave.
HOOK_COMMAND = "echo house-check-ran >> HOUSE-LOG.md"

ENABLED = bool(os.environ.get("SPECKIT_RUN_E2E"))
TOOLING = shutil.which("claude") and shutil.which("specify")


def run(*args, cwd=None, timeout=300) -> subprocess.CompletedProcess:
    return subprocess.run(list(args), cwd=cwd, capture_output=True,
                          text=True, timeout=timeout)


@unittest.skipUnless(ENABLED, "set SPECKIT_RUN_E2E=1 — this runs a real model")
@unittest.skipUnless(TOOLING, "needs the claude and specify CLIs")
class ACustomisedPipelineStillRuns(unittest.TestCase):
    """One real run of a customised specify, and what it left behind."""

    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory(prefix="customised-run-")
        cls.root = root = Path(cls._tmp.name)

        # A real project, made the way a person makes one. The capture scripts
        # resolve the feature through git, so the repository is not optional.
        run("git", "init", "-q", "-b", "main", str(root))
        cls._must(run("specify", "init", "--here", "--integration", "claude",
                      "--force", cwd=root), "specify init")
        cls._must(run("specify", "extension", "add", str(EXT), "--dev", "--force",
                      cwd=root), "installing the companion extension")

        project = Project(root)
        project.node("specify", "draft-spec", OUR_DRAFT_NODE)
        project.write("--command", "specify", "--hook", "command", "--when", "after",
                      "--anchor", "draft-spec", "--run", HOOK_COMMAND)
        project.build_ok()
        cls.project = project

        # A slash command is its body with the user's words dropped in. Piping
        # it is the same substitution without the command registration — and it
        # has to be stdin, because a command body is far past an argv limit.
        body = project.body("specify").replace("$ARGUMENTS", FEATURE)
        cls.run_result = subprocess.run(
            ["claude", "-p", "--permission-mode", "acceptEdits",
             "--allowedTools", "Bash", "Write", "Edit", "Read", "Glob", "Grep"],
            input=body, cwd=root, capture_output=True, text=True,
            timeout=RUN_TIMEOUT_S)

    @classmethod
    def _must(cls, done: subprocess.CompletedProcess, what: str) -> None:
        if done.returncode:
            raise AssertionError(f"{what} failed:\n{done.stdout}{done.stderr}")

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()

    # ── helpers ────────────────────────────────────────────

    @property
    def spec_dir(self) -> Path:
        found = sorted(p for p in (self.root / "specs").glob("*") if p.is_dir())
        self.assertTrue(found, "the run created no spec folder at all")
        return found[0]

    def context(self) -> dict:
        path = self.spec_dir / ".spec-context.json"
        self.assertTrue(path.is_file(), "the run recorded nothing")
        return json.loads(path.read_text(encoding="utf-8"))

    # ── what the run had to leave behind ───────────────────

    def test_the_run_finished(self):
        self.assertEqual(self.run_result.returncode, 0,
                         self.run_result.stdout[-2000:] + self.run_result.stderr[-2000:])

    def test_it_wrote_a_specification(self):
        spec = (self.spec_dir / "spec.md").read_text(encoding="utf-8")
        self.assertIn("FR-", spec, "a spec with no requirements in it")

    def test_the_projects_own_hook_actually_fired(self):
        # The assertion this test exists for. A hook can render into the body
        # perfectly and never run; this file exists only if it really executed.
        trace = self.root / "HOUSE-LOG.md"
        self.assertTrue(trace.is_file(),
                        "the hook never ran — nothing wrote HOUSE-LOG.md")
        self.assertIn("house-check-ran", trace.read_text(encoding="utf-8"))

    def test_the_projects_own_node_shaped_what_was_written(self):
        # Present only because our node asked for it, and the shipped one does not.
        spec = (self.spec_dir / "spec.md").read_text(encoding="utf-8")
        self.assertIn("House Rules Applied", spec,
                      "the shipped node was followed, not the project's own")

    def test_the_step_was_recorded_as_it_happened(self):
        context = self.context()
        steps = {entry.get("step") for entry in context.get("history", [])}
        self.assertIn("specify", steps)

    def test_the_timing_is_real_rather_than_backfilled(self):
        stamps = [entry.get("at") for entry in self.context().get("history", [])
                  if entry.get("at")]
        self.assertGreater(len(stamps), 1, "too few entries to have any timing")
        self.assertGreater(len(set(stamps)), 1,
                           "every entry carries the same moment, so it was written "
                           "in one go at the end rather than as the run went")

    @unittest.skipUnless(CAPTURE_EVAL.exists(), "needs the repository's capture eval")
    def test_the_capture_passes_the_evals_own_checks(self):
        done = run(sys.executable, str(CAPTURE_EVAL), "--json", str(self.spec_dir))
        report = json.loads(done.stdout)
        failing = [c for c in report.get("checks", []) if c.get("status") == "FAIL"]
        self.assertEqual(report.get("failed"), 0, f"capture problems: {failing}")


if __name__ == "__main__":
    unittest.main()
