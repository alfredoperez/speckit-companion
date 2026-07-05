#!/usr/bin/env python3
"""Assert the context file a stock-mode forced-preamble run must produce.

Usage: assert_capture.py <feature-dir>
Exits non-zero with one line per failed assertion; prints PASS lines otherwise.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

IN_PROGRESS = {"draft", "specifying"}


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: assert_capture.py <feature-dir>", file=sys.stderr)
        return 2
    ctx_path = Path(sys.argv[1]) / ".spec-context.json"
    if not ctx_path.exists():
        print(f"FAIL: {ctx_path} does not exist — the run never wrote the context file")
        return 1
    ctx = json.loads(ctx_path.read_text())

    failures: list[str] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        if ok:
            print(f"PASS: {name}")
        else:
            failures.append(name)
            print(f"FAIL: {name}{' — ' + detail if detail else ''}")

    status = ctx.get("status", "")
    check("status advanced past specifying", status not in IN_PROGRESS, f"status={status!r}")
    check("intent recorded", bool(str(ctx.get("intent", "")).strip()))
    check("at least one expectation", len(ctx.get("expectations") or []) >= 1)
    check("at least one context entry", len(ctx.get("context") or []) >= 1)

    coverage = ctx.get("coverage") or {}
    if isinstance(coverage, list):  # legacy list form
        coverage = {r.get("req", str(i)): r for i, r in enumerate(coverage)}
    check("at least one requirement captured", len(coverage) >= 1)
    if coverage:
        untitled = [req for req, row in coverage.items() if not str(row.get("title", "")).strip()]
        check("every requirement titled", not untitled, f"untitled: {untitled}")

    tasks = ctx.get("task_summaries") or {}
    check("at least one task journaled", len(tasks) >= 1)
    undone = [t for t, v in tasks.items() if not str(v.get("did", "")).strip()]
    check("every journaled task has a summary", not undone, f"missing did: {undone}")

    check("at least one verified check", len(ctx.get("verified") or []) >= 1)

    history = ctx.get("history") or []
    check("history is non-empty and append-shaped", len(history) >= 2 and all("step" in h and "kind" in h for h in history))

    if failures:
        print(f"\n{len(failures)} assertion(s) failed")
        return 1
    print("\nAll capture assertions passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
