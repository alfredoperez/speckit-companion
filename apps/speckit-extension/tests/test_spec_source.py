"""A spec keeps the ticket it came from: the specify body asks for it, and the record stores it."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WRITER = ROOT / "scripts" / "write-context.py"
SPECIFY = ROOT / "commands" / "speckit.companion.specify.md"
NODES = ROOT / "nodes" / "specify"


class SpecSource(unittest.TestCase):
    def test_every_draft_step_asks_for_a_verbatim_source_line_and_never_a_fetch(self):
        for name in ("draft-spec.md", "draft-spec-bugfix.md"):
            body = (NODES / name).read_text(encoding="utf-8")
            self.assertIn("`**Source**: <ticket>`", body, name)
            self.assertIn("never fetch the ticket", body, name)

    def test_the_built_specify_command_records_source_extends_and_supersedes(self):
        body = SPECIFY.read_text(encoding="utf-8")
        self.assertIn("`**Source**: <ticket>`", body)
        for key in ('"source"', '"extends"', '"supersedes"'):
            self.assertIn(key, body)

    def record(self, fields):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            spec = root / "specs" / "001-x"
            spec.mkdir(parents=True)
            subprocess.run([sys.executable, str(WRITER), "--feature-dir", str(spec), "--batch", json.dumps({
                "set": {"intent": "x", "workflow": "companion", **fields},
            })], cwd=root, capture_output=True, text=True, check=True)
            return json.loads((spec / ".spec-context.json").read_text(encoding="utf-8"))

    def test_the_wrap_up_batch_lands_source_and_extends_on_the_record(self):
        ctx = self.record({"source": "TODO-42", "extends": "specs/000-y"})
        self.assertEqual(ctx["source"], "TODO-42")
        self.assertEqual(ctx["extends"], "specs/000-y")
        self.assertNotIn("supersedes", ctx)

    def test_supersedes_lands_on_the_record(self):
        self.assertEqual(self.record({"supersedes": "specs/000-y"})["supersedes"], "specs/000-y")

    def test_a_ticket_that_reads_as_a_number_or_null_stays_text(self):
        self.assertEqual(self.record({"source": "42"})["source"], "42")
        self.assertEqual(self.record({"source": "none"})["source"], "none")
        url = "https://tracker.example/issue?id=42&view=full"
        self.assertEqual(self.record({"source": url})["source"], url)

    def test_a_non_text_source_in_a_batch_is_not_recorded(self):
        ctx = self.record({"source": True, "extends": None})
        self.assertNotIn("source", ctx)
        self.assertNotIn("extends", ctx)


if __name__ == "__main__":
    unittest.main()
