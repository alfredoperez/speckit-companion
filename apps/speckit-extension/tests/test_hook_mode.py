"""`--hook start|finish --step` records what the long explicit flags did."""
import importlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parents[1]
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))
wc = importlib.import_module("write-context")
sc = importlib.import_module("spec_context")
WRITER = SCRIPTS / "write-context.py"
STATUS = {
    ("start", "plan"): "planning", ("start", "tasks"): "tasking", ("start", "implement"): "implementing",
    ("complete", "plan"): "planned", ("complete", "tasks"): "ready-to-implement",
}
CASES = [("start", s) for s in ("plan", "tasks", "implement", "converge")] + [("finish", s) for s in ("plan", "tasks", "converge")]


def shape(spec):
    ctx = json.loads((spec / ".spec-context.json").read_text())
    return [(h.get("step"), h.get("kind"), h.get("by"), h.get("substep"), h.get("status")) for h in ctx["history"]], ctx.get("status")


class HookMode(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name).resolve()
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        (self.root / ".specify").mkdir()
        self.addCleanup(self._tmp.cleanup)
        self.addCleanup(lambda: sc.pending_start_path(self.root).unlink(missing_ok=True))

    def spec(self, name):
        path = self.root / "specs" / name
        path.mkdir(parents=True)
        return path

    def run_writer(self, *args):
        return subprocess.run([sys.executable, str(WRITER), *args], cwd=self.root, capture_output=True, text=True)

    def test_hook_history_matches_the_explicit_flags(self):
        for boundary, step in CASES:
            with self.subTest(boundary=boundary, step=step):
                kind = "complete" if boundary == "finish" else "start"
                a, b = self.spec(f"a-{boundary}-{step}"), self.spec(f"b-{boundary}-{step}")
                flags = ["--step", step, "--kind", kind, "--by", "extension"]
                if (kind, step) in STATUS:
                    flags += ["--status", STATUS[(kind, step)]]
                self.assertEqual(self.run_writer(*flags, "--feature-dir", str(a)).returncode, 0)
                self.assertEqual(self.run_writer("--hook", boundary, "--step", step, "--feature-dir", str(b)).returncode, 0)
                self.assertEqual(shape(a), shape(b))

    def test_a_double_fire_leaves_one_start_and_one_finish(self):
        d = self.spec("dbl")
        for boundary in ("start", "start", "finish", "finish"):
            self.run_writer("--hook", boundary, "--step", "plan", "--feature-dir", str(d))
        kinds = [h["kind"] for h in json.loads((d / ".spec-context.json").read_text())["history"] if h["step"] == "plan"]
        self.assertEqual(kinds, ["start", "complete"])

    def test_specify_start_writes_no_record_and_finish_records_the_saved_start(self):
        d = self.spec("001-x")
        self.run_writer("--hook", "start", "--step", "specify")
        self.assertEqual(list(self.root.rglob(".spec-context.json")), [])
        self.assertTrue(sc.pending_start_path(self.root).exists())
        self.run_writer("--hook", "finish", "--step", "specify", "--feature-dir", str(d))
        history, status = shape(d)
        self.assertEqual([(h[0], h[1]) for h in history[:2]], [("specify", "start"), ("specify", "complete")])
        self.assertEqual(status, "specified")
        self.assertFalse(sc.pending_start_path(self.root).exists())

    def test_a_stale_saved_start_is_ignored(self):
        d = self.spec("002-old")
        stale = "2000-01-01T00:00:00Z"
        sc.pending_start_path(self.root).write_text(stale, encoding="utf-8")
        self.assertGreater(wc.PENDING_START_MAX_AGE_S, 0)
        self.run_writer("--hook", "finish", "--step", "specify", "--feature-dir", str(d))
        history, _ = shape(d)
        self.assertNotIn(("specify", "start"), [(h[0], h[1]) for h in history])

    def test_a_bad_call_exits_zero(self):
        d = self.spec("bad")
        self.assertEqual(self.run_writer("--hook", "finish", "--step", "plan", "--at", "x", "--feature-dir", str(d)).returncode, 0)
        self.assertEqual(self.run_writer("--hook", "bogus", "--step", "plan", "--feature-dir", str(d)).returncode, 0)

    def test_a_crash_while_saving_the_start_exits_zero(self):
        pending = sc.pending_start_path(self.root)
        pending.unlink(missing_ok=True)
        pending.mkdir()
        self.addCleanup(lambda: pending.rmdir() if pending.is_dir() else None)
        self.assertEqual(self.run_writer("--hook", "start", "--step", "specify").returncode, 0)

    def test_a_second_specify_start_keeps_the_first_time(self):
        self.run_writer("--hook", "start", "--step", "specify", "--at", "2099-01-01T00:00:00Z")
        first = sc.pending_start_path(self.root).read_text(encoding="utf-8")
        self.run_writer("--hook", "start", "--step", "specify")
        self.assertEqual(sc.pending_start_path(self.root).read_text(encoding="utf-8"), first)

    def test_a_finished_spec_drops_the_saved_start_without_recording_it(self):
        d = self.spec("003-done")
        self.run_writer("--hook", "finish", "--step", "specify", "--feature-dir", str(d))
        self.run_writer("--hook", "start", "--step", "specify")
        self.run_writer("--hook", "finish", "--step", "specify", "--feature-dir", str(d))
        self.assertFalse(sc.pending_start_path(self.root).exists())
        history, _ = shape(d)
        self.assertNotIn(("specify", "start"), [(h[0], h[1]) for h in history])


if __name__ == "__main__":
    unittest.main()
