"""#933 — the doctor reports a missing or stale engine registration and --fix registers it."""
import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import doctor  # noqa: E402
import doctor_checks as dc  # noqa: E402

ADD = "specify workflow add .specify/extensions/companion/workflows/speckit-companion.workflow.yml"


class WorkflowRegistration(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.shipped = self.root / ".specify" / "extensions" / "companion" / "workflows" / "speckit-companion.workflow.yml"
        self.shipped.parent.mkdir(parents=True)
        self.shipped.write_text("workflow: v2\n", encoding="utf-8")
        self.registered = self.root / ".specify" / "workflows" / "speckit-companion" / "workflow.yml"

    def register(self, text):
        self.registered.parent.mkdir(parents=True, exist_ok=True)
        self.registered.write_text(text, encoding="utf-8")

    def findings(self):
        dc._WORKFLOW_REPORTED.clear()
        return dc.check_workflow(self.root)

    def test_a_missing_registration_is_reported_with_the_add_command(self):
        status, [finding] = self.findings()
        self.assertEqual((status.state, finding.severity), ("ran", "warning"))
        self.assertIn("not registered", finding.title)
        self.assertIn(ADD, finding.detail)
        self.assertIn("--fix", finding.detail)

    def test_a_copy_older_than_the_shipped_file_is_reported(self):
        self.register("workflow: v1\n")
        _, [finding] = self.findings()
        self.assertIn("out of date", finding.title)

    def test_a_current_registration_reports_nothing(self):
        self.register("workflow: v2\n")
        status, found = self.findings()
        self.assertEqual((status.state, found), ("ran", []))

    def test_no_shipped_workflow_is_not_applicable(self):
        self.shipped.unlink()
        status, found = self.findings()
        self.assertEqual((status.state, found), ("not-applicable", []))

    def test_fix_runs_the_add_command_in_the_project(self):
        with mock.patch("shutil.which", return_value="/usr/bin/specify"), \
             mock.patch("subprocess.run") as run:
            run.return_value.returncode = 0
            self.assertEqual(dc.register_workflow(self.root), 0)
        args, kwargs = run.call_args
        self.assertEqual(" ".join(args[0]), ADD)
        self.assertEqual(Path(kwargs["cwd"]), self.root)

    def test_fix_without_the_cli_prints_the_command(self):
        out = io.StringIO()
        with mock.patch("shutil.which", return_value=None), redirect_stdout(out):
            self.assertEqual(dc.register_workflow(self.root), 1)
        self.assertIn(ADD, out.getvalue())

    def test_doctor_fix_flag_registers_and_exits(self):
        with mock.patch.object(dc, "register_workflow", return_value=0) as fix, \
             mock.patch.object(doctor, "_repo_root", return_value=self.root):
            self.assertEqual(doctor.main(["--fix"]), 0)
        fix.assert_called_once_with(self.root)


if __name__ == "__main__":
    unittest.main()
