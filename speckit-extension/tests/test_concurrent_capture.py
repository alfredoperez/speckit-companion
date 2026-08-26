"""Two writers must not silently discard each other's work (#620)."""
import json
import subprocess
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WRITER = REPO / "speckit-extension" / "scripts" / "write-context.py"


class ConcurrentCapturesAllSurvive(unittest.TestCase):
    def _cell(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name)
        (d / "specs" / "001-x").mkdir(parents=True)
        subprocess.run(["git", "init", "-q", "."], cwd=d, check=True)
        return d

    def _ctx(self, d):
        return json.loads((d / "specs" / "001-x" / ".spec-context.json").read_text())

    def _set(self, d, pair):
        return subprocess.run(
            [sys.executable, str(WRITER), "--feature-dir", "specs/001-x", "--set", pair],
            cwd=d, capture_output=True, text=True)

    def test_twelve_simultaneous_writes_all_land(self):
        # The exact repro: twelve writers issued at once left four recorded,
        # with no warning, no failure, and a perfectly valid document.
        d = self._cell()
        pairs = [f"k{i}=v{i}" for i in range(1, 13)]
        with ThreadPoolExecutor(max_workers=12) as pool:
            list(pool.map(lambda p: self._set(d, p), pairs))
        ctx = self._ctx(d)
        kept = sorted(k for k in ctx if k.startswith("k"))
        self.assertEqual(len(kept), 12, f"lost {12 - len(kept)} of 12 concurrent writes: {kept}")

    def test_the_document_stays_valid_and_leaves_no_debris(self):
        d = self._cell()
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda p: self._set(d, p), [f"a{i}=1" for i in range(8)]))
        self.assertIsInstance(self._ctx(d), dict)
        self.assertEqual(list((d / "specs" / "001-x").glob("*.tmp")), [])

    def test_sequential_writes_are_unaffected(self):
        d = self._cell()
        for i in range(1, 6):
            self._set(d, f"zz{i}=v{i}")
        self.assertEqual(len([k for k in self._ctx(d) if k.startswith("zz")]), 5)

    def test_a_lock_file_is_not_left_holding_the_record_hostage(self):
        # A second run must not block on a stale lock from a finished process.
        d = self._cell()
        self._set(d, "first=1")
        r = self._set(d, "second=2")
        self.assertEqual(r.returncode, 0)
        ctx = self._ctx(d)
        # --set coerces a numeric value, so compare against the coerced form.
        self.assertEqual(ctx.get("first"), 1)
        self.assertEqual(ctx.get("second"), 2)


if __name__ == "__main__":
    unittest.main()
