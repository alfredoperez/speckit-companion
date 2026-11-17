"""Property tests for the run-record writer's promises (slow lane).

Drives the real `write-context.py` by subprocess with random sequences of writes:
history only grows, writes merge, status never moves backward, parallel writers lose
nothing, and a damaged record is kept aside. Skipped unless Hypothesis is installed and
COMPANION_SLOW=1; CI runs it in its own step.

    COMPANION_SLOW=1 python3 -m unittest apps/speckit-extension/tests/test_record_properties.py
"""
from __future__ import annotations

import itertools
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
WRITER = SCRIPTS / "write-context.py"

try:
    from hypothesis import HealthCheck, given, settings, strategies as st
    HAVE_HYPOTHESIS = True
except ImportError:
    HAVE_HYPOTHESIS = False

ENABLED = HAVE_HYPOTHESIS and os.environ.get("COMPANION_SLOW") == "1"
REASON = "slow lane: needs Hypothesis and COMPANION_SLOW=1"

if ENABLED:
    sys.path.insert(0, str(SCRIPTS))
    import spec_context as sc  # noqa: E402

    STATUS_ORDER = list(sc.STATUS_ORDER)
    RANK = {s: i for i, s in enumerate(STATUS_ORDER)}
    STEPS = sorted(sc.CANONICAL_STEPS)
    ENV = {k: v for k, v in os.environ.items() if not k.startswith("SPECIFY_")}
    COMMON = dict(deadline=None, database=None, derandomize=True, suppress_health_check=list(HealthCheck))

    STEP_STATUSES = {
        "specify": ["specifying", "specified"], "plan": ["planning", "planned"],
        "tasks": ["tasking", "ready-to-implement"], "implement": ["implementing", "implemented"],
    }
    LIFECYCLE = sorted(STEP_STATUSES)

    key_s = st.from_regex(r"k_[a-z]{1,6}", fullmatch=True)
    val_s = st.from_regex(r"v[a-zA-Z]{0,8}", fullmatch=True)
    step_s = st.sampled_from(STEPS)
    op_s = st.one_of(
        st.tuples(st.just("step"), step_s, st.one_of(st.none(), st.sampled_from(STATUS_ORDER)),
                  st.sampled_from(["start", "complete"])),
        st.tuples(st.just("advance"), step_s),
        st.tuples(st.just("finish"), step_s),
        st.tuples(st.just("set"), key_s, val_s),
        st.tuples(st.just("mark")),
    )
    # A status that belongs to the step it is written with: the shape every caller uses.
    coherent_s = st.one_of(
        st.sampled_from(LIFECYCLE).flatmap(lambda s: st.tuples(
            st.just("step"), st.just(s), st.sampled_from(STEP_STATUSES[s]), st.sampled_from(["start", "complete"]))),
        st.tuples(st.just("advance"), st.sampled_from(LIFECYCLE)),
        st.tuples(st.just("finish"), step_s),
        st.tuples(st.just("mark")),
    )
    CONCURRENT_STEPS = ["clarify", "plan", "tasks", "analyze", "implement", "converge"]
    concurrent_s = st.one_of(
        st.tuples(st.just("set"), key_s, val_s),
        st.tuples(st.just("finish"), st.sampled_from(CONCURRENT_STEPS)),
        st.tuples(st.just("step"), st.sampled_from(CONCURRENT_STEPS), st.none(), st.just("start")),
    )
    GOOD = json.dumps({
        "workflow": "speckit", "specName": "x", "branch": "main", "currentStep": "plan", "status": "planned",
        "history": [{"step": "specify", "substep": None, "kind": "start", "by": "extension", "at": "2026-01-01T00:00:00.000Z"},
                    {"step": "specify", "substep": None, "kind": "complete", "by": "extension", "at": "2026-01-01T00:01:00.000Z"}],
    }, indent=2) + "\n"
    damaged_s = st.one_of(
        st.integers(1, len(GOOD) - 2).map(lambda n: GOOD[:n].encode("utf-8")),
        st.text(max_size=40).map(lambda t: t.encode("utf-8")),
        st.binary(max_size=40),
        st.sampled_from([b"[]", b'"str"', b"null", b"5", b"", b"  \n", b"\xff\xfe{"]),
    )
    write_s = st.sampled_from([["--set", "k_a=vb"], ["--step", "plan", "--status", "planning"], ["--step", "specify", "--finish"]])
else:
    def given(*_a, **_k):
        return lambda f: f

    def settings(*_a, **_k):
        return lambda f: f

    class _Absent:
        def __getattr__(self, _name):
            return lambda *a, **k: None

    COMMON = {}
    st = _Absent()
    op_s = coherent_s = concurrent_s = key_s = val_s = damaged_s = write_s = None


def argv(op) -> list[str]:
    if op[0] == "step":
        _, step, status, kind = op
        return ["--step", step, "--kind", kind] + (["--status", status] if status else [])
    if op[0] == "advance":
        return ["--step", op[1], "--advance"]
    if op[0] == "finish":
        return ["--step", op[1], "--finish"]
    if op[0] == "set":
        return ["--set", f"{op[1]}={op[2]}"]
    return ["--mark-complete"]


