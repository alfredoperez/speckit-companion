#!/usr/bin/env python3
"""Differential check that the writer's command line behaves identically across a change.

Runs a fixed matrix of invocations against two copies of the writer — a reference
copy and the working tree's — each in its own fresh spec directory, and compares
stdout, stderr, exit code, and the resulting .spec-context.json.

Run standalone against an arbitrary reference to prove a refactor changed nothing:

    python3 speckit-extension/tests/test_cli_parity.py --reference /tmp/baseline-scripts

Without a reference the suite still runs the matrix against the working tree and
asserts every invocation is well-formed, so it is safe under plain discovery.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"

# Every distinct dispatch path the command line offers, one invocation each.
# `{fd}` is substituted with the temp feature dir.
MATRIX: list[tuple[str, list[str]]] = [
    ("help", ["--help"]),
    ("default-start", ["--step", "specify", "--status", "specifying", "--kind", "start", "--by", "extension"]),
    ("default-complete", ["--step", "specify", "--status", "specified", "--kind", "complete", "--by", "extension"]),
    ("substep-start", ["--step", "plan", "--substep", "fast-path", "--kind", "start", "--by", "ai"]),
    ("noncanonical-step", ["--step", "done", "--status", "specified"]),
    ("finish", ["--step", "plan", "--finish", "--by", "ai"]),
    ("finish-substep", ["--step", "plan", "--substep", "research", "--finish", "--by", "ai"]),
    ("advance", ["--step", "plan", "--advance", "--by", "ai"]),
    ("set-one", ["--set", "size=normal"]),
    ("set-many", ["--set", "size=normal", "--set", "intent=ship it"]),
    ("set-protected", ["--set", "status=completed"]),
    ("decision-text", ["--decision", "chose the simple path"]),
    ("decision-json", ["--decision", '{"decision": "d1", "why": "w1", "rejected": "r1"}']),
    ("decision-many", ["--decision", "first", "--decision", "second"]),
    ("verified-text", ["--verified", "tests pass"]),
    ("verified-json", ["--verified", '{"what": "suite", "result": "green"}']),
    ("concern-text", ["--concern", "flaky on windows"]),
    ("expectation", ["--expectation", "no version bump"]),
    ("context", ["--context", "area: scripts/"]),
    ("coverage-title", ["--coverage-req", "FR-001", "--title", "the requirement text"]),
    ("coverage-tasks", ["--coverage-req", "FR-001", "--tasks", "T001,T002"]),
    ("coverage-tests", ["--coverage-req", "FR-001", "--tests", "a.py::b"]),
    ("step-summary-text", ["--step", "plan", "--step-summary", "did the plan"]),
    ("step-summary-json", ["--step", "plan", "--step-summary", '{"summary": "s", "key_finding": "k"}']),
    ("classification", ["--classification", '{"projectedFiles": 3, "projectedTasks": 4, "scopeSignal": "none", "verdict": "simple"}']),
    ("classification-bad", ["--classification", "not json"]),
    ("classification-no-verdict", ["--classification", '{"projectedFiles": 1}']),
    ("living-specs", ["--living-specs", "todos", "--living-specs", "todos-items"]),
    ("fold-living-spec", ["--fold-living-spec", "--by", "ai"]),
    ("task-journal", ["--task", "T001", "--kind", "complete", "--by", "ai", "--did", "built it", "--files", "a.py,b.py"]),
    ("task-append", ["--task", "T002", "--kind", "complete", "--by", "ai", "--did", "built it too", "--append"]),
    ("materialize", ["--materialize", "--by", "ai"]),
    ("mark-complete", ["--mark-complete", "--by", "ai"]),
    ("unresolvable-dir", ["--feature-dir", "specs/_does-not-exist", "--step", "plan"]),
]


def _seed(feature_dir: Path) -> None:
    """A spec dir mid-implement, so every dispatch path has something to act on."""
    feature_dir.mkdir(parents=True, exist_ok=True)
    (feature_dir / "spec.md").write_text(
        "# Seed\n\n## ADDED Requirements\n\n### Requirement: Alpha\n\nAlpha body.\n",
        encoding="utf-8",
    )
    (feature_dir / "tasks.md").write_text(
        "- [x] **T001** first\n- [ ] **T002** second\n", encoding="utf-8"
    )
    (feature_dir / ".spec-context.json").write_text(
        json.dumps(
            {
                "specName": "cli-parity",
                "branch": "main",
                "currentStep": "implement",
                "status": "implementing",
                "history": [
                    {"step": "implement", "kind": "start", "by": "extension", "at": "2026-01-01T00:00:00Z"}
                ],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def run_matrix(scripts_dir: Path) -> dict[str, dict]:
    """Every matrix invocation against one copy of the writer, each in a fresh repo."""
    results: dict[str, dict] = {}
    writer = scripts_dir / "write-context.py"
    for name, flags in MATRIX:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            feature_dir = root / "specs" / "001-cli-parity"
            _seed(feature_dir)
            argv = [sys.executable, str(writer)]
            if "--help" not in flags and "--feature-dir" not in flags:
                argv += ["--feature-dir", str(feature_dir)]
            argv += flags
            env = dict(os.environ)
            env.pop("SPECIFY_FEATURE_DIRECTORY", None)
            env.pop("SPECIFY_FEATURE", None)
            proc = subprocess.run(argv, cwd=str(root), capture_output=True, text=True, env=env)
            ctx_path = feature_dir / ".spec-context.json"
            try:
                ctx = json.loads(ctx_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                ctx = None
            results[name] = {
                "exit": proc.returncode,
                "stdout": proc.stdout.replace(str(root), "<ROOT>"),
                "stderr": proc.stderr.replace(str(root), "<ROOT>"),
                "ctx": ctx,
            }
    return results


def _scrub(value):
    """Wall-clock stamps differ between two runs by design — blank them before comparing."""
    if isinstance(value, dict):
        return {k: ("<AT>" if k == "at" else _scrub(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_scrub(v) for v in value]
    return value


def _diff(reference: dict, current: dict) -> list[str]:
    problems = []
    for name in sorted(set(reference) | set(current)):
        ref, cur = reference.get(name), current.get(name)
        if ref is None or cur is None:
            problems.append(f"{name}: present in only one run")
            continue
        for field in ("exit", "stdout", "stderr", "ctx"):
            a, b = _scrub(ref[field]), _scrub(cur[field])
            if a != b:
                problems.append(f"{name}: {field} differs\n  reference: {a!r}\n  current:   {b!r}")
    return problems


class CliMatrixTests(unittest.TestCase):
    """The matrix runs clean against the working tree, whatever the reference."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.results = run_matrix(SCRIPTS)

    def test_every_invocation_is_recognised(self) -> None:
        for name, result in self.results.items():
            with self.subTest(invocation=name):
                self.assertNotIn("unrecognized arguments", result["stderr"], name)

    def test_only_a_malformed_classification_is_a_caller_error(self) -> None:
        for name, result in self.results.items():
            with self.subTest(invocation=name):
                if name == "help":
                    continue
                expected = 2 if name.startswith("classification-") else 0
                self.assertEqual(result["exit"], expected, f"{name}: {result['stderr']}")

    def test_a_capture_call_writes_no_lifecycle_history(self) -> None:
        seeded = 1
        for name in ("decision-text", "verified-text", "concern-text", "expectation", "context",
                     "coverage-title", "step-summary-text", "set-one", "living-specs"):
            with self.subTest(invocation=name):
                ctx = self.results[name]["ctx"]
                self.assertEqual(len(ctx.get("history") or []), seeded, name)

    def test_a_multi_flag_capture_call_records_every_flag(self) -> None:
        ctx = run_one(["--decision", "d-from-multi", "--verified", "v-from-multi"])["ctx"]
        decisions = [d.get("decision") for d in ctx.get("decisions") or []]
        verified = [v.get("what") for v in ctx.get("verified") or []]
        self.assertIn("d-from-multi", decisions)
        self.assertIn("v-from-multi", verified)


