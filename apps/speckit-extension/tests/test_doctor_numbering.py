"""The doctor names spec folders that share a number, and the status script survives a legacy console."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import doctor_checks as dc  # noqa: E402

STATUS = ROOT / "scripts" / "status-context.py"
WRITER = ROOT / "scripts" / "write-context.py"


class DuplicateNumbers(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.specs = Path(self.tmp.name) / "specs"
        self.specs.mkdir()
        dc._NUMBERS_REPORTED.clear()

    def tearDown(self):
        self.tmp.cleanup()

    def folders(self, *names):
        for name in names:
            (self.specs / name).mkdir()
        return self.specs / names[0]

    def test_names_each_shared_number_and_its_folders(self):
        first = self.folders("634-a", "634-b", "635-c", "0007-d", "007-e")
        status, findings = dc.check_numbering(first)
        self.assertEqual(status.state, "ran")
        shared = {f.evidence["number"]: f.evidence["folders"] for f in findings}
        self.assertEqual(shared, {7: ["0007-d", "007-e"], 634: ["634-a", "634-b"]})

    def test_timestamp_folders_and_a_clean_specs_folder_give_no_finding(self):
        first = self.folders("20261108-101500-a", "20261108-101500-b", "001-x", "002-y")
        self.assertEqual(dc.check_numbering(first)[1], [])

    def test_reports_once_per_run(self):
        first = self.folders("001-a", "001-b")
        dc.check_numbering(first)
        status, findings = dc.check_numbering(first)
        self.assertEqual((status.state, findings), ("skipped", []))


class LegacyConsole(unittest.TestCase):
    def test_status_exits_zero_with_parseable_json_on_cp1252(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            spec = root / "specs" / "001-x"
            spec.mkdir(parents=True)
            subprocess.run([sys.executable, str(WRITER), "--feature-dir", str(spec), "--step", "plan", "--status", "planning"],
                           cwd=root, check=True, capture_output=True)
            env = {**os.environ, "PYTHONIOENCODING": "cp1252"}
            result = subprocess.run([sys.executable, str(STATUS), "--feature-dir", str(spec)],
                                    cwd=root, capture_output=True, env=env)
            self.assertEqual(result.returncode, 0, result.stderr)
            text = result.stdout.decode("cp1252")
            line = next(l for l in text.splitlines() if l.startswith("RESOLUTION: "))
            self.assertEqual(json.loads(line[len("RESOLUTION: "):])["currentStep"], "plan")
            self.assertIn("->", text)

    def test_utf8_output_keeps_the_arrow(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            spec = root / "specs" / "001-x"
            spec.mkdir(parents=True)
            subprocess.run([sys.executable, str(WRITER), "--feature-dir", str(spec), "--step", "plan", "--status", "planning"],
                           cwd=root, check=True, capture_output=True)
            env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
            out = subprocess.run([sys.executable, str(STATUS), "--feature-dir", str(spec)],
                                 cwd=root, capture_output=True, env=env).stdout.decode("utf-8")
            self.assertIn("→", out)


if __name__ == "__main__":
    unittest.main()