@unittest.skipUnless(ENABLED, REASON)
class RecordProperties(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name).resolve()
        subprocess.run(["git", "init", "-q"], cwd=cls.root, check=True)
        cls.counter = itertools.count(1)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def feature(self) -> str:
        rel = f"specs/{next(self.counter):04d}-x"
        (self.root / rel).mkdir(parents=True)
        return rel

    def run_writer(self, rel, *args):
        return subprocess.run([sys.executable, str(WRITER), "--feature-dir", rel, *args],
                              cwd=self.root, capture_output=True, text=True, env=ENV)

    def record(self, rel):
        path = self.root / rel / ".spec-context.json"
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None

    @settings(max_examples=30, **COMMON)
    @given(st.lists(op_s, min_size=1, max_size=8))
    def test_history_only_grows(self, ops):
        rel, before = self.feature(), []
        for op in ops:
            self.run_writer(rel, *argv(op))
            ctx = self.record(rel)
            if ctx is None:
                continue
            history = ctx.get("history", [])
            self.assertGreaterEqual(len(history), len(before), op)
            self.assertEqual(history[:len(before)], before, op)
            before = history

    @settings(max_examples=40, **COMMON)
    @given(st.lists(coherent_s, min_size=1, max_size=8))
    def test_status_never_moves_backward(self, ops):
        rel, last = self.feature(), None
        for op in ops:
            self.run_writer(rel, *argv(op))
            status = (self.record(rel) or {}).get("status")
            if status in RANK and last in RANK:
                self.assertGreaterEqual(RANK[status], RANK[last], f"{last} -> {status} on {op}")
            if status in RANK:
                last = status

    @settings(max_examples=20, **COMMON)
    @given(st.dictionaries(key_s, val_s, min_size=2, max_size=5), st.lists(op_s, max_size=3))
    def test_writes_merge(self, fields, lifecycle):
        rel = self.feature()
        for i, (key, value) in enumerate(fields.items()):
            self.run_writer(rel, "--set", f"{key}={value}")
            if i < len(lifecycle):
                self.run_writer(rel, *argv(lifecycle[i]))
        ctx = self.record(rel)
        for key, value in fields.items():
            self.assertEqual(ctx.get(key), value, key)

    @settings(max_examples=15, **COMMON)
    @given(st.lists(concurrent_s, min_size=4, max_size=8), st.booleans())
    def test_parallel_writers_lose_nothing(self, ops, seeded):
        rel = self.feature()
        if seeded:
            self.run_writer(rel, "--step", "specify", "--status", "specified")
        before = len(self.record(rel)["history"]) if seeded else 0
        procs = [subprocess.Popen([sys.executable, str(WRITER), "--feature-dir", rel, *argv(op)], cwd=self.root,
                                  stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, env=ENV) for op in ops]
        errors = [p.communicate()[1] for p in procs]
        ctx = self.record(rel)
        self.assertIsInstance(ctx, dict)
        wanted: dict = {}
        for op in ops:
            if op[0] == "set":
                wanted.setdefault(op[1], set()).add(op[2])
        for key, values in wanted.items():
            self.assertIn(ctx.get(key), values, errors)
        history = ctx.get("history", [])
        refused = {m for e in errors for m in re.findall(r"not regressing to ([\w-]+)/", e)}
        for op in ops:
            if op[0] == "finish":
                self.assertTrue(any(e["step"] == op[1] and e["kind"] == "complete" for e in history), errors)
            if op[0] == "step" and op[1] not in refused:
                self.assertTrue(any(e["step"] == op[1] and e["kind"] == "start" for e in history), errors)
        self.assertGreaterEqual(len(history), before)
        keys = [(e["step"], e["substep"], e["kind"]) for e in history]
        self.assertEqual(len(keys), len(set(keys)))
        self.assertEqual(list((self.root / rel).glob("*.tmp")), [])

    @settings(max_examples=50, **COMMON)
    @given(damaged_s, write_s)
    def test_a_damaged_record_is_kept_aside(self, content, write):
        try:
            if isinstance(json.loads(content.decode("utf-8")), dict):
                return
        except ValueError:
            pass
        rel = self.feature()
        (self.root / rel / ".spec-context.json").write_bytes(content)
        result = self.run_writer(rel, *write)
        copies = list((self.root / rel).glob(".spec-context.damaged-*.json"))
        if not content.strip():
            self.assertEqual(copies, [], "a blank record has nothing to keep")
            return
        self.assertEqual(len(copies), 1, result.stderr)
        self.assertEqual(copies[0].read_bytes(), content)
        self.assertIn(copies[0].name, result.stderr)

    @settings(max_examples=10, **COMMON)
    @given(st.sampled_from(["oops", 5, {"a": 1}]), write_s)
    def test_a_history_that_is_not_a_list_is_quarantined(self, bad, write):
        rel = self.feature()
        (self.root / rel / ".spec-context.json").write_text(json.dumps({"workflow": "speckit", "history": bad}), encoding="utf-8")
        self.run_writer(rel, *write)
        ctx = self.record(rel)
        self.assertTrue(ctx.get("historyQuarantined") == bad or ctx.get("history") == bad, ctx)


if __name__ == "__main__":
    unittest.main()
