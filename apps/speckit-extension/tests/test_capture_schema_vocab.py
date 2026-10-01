"""The capture eval reads its vocabulary from the schema, not from its own copy.

It silently fell back to the inline constants for months after the schema moved
under `apps/vscode/`, which is the failure this pins: a fallback that works is
indistinguishable from a lookup that works until the two drift.
"""
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCHEMA = ROOT / "apps" / "vscode" / "src" / "core" / "types" / "spec-context.schema.json"


def _load():
    spec = importlib.util.spec_from_file_location(
        "check_capture", ROOT / "apps" / "speckit-extension" / "scripts" / "check_capture.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TheEvalReadsTheSchema(unittest.TestCase):
    def setUp(self):
        self.mod = _load()

    def test_the_schema_is_found(self):
        self.assertIsNotNone(self.mod._load_schema(),
                             f"the format authority must resolve; expected it at {SCHEMA}")

    def test_the_vocabulary_comes_from_the_schema(self):
        props = json.loads(SCHEMA.read_text(encoding="utf-8"))["properties"]
        steps, statuses, *_ = self.mod._schema_vocab(self.mod._load_schema())
        self.assertEqual(list(steps), props["currentStep"]["enum"])
        self.assertEqual(list(statuses), props["status"]["enum"])



class ConvergeReadsAsImplement(unittest.TestCase):
    def _status(self, last_step: str, current: str) -> str:
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            entry = {"step": last_step, "substep": None, "kind": "complete", "by": "extension", "at": "2026-10-01T10:00:00Z"}
            ctx = {"specName": "x", "currentStep": current, "status": "implemented", "history": [entry]}
            (Path(tmp) / ".spec-context.json").write_text(json.dumps(ctx), encoding="utf-8")
            rows = _load().run_checks(Path(tmp)).rows
        return next(s for s, cid, _ in rows if cid == "last-entry-matches-currentStep")

    def test_converge_and_implement_count_as_the_same_step(self):
        self.assertEqual(self._status("converge", "implement"), "PASS")
        self.assertEqual(self._status("implement", "converge"), "PASS")

    def test_converge_after_an_earlier_step_still_fails(self):
        self.assertEqual(self._status("tasks", "converge"), "FAIL")

if __name__ == "__main__":
    unittest.main()
