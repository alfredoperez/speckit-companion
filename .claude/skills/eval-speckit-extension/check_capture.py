#!/usr/bin/env python3
"""Deterministic eval for speckit-extension lifecycle capture.

Given a spec dir holding `.spec-context.json`, assert the capture contract and
print a PASS/FAIL report plus a timing breakdown (step→step gaps and per-task
cadence). Stdlib only. Re-runnable; extend CHECKS as features land.

Usage:
    python3 check_capture.py specs/<NNN>-<slug>/
    python3 check_capture.py --json specs/<NNN>-<slug>/
    python3 check_capture.py --strict specs/<NNN>-<slug>/   # exit 1 on any FAIL
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

CANONICAL_STEPS = ["specify", "clarify", "plan", "tasks", "analyze", "implement"]
CANONICAL_STATUSES = [
    "draft", "specifying", "specified", "planning", "planned", "tasking",
    "ready-to-implement", "implementing", "implemented", "completed", "archived",
]
VALID_BY = {"extension", "user", "cli", "ai", "derive", "sdd"}
VALID_KIND = {"start", "complete"}
COMPLETED_TASK_RE = re.compile(r"^\s*[-*]\s*\[[xX]\]\s*\*\*(T\d+)")
ALL_TASK_RE = re.compile(r"^\s*[-*]\s*\[[ xX]\]\s*\*\*(T\d+)")


def _parse_at(s: str) -> dt.datetime | None:
    try:
        return dt.datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _looks_handtyped(at: str) -> bool:
    """A real hook write carries sub-second precision; round `:SS.000`/no-ms or
    `:00`-second values are the hallmark of an AI-typed timestamp."""
    s = str(at)
    if "." not in s:
        return True
    frac = s.split(".", 1)[1]
    return frac.startswith("000")


class Report:
    def __init__(self) -> None:
        self.rows: list[tuple[str, str, str]] = []  # (status, id, detail)

    def add(self, ok: bool | None, cid: str, detail: str) -> None:
        status = "INFO" if ok is None else ("PASS" if ok else "FAIL")
        self.rows.append((status, cid, detail))

    @property
    def failed(self) -> int:
        return sum(1 for s, _, _ in self.rows if s == "FAIL")

    def to_text(self) -> str:
        out = []
        for status, cid, detail in self.rows:
            mark = {"PASS": "✓", "FAIL": "✗", "INFO": "·"}[status]
            out.append(f"  {mark} [{status}] {cid}: {detail}")
        passes = sum(1 for s, _, _ in self.rows if s == "PASS")
        out.append("")
        out.append(f"  → {passes} pass / {self.failed} fail / "
                   f"{sum(1 for s, _, _ in self.rows if s == 'INFO')} info")
        return "\n".join(out)

    def to_dict(self) -> dict:
        return {
            "checks": [{"status": s, "id": c, "detail": d} for s, c, d in self.rows],
            "failed": self.failed,
        }


def run_checks(spec_dir: Path) -> Report:
    r = Report()
    target = spec_dir / ".spec-context.json"

    if not target.is_file():
        r.add(False, "file-exists", f"no .spec-context.json in {spec_dir}")
        return r
    try:
        ctx = json.loads(target.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        r.add(False, "valid-json", f"could not parse: {exc}")
        return r
    r.add(True, "valid-json", "parses")

    history = ctx.get("history")
    if not isinstance(history, list) or not history:
        legacy = "transitions[] present" if isinstance(ctx.get("transitions"), list) else "none"
        r.add(False, "canonical-history",
              f"`history[]` missing or empty (legacy: {legacy})")
        history = ctx.get("transitions") if isinstance(ctx.get("transitions"), list) else []
    else:
        r.add(True, "canonical-history", f"{len(history)} entries")

    # A2 — no legacy keys persisted.
    legacy_keys = [k for k in ("transitions", "stepHistory") if k in ctx]
    r.add(not legacy_keys, "no-legacy-keys",
          "clean" if not legacy_keys else f"persisted legacy key(s): {legacy_keys}")

    cur = ctx.get("currentStep")
    r.add(cur in CANONICAL_STEPS, "currentStep-valid", f"currentStep={cur}")
    status = ctx.get("status")
    r.add(status in CANONICAL_STATUSES, "status-valid", f"status={status}")

    # last entry's step matches currentStep (unless terminal currentStep=done).
    if history:
        last_step = history[-1].get("step")
        ok = last_step == cur or cur in (None, "done") or ctx.get("status") in ("completed", "archived")
        r.add(ok, "last-entry-matches-currentStep",
              f"last history step={last_step}, currentStep={cur}")

    # entries well-formed
    bad = []
    for i, e in enumerate(history):
        if not isinstance(e, dict):
            bad.append(f"#{i} not an object"); continue
        if e.get("step") not in CANONICAL_STEPS:
            bad.append(f"#{i} step={e.get('step')}")
        if e.get("kind") not in VALID_KIND:
            bad.append(f"#{i} kind={e.get('kind')}")
        if e.get("by") not in VALID_BY:
            bad.append(f"#{i} by={e.get('by')}")
        if _parse_at(e.get("at")) is None:
            bad.append(f"#{i} bad at={e.get('at')}")
    r.add(not bad, "entries-well-formed", "all valid" if not bad else "; ".join(bad[:5]))

    # monotonic timestamps
    times = [_parse_at(e.get("at")) for e in history if _parse_at(e.get("at"))]
    mono = all(times[i] <= times[i + 1] for i in range(len(times) - 1)) if len(times) > 1 else True
    r.add(mono, "timestamps-monotonic",
          "non-decreasing" if mono else "out-of-order timestamps found")

    # authorship breakdown (info)
    by_counts: dict[str, int] = {}
    for e in history:
        by_counts[e.get("by")] = by_counts.get(e.get("by"), 0) + 1
    r.add(None, "authorship", ", ".join(f"{k}={v}" for k, v in sorted(by_counts.items())) or "none")
    r.add(by_counts.get("extension", 0) > 0 or by_counts.get("derive", 0) > 0,
          "hook-or-derive-captured",
          f"extension={by_counts.get('extension', 0)}, derive={by_counts.get('derive', 0)}")

    # lifecycle coverage (info)
    steps_seen = [s for s in CANONICAL_STEPS if any(e.get("step") == s for e in history)]
    r.add(None, "lifecycle-coverage", " → ".join(steps_seen) or "none")

    # timestamp realness (backfill heuristic)
    if history:
        handtyped = sum(1 for e in history if _looks_handtyped(e.get("at", "")))
        ratio = handtyped / len(history)
        r.add(handtyped == 0, "timestamps-real",
              f"{handtyped}/{len(history)} look hand-typed (round ms) — "
              f"{'all real' if handtyped == 0 else 'capture may be backfilled, not live'}")

    # per-task journaling + cross-check vs tasks.md
    task_entries = [e for e in history if isinstance(e.get("task"), str)]
    tasks_md = spec_dir / "tasks.md"
    if any(e.get("step") == "implement" for e in history):
        if task_entries:
            substep_ok = all(e.get("substep") == e.get("task") for e in task_entries)
            r.add(substep_ok, "per-task-substeps",
                  f"{len(task_entries)} task events; substep==task: {substep_ok}")
        else:
            r.add(False, "per-task-substeps", "implement reached but no per-task events journaled")
        if tasks_md.is_file():
            done = []
            for line in tasks_md.read_text(encoding="utf-8").splitlines():
                m = COMPLETED_TASK_RE.match(line)
                if m:
                    done.append(m.group(1))
            distinct_done = list(dict.fromkeys(done))
            journaled = [e.get("task") for e in task_entries]
            missing = [t for t in distinct_done if t not in journaled]
            r.add(not missing, "per-task-matches-tasksmd",
                  f"tasks.md done={len(distinct_done)}, journaled={len(journaled)}"
                  + (f", MISSING {missing}" if missing else ""))

    # timing breakdown (info)
    _timing(r, history)
    return r


def _timing(r: Report, history: list) -> None:
    # First occurrence per step → step-boundary gaps.
    firsts: list[tuple[str, dt.datetime]] = []
    seen = set()
    for e in history:
        s = e.get("step")
        at = _parse_at(e.get("at"))
        if s and at and s not in seen:
            seen.add(s)
            firsts.append((s, at))
    if len(firsts) >= 2:
        parts = []
        for i in range(1, len(firsts)):
            gap = (firsts[i][1] - firsts[i - 1][1]).total_seconds()
            parts.append(f"{firsts[i-1][0]}→{firsts[i][0]} {_fmt(gap)}")
        r.add(None, "step-timing", " | ".join(parts))
    # Per-task cadence within implement.
    task_times = [(e.get("task"), _parse_at(e.get("at"))) for e in history
                  if isinstance(e.get("task"), str) and _parse_at(e.get("at"))]
    if len(task_times) >= 2:
        gaps = [(task_times[i][1] - task_times[i - 1][1]).total_seconds()
                for i in range(1, len(task_times))]
        r.add(None, "task-cadence",
              f"{len(task_times)} tasks; gaps {', '.join(_fmt(g) for g in gaps)}")


def _fmt(seconds: float) -> str:
    if seconds < 1:
        return f"{int(seconds*1000)}ms"
    if seconds < 90:
        return f"{seconds:.1f}s"
    return f"{seconds/60:.1f}m"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("spec_dir")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--strict", action="store_true", help="exit 1 if any check FAILs")
    args = ap.parse_args()

    spec_dir = Path(args.spec_dir)
    report = run_checks(spec_dir)

    if args.json:
        print(json.dumps(report.to_dict(), indent=2))
    else:
        print(f"\nLifecycle-capture eval — {spec_dir}\n")
        print(report.to_text())

    return 1 if (args.strict and report.failed) else 0


if __name__ == "__main__":
    sys.exit(main())
