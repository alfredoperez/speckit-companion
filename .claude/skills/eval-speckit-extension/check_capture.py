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
from collections import Counter
from pathlib import Path

CANONICAL_STEPS = ["specify", "clarify", "plan", "tasks", "analyze", "implement"]
CANONICAL_STATUSES = [
    "draft", "specifying", "specified", "planning", "planned", "tasking",
    "ready-to-implement", "implementing", "implemented", "completed", "archived",
]
VALID_BY = {"extension", "user", "cli", "ai", "derive"}
# Writers that read the real clock at write time → held to ms-precision + monotonic.
# `ai` is excluded: it journals best-effort with second-precision `date -u`.
DETERMINISTIC_BY = {"extension", "derive", "cli", "user"}
VALID_KIND = {"start", "complete"}
# `**` optional: accepts both the bold (`- [x] **T001**`) and plain (`- [x] T001`)
# tasks.md marker formats — see write-context.py's parsers.
COMPLETED_TASK_RE = re.compile(r"^\s*[-*]\s*\[[xX]\]\s*(?:\*\*)?(T\d+)")
ALL_TASK_RE = re.compile(r"^\s*[-*]\s*\[[ xX]\]\s*(?:\*\*)?(T\d+)")


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

    # last entry's step matches currentStep (terminal statuses may sit past it).
    if history:
        last_step = history[-1].get("step")
        ok = last_step == cur or ctx.get("status") in ("completed", "archived")
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

    # monotonic timestamps — strict only for DETERMINISTIC writes (extension/derive/
    # cli/user), which read the real clock in order. AI-journaled entries may burst
    # (the AI batches `date -u`); that coarseness is graded by task-cadence, not failed.
    det_times = [_parse_at(e.get("at")) for e in history
                 if e.get("by") in DETERMINISTIC_BY and _parse_at(e.get("at"))]
    det_mono = all(det_times[i] <= det_times[i + 1] for i in range(len(det_times) - 1)) \
        if len(det_times) > 1 else True
    r.add(det_mono, "timestamps-monotonic",
          "deterministic writes non-decreasing" if det_mono
          else "deterministic writes out of order (capture bug)")

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

    # timestamp realness (backfill heuristic) — only DETERMINISTIC writes are held to
    # ms-precision. `by:ai` entries legitimately carry second precision (the timing
    # partial stamps with `date -u +%SZ`), so whole-second is NOT a backfill signal there.
    det_entries = [e for e in history if e.get("by") in DETERMINISTIC_BY]
    if det_entries:
        handtyped = sum(1 for e in det_entries if _looks_handtyped(e.get("at", "")))
        r.add(handtyped == 0, "timestamps-real",
              f"{handtyped}/{len(det_entries)} deterministic writes look hand-typed (round ms) — "
              f"{'all real' if handtyped == 0 else 'a hook write may be backfilled'}")

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
        # Finish-only invariant: a task carries a SINGLE `complete` (finish) event;
        # a `start` may still appear on legacy/migrated specs. Dedup is checked per
        # (task, kind) — only a repeated (task, kind) means the after_implement hook
        # re-added a task the live path already journaled.
        if task_entries:
            counts = Counter((e.get("task"), e.get("kind")) for e in task_entries)
            dupes = {f"{t}:{k}": n for (t, k), n in counts.items() if n > 1}
            r.add(not dupes, "per-task-no-duplicates",
                  "each task has a single finish (≤1 complete; ≤1 legacy start)" if not dupes
                  else f"DUPLICATED task/kind (hook re-added a live entry): {dupes}")

    # fast-path fold — only asserted when a spec was fast-tracked (substep="fast-path").
    _fastpath(r, history, ctx)

    # timing breakdown (info)
    _timing(r, history)
    return r


def _fastpath(r: Report, history: list, ctx: dict) -> None:
    """When a spec fast-tracked (the simple/minimal-mode branch), plan and tasks
    are folded into the specify run: each carries a `start`+`complete` pair tagged
    `substep="fast-path"`, the timestamps are real, and the spec lands at
    `ready-to-implement`. Silent when no fold is present (a normal spec)."""
    fold = [e for e in history if isinstance(e, dict) and e.get("substep") == "fast-path"]
    if not fold:
        return  # not a fast-tracked spec — nothing to assert
    for step in ("plan", "tasks"):
        kinds = {e.get("kind") for e in fold if e.get("step") == step}
        ok = {"start", "complete"} <= kinds
        r.add(ok, f"fast-path-{step}-folded",
              f"{step} fold has {sorted(kinds)}"
              + ("" if ok else " — expected both start and complete"))
    # The fold is journaled by:ai with real `date -u` — every entry must parse and
    # carry no hand-typed round-second look beyond the ai second-precision norm.
    realness = all(_parse_at(e.get("at")) is not None for e in fold)
    r.add(realness, "fast-path-timestamps-real",
          "all fold timestamps parse" if realness else "a fold timestamp is unparseable")
    status = ctx.get("status")
    landed = status in ("ready-to-implement", "implementing", "implemented", "completed", "archived")
    r.add(landed, "fast-path-ready-to-implement",
          f"status={status}" + ("" if landed else " — expected ready-to-implement after a fold"))


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
    # Per-task cadence within implement (finish-only model). The live path stamps
    # ONE finish per task via a script as work proceeds (by:ai, ms precision) →
    # non-zero gaps are the HEALTHY honest-cadence signal. The end-of-step hook
    # (by:extension) is the backstop; if it journaled the batch, the finishes share
    # a tight window (near-zero gaps) — acceptable, not a defect.
    task_evts = [e for e in history
                 if isinstance(e.get("task"), str) and _parse_at(e.get("at"))]
    if len(task_evts) >= 2:
        task_times = [_parse_at(e["at"]) for e in task_evts]
        gaps = [(task_times[i] - task_times[i - 1]).total_seconds()
                for i in range(1, len(task_times))]
        ai = sum(1 for e in task_evts if e.get("by") == "ai")
        ext = sum(1 for e in task_evts if e.get("by") == "extension")
        source = ("live (by:ai, script-stamped) — honest cadence" if ai and not ext
                  else "backstop (by:extension, end-of-step) — tight window acceptable" if ext and not ai
                  else f"mixed (ai={ai}, extension={ext})")
        r.add(None, "task-cadence",
              f"{len(task_evts)} tasks; source={source}; gaps {', '.join(_fmt(g) for g in gaps)}")


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