def run_one(flags: list[str]) -> dict:
    """One ad-hoc invocation against the working tree, same seeding as the matrix."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        feature_dir = root / "specs" / "001-cli-parity"
        _seed(feature_dir)
        env = dict(os.environ)
        env.pop("SPECIFY_FEATURE_DIRECTORY", None)
        env.pop("SPECIFY_FEATURE", None)
        proc = subprocess.run(
            [sys.executable, str(SCRIPTS / "write-context.py"), "--feature-dir", str(feature_dir), *flags],
            cwd=str(root), capture_output=True, text=True, env=env,
        )
        try:
            ctx = json.loads((feature_dir / ".spec-context.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            ctx = None
        return {"exit": proc.returncode, "stdout": proc.stdout, "stderr": proc.stderr, "ctx": ctx}


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--reference", metavar="DIR", help="a scripts/ directory to compare against")
    parser.add_argument("--record", metavar="FILE", help="write this tree's matrix result to FILE")
    parser.add_argument("--compare", metavar="FILE", help="compare this tree's matrix result against FILE")
    args = parser.parse_args()

    current = run_matrix(SCRIPTS)

    if args.record:
        Path(args.record).write_text(json.dumps(current, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"[cli-parity] recorded {len(current)} invocations to {args.record}")
        return 0

    reference = None
    if args.compare:
        reference = json.loads(Path(args.compare).read_text(encoding="utf-8"))
    elif args.reference:
        with tempfile.TemporaryDirectory() as tmp:
            staged = Path(tmp) / "scripts"
            shutil.copytree(args.reference, staged)
            reference = run_matrix(staged)

    if reference is None:
        print("[cli-parity] no reference given — nothing to compare")
        return 0

    problems = _diff(reference, current)
    if problems:
        print(f"[cli-parity] FAIL — {len(problems)} invocation(s) differ:")
        for problem in problems:
            print(f"  ✗ {problem}")
        return 1
    print(f"[cli-parity] OK — {len(current)} invocations identical")
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1:
        sys.exit(main())
    unittest.main()
