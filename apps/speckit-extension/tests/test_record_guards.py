"""A status never moves backward within a step, and a damaged record is kept aside."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WRITER = ROOT / "scripts" / "write-context.py"
READERS = [ROOT / "scripts" / n for n in ("status-context.py", "receipts.py", "derive-from-files.py", "doctor.py")]


class RecordGuards(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)
        self.ctx = self.spec / ".spec-context.json"

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, *args):
        return subprocess.run([sys.executable, str(WRITER), "--feature-dir", str(self.spec), *args],
                              cwd=self.root, capture_output=True, text=True)

    def damaged_copies(self):
        return sorted(self.spec.glob(".spec-context.damaged-*.json"))

    def test_a_same_step_write_never_moves_status_back(self):
        self.write("--step", "plan", "--status", "planned")
        result = self.write("--step", "plan", "--status", "planning")
        self.assertEqual(json.loads(self.ctx.read_text())["status"], "planned")
        self.assertIn("not moving it back to planning", result.stderr)
        self.assertIn("status=planned", result.stdout)

    def test_the_next_step_still_moves_status_forward(self):
        self.write("--step", "plan", "--status", "planned")
        self.write("--step", "tasks", "--status", "tasking")
        self.assertEqual(json.loads(self.ctx.read_text())["status"], "tasking")

    def test_a_late_start_is_quiet(self):
        self.write("--step", "plan", "--status", "planning")
        self.write("--step", "plan", "--advance")
        result = self.write("--step", "plan", "--status", "planning")
        self.assertNotIn("not moving it back", result.stderr)

    def test_damaged_records_are_kept_aside_by_a_writer(self):
        for damaged in [b'{"currentStep": "plan", "hist', b"[]", b"\xff\xfe{"]:
            with self.subTest(damaged=damaged):
                for old in self.damaged_copies():
                    old.unlink()
                self.ctx.write_bytes(damaged)
                result = self.write("--step", "plan", "--status", "planning")
                copies = self.damaged_copies()
                self.assertEqual(len(copies), 1, result.stderr)
                self.assertEqual(copies[0].read_bytes(), damaged)
                self.assertIn(copies[0].name, result.stderr)
                self.assertEqual(json.loads(self.ctx.read_text())["status"], "planning")

    def test_a_blank_record_has_nothing_to_keep(self):
        self.ctx.write_bytes(b"  \n")
        self.write("--set", "k=v")
        self.assertEqual(self.damaged_copies(), [])

    def test_the_same_damage_is_kept_once(self):
        for _ in range(2):
            self.ctx.write_text("[]", encoding="utf-8")
            self.write("--set", "k=v")
        self.assertEqual(len(self.damaged_copies()), 1)

    def test_a_reader_moves_nothing(self):
        self.ctx.write_text("not json", encoding="utf-8")
        for reader in READERS:
            subprocess.run([sys.executable, str(reader), "--feature-dir", str(self.spec)],
                           cwd=self.root, capture_output=True, text=True)
        self.assertEqual(self.damaged_copies(), [])
        self.assertEqual(self.ctx.read_text(encoding="utf-8"), "not json")


if __name__ == "__main__":
    unittest.main()
