"""`status` prints what the script prints: no machine line, no model summary."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUS = ROOT / "scripts" / "status-context.py"
WRITER = ROOT / "scripts" / "write-context.py"
BODY = ROOT / "commands" / "speckit.companion.status.md"


class StatusPlain(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)

    def tearDown(self):
        self.tmp.cleanup()

    def status(self, *args):
        result = subprocess.run([sys.executable, str(STATUS), *args], cwd=self.root, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout

    def test_plain_prints_the_same_fields_without_the_machine_line(self):
        subprocess.run([sys.executable, str(WRITER), "--feature-dir", str(self.spec), "--step", "plan", "--status", "planning"],
                       cwd=self.root, check=True, capture_output=True)
        full = self.status("--feature-dir", str(self.spec))
        plain = self.status("--plain", "--feature-dir", str(self.spec))
        self.assertNotIn("RESOLUTION:", plain)
        self.assertEqual(plain, "".join(l for l in full.splitlines(keepends=True) if not l.startswith("RESOLUTION:")))
        for field in ("Spec:", "Step: plan", "Decisions:", "Next:"):
            self.assertIn(field, plain)

    def test_nothing_recorded_is_one_line(self):
        self.assertEqual(self.status("--plain", "--feature-dir", str(self.spec)).strip().count("\n"), 0)

    def test_no_spec_found_is_one_line_on_stdout(self):
        self.assertEqual(self.status("--plain", "--feature-dir", "specs/404-missing").strip(), "No active spec found.")

    def test_a_record_that_breaks_the_resolver_says_so_on_stdout(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("status_context", STATUS)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        import contextlib, io
        out = io.StringIO()
        def boom(_):
            raise ValueError("bad shape")
        mod.resolve = boom
        sys_argv, sys.argv = sys.argv, ["status-context.py", "--plain", "--feature-dir", str(self.spec)]
        cwd = Path.cwd()
        try:
            import os
            os.chdir(self.root)
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(mod.main(), 0)
        finally:
            sys.argv = sys_argv
            os.chdir(cwd)
        self.assertIn("Could not read the run record: bad shape", out.getvalue())

    def test_the_command_prints_the_output_unchanged(self):
        body = BODY.read_text(encoding="utf-8")
        self.assertIn("status-context.py --plain", body)
        self.assertIn("exactly as it comes", body)
        self.assertIn("Add nothing", body)


if __name__ == "__main__":
    unittest.main()
