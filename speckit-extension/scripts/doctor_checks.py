#!/usr/bin/env python3
"""The doctor's record-derived checks.

Everything here reads `.spec-context.json` and the spec's own documents, so it
works on a spec created long before run tracing existed — which is the point:
the specs causing pain today are the ones already on disk.

Each check returns `(CheckStatus, [Finding, …])`. A check that cannot look
returns a skip with its reason instead of an empty finding list, because "found
nothing" and "could not look" must never print the same way. Stdlib only.
"""

from __future__ import annotations

import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from doctor import (  # noqa: E402
    CheckStatus,
    Finding,
    log_entries,
    parse_time,
    plural,
    run_window,
)
from spec_context import (  # noqa: E402
    STEP_COMPLETED_STATUS,
    STEP_ORDER,
    _entry_kind,
    _is_per_task,
    _is_step_level,
)
from task_sync import parse_task_markers  # noqa: E402

#: Steps whose boundaries the extension stamps; an `ai` complete there is an
#: anomaly, because it lands first and permanently blocks the hook's close.
EXTENSION_STEPS = {"specify", "plan", "tasks", "implement"}
#: Steps the AI self-closes. An `extension` complete here is the mirror anomaly.
AI_STEPS = {"clarify", "analyze"}

#: Task finishes packed tighter than this are journaling recorded in one burst,
#: not work that genuinely took that long.
BURST_WINDOW_SECONDS = 5.0
BURST_MIN_TASKS = 3

#: How long a step may sit open before an unfinished start stops reading as "still
#: running" and starts reading as "never finished". The doctor cannot see whether a
#: process is alive, so time since the start is the only honest signal — and the
#: symptom this check exists for is a step that has been open for days.
IN_FLIGHT_GRACE_SECONDS = 30 * 60


def _no_record(check: str, feature_dir: Path, ctx: dict) -> CheckStatus | None:
    """The shared "there is nothing to read" skip."""
    path = feature_dir / ".spec-context.json"
    if not path.is_file():
        return CheckStatus(check, "skipped", "no .spec-context.json — nothing recorded for this spec")
    if not ctx:
        return CheckStatus(check, "skipped", f"{path.name} is unreadable or not an object")
    if not log_entries(ctx):
        return CheckStatus(check, "skipped", "history[] is empty — nothing to check")
    return None


def _dangling_steps(ctx: dict, now: datetime | None = None) -> list:
    """Step-level starts with no matching complete.

    The run's own current step is given a grace period — it may genuinely still
    be running. Past that, an open start is the symptom: a step that started and
    never finished, which is what leaves a spec stuck.
    """
    log = log_entries(ctx)
    current = ctx.get("currentStep")
    terminal = ctx.get("status") in ("completed", "archived", "implemented")
    now = now or datetime.now(timezone.utc)
    started, completed = {}, set()
    for e in log:
        step = e.get("step")
        if not isinstance(step, str) or not _is_step_level(e):
            continue
        if _entry_kind(e) == "start":
            started.setdefault(step, e.get("at"))
        else:
            completed.add(step)
    out = []
    for step, at in started.items():
        if step in completed:
            continue
        if step == current and not terminal:
            ts = parse_time(at)
            if ts is None or (now - ts).total_seconds() < IN_FLIGHT_GRACE_SECONDS:
                continue  # still plausibly running
        out.append((step, at))
    return sorted(out, key=lambda p: STEP_ORDER.get(p[0], 99))


def _journaled_task_ids(ctx: dict) -> set:
    return {
        e["task"] for e in log_entries(ctx)
        if _is_per_task(e) and isinstance(e.get("task"), str) and _entry_kind(e) == "complete"
    }


def _task_finish_times(ctx: dict) -> list:
    out = []
    for e in log_entries(ctx):
        if _is_per_task(e) and _entry_kind(e) == "complete":
            ts = parse_time(e.get("at"))
            if ts is not None:
                out.append((e.get("task"), ts))
    return sorted(out, key=lambda p: p[1])


def _attribution_anomalies(ctx: dict) -> list:
    out = []
    for e in log_entries(ctx):
        step, by = e.get("step"), e.get("by")
        if not isinstance(step, str) or _entry_kind(e) != "complete" or not _is_step_level(e):
            continue
        if step in EXTENSION_STEPS and by == "ai":
            out.append((step, by, e.get("at"),
                        "the extension stamps this step's boundaries; an ai complete lands "
                        "first and permanently blocks the hook's close"))
        elif step in AI_STEPS and by == "extension":
            out.append((step, by, e.get("at"),
                        "this step is self-closed by the ai; an extension complete here means "
                        "a hook fired for a step it does not own"))
    return out


def check_record(feature_dir: Path, ctx: dict, now: datetime | None = None) -> tuple:
    """Dangling steps, unjournaled tasks, burst journaling, attribution anomalies.

    `now` is injectable so a test can evaluate a fixture from a fixed vantage
    point — the in-flight grace period is relative to the moment of the check.
    """
    skip = _no_record("record", feature_dir, ctx)
    if skip is not None:
        return skip, []

    findings = []

    for step, at in _dangling_steps(ctx, now):
        findings.append(Finding(
            "record", "problem",
            f"Step `{step}` started and never finished",
            f"start at {at}, no matching complete in history[]",
            {"step": step, "start_at": at},
        ))

    tasks_md = feature_dir / "tasks.md"
    if tasks_md.is_file():
        _all_ids, done = parse_task_markers(tasks_md)
        journaled = _journaled_task_ids(ctx)
        missing = [t for t in done if t not in journaled]
        if missing:
            shown = ", ".join(missing[:8]) + (f", +{len(missing) - 8} more" if len(missing) > 8 else "")
            findings.append(Finding(
                "record", "problem",
                f"{plural(len(missing), 'task')} checked in tasks.md with no journal entry",
                shown,
                {"tasks": missing},
            ))

    finishes = _task_finish_times(ctx)
    if len(finishes) >= BURST_MIN_TASKS:
        span = (finishes[-1][1] - finishes[0][1]).total_seconds()
        if span <= BURST_WINDOW_SECONDS:
            findings.append(Finding(
                "record", "warning",
                f"{len(finishes)} task finishes recorded inside {span:.0f}s — journaling was batched",
                "the per-task timestamps reflect when the batch was written, not how long "
                "each task took; the summaries are still trustworthy, the durations are not",
                {"tasks": [t for t, _ in finishes], "span_seconds": span},
            ))

    for step, by, at, why in _attribution_anomalies(ctx):
        findings.append(Finding(
            "record", "warning",
            f"Step `{step}` was closed by `{by}`",
            f"{why} (at {at})",
            {"step": step, "by": by, "at": at},
        ))

    return CheckStatus("record", "ran"), findings


def _derived_badges(ctx: dict) -> dict:
    """The viewer's step badges, re-derived from history[] in Python.

    The viewer builds its stepper from history[] alone once a context file is
    present — there is no file-existence fallback. So this derivation is what the
    pipeline bar actually shows, and comparing it against `status` is what makes
    the status-versus-display question decidable rather than a guess.
    """
    badges = {}
    for e in log_entries(ctx):
        step = e.get("step")
        if not isinstance(step, str) or not _is_step_level(e):
            continue
        kind = _entry_kind(e)
        if kind == "complete":
            badges[step] = "completed"
        elif badges.get(step) != "completed":
            badges[step] = "in-progress"
    return badges


def check_triage(feature_dir: Path, ctx: dict) -> tuple:
    """Is a status-versus-pipeline-bar mismatch a capture bug or a display bug?"""
    skip = _no_record("triage", feature_dir, ctx)
    if skip is not None:
        return skip, []

    status = ctx.get("status")
    badges = _derived_badges(ctx)

    #: The step whose completion `status` is asserting, if any.
    claimed = next((s for s, st in STEP_COMPLETED_STATUS.items() if st == status), None)
    if claimed is None:
        return CheckStatus("triage", "not-applicable"), []

    if badges.get(claimed) == "completed":
        return CheckStatus("triage", "ran"), [Finding(
            "triage", "note",
            "Records are consistent — suspect the display",
            f"status `{status}` and history[] agree that `{claimed}` finished, so the stepper "
            f"has what it needs; if the pipeline bar still will not advance, the defect is on "
            f"the display side, not in capture",
            {"status": status, "step": claimed, "badge": badges.get(claimed)},
        )]

    return CheckStatus("triage", "ran"), [Finding(
        "triage", "problem",
        "Records disagree with each other — capture path",
        f"status says `{status}`, but history[] has no step-level complete for `{claimed}` "
        f"(derived badge: {badges.get(claimed) or 'not-started'}). The viewer derives its "
        f"stepper from history[] alone, so the next step cannot be offered.",
        {"status": status, "step": claimed, "badge": badges.get(claimed)},
    )]


#: Substrings that identify a completion attempt in the trace.
_COMPLETION_OPS = ("mark-complete",)


def _completion_attempts(feature_dir: Path, ctx: dict) -> list:
    """Completion attempts belonging to THIS spec.

    The spec's own trace is unambiguous. The repo-level unattributed log is
    shared, so an attempt is only this spec's if it falls inside this spec's run
    window — otherwise one unresolvable mark-complete from months ago would be
    reported as a refusal against every spec in the repository.
    """
    import run_trace

    out = []
    own = run_trace.read(feature_dir)
    if own is not None:
        out += [e for e in own.events if e.get("op") in _COMPLETION_OPS]

    shared = run_trace.read(Path(feature_dir).parent)
    if shared is not None:
        start, end = run_window(ctx)
        rel = Path(feature_dir).name
        for e in shared.events:
            if e.get("op") not in _COMPLETION_OPS:
                continue
            spec = e.get("spec")
            if spec and rel not in str(spec):
                continue
            ts = parse_time(e.get("at"))
            if not (start and end and ts is not None and start <= ts <= end):
                continue
            out.append(e)
    return out


def check_completion(feature_dir: Path, ctx: dict, report=None) -> tuple:
    """Why a spec that should be completed is not.

    Four outcomes stay strictly distinct. "Never attempted" and "attempted and
    never arrived" are different problems with different fixes, and collapsing
    them is exactly what leaves a spec silently stuck.
    """
    skip = _no_record("completion", feature_dir, ctx)
    if skip is not None:
        return skip, []

    status = ctx.get("status")
    attempts = _completion_attempts(feature_dir, ctx)
    verdict = {"attempted": bool(attempts), "outcome": None, "reason": None}

    def settled(findings: list) -> tuple:
        """Publish the verdict onto the report, then hand back this check's result."""
        if report is not None:
            report.completion = verdict
        return CheckStatus("completion", "ran"), findings

    if status in ("completed", "archived"):
        verdict.update(outcome="completed")
        return settled([])

    if not attempts:
        verdict.update(outcome="not-attempted")
        if not _tasks_all_checked(feature_dir):
            return settled([])
        return settled([Finding(
            "completion", "note",
            "Every task is checked but completion was never attempted",
            f"the spec sits at `{status}`; nothing tried to mark it complete, so this is "
            f"a step that did not run rather than a write that failed",
            verdict,
        )])

    failed = [a for a in attempts if not a.get("ok")]
    if failed:
        reason = failed[-1].get("reason") or "no reason recorded"
        verdict.update(outcome="refused", reason=reason)
        return settled([Finding(
            "completion", "problem",
            "Marking this spec complete was refused",
            reason,
            verdict,
        )])

    verdict.update(
        outcome="never-arrived",
        reason=f"a completion call was recorded as succeeding, but the status is still `{status}`",
    )
    return settled([Finding(
        "completion", "problem",
        "A completion write was recorded but the spec never landed as completed",
        verdict["reason"] + " — the write went somewhere other than this spec, or was "
        "overwritten afterwards",
        verdict,
    )])


def _tasks_all_checked(feature_dir: Path) -> bool:
    tasks_md = Path(feature_dir) / "tasks.md"
    if not tasks_md.is_file():
        return False
    all_ids, done = parse_task_markers(tasks_md)
    return bool(all_ids) and len(all_ids) == len(done)


#: The generated task-list shape: one phase per user story, waves inside each
#: phase, join lines between waves, a checkpoint at the end. Implement executes
#: that list — it never restructures it, so a later rewrite is a defect.
_STORY_PHASE = re.compile(r"^##\s+Phase\s+\d+:\s*User Story\s+\d+", re.MULTILINE)
_ANY_PHASE = re.compile(r"^##\s+Phase\s+\d+:", re.MULTILINE)
_TOP_LEVEL_WAVE = re.compile(r"^##\s+Wave\s+\d+", re.MULTILINE)
_WAVE_HEAD = re.compile(r"^\*\*Wave\s+\d+", re.MULTILINE)
_JOIN_LINE = re.compile(r"⟶\s*Wait")
_CHECKPOINT = re.compile(r"^\*\*Checkpoint\*\*", re.MULTILINE)


def check_template(feature_dir: Path) -> tuple:
    """Did the task list keep the shape it was generated with?"""
    tasks_md = Path(feature_dir) / "tasks.md"
    if not tasks_md.is_file():
        return CheckStatus("template", "not-applicable"), []
    try:
        text = tasks_md.read_text(encoding="utf-8")
    except OSError as exc:
        return CheckStatus("template", "skipped", f"tasks.md unreadable — {exc}"), []

    findings = []
    story_phases = _STORY_PHASE.findall(text)
    top_waves = [m.group(0).strip() for m in _TOP_LEVEL_WAVE.finditer(text)]

    if top_waves and not story_phases:
        findings.append(Finding(
            "template", "problem",
            "User-story phases were replaced by top-level wave headings",
            "offending headings: " + ", ".join(sorted(set(top_waves))[:6])
            + " — waves belong inside a story phase, not in place of one",
            {"headings": sorted(set(top_waves))},
        ))
    elif top_waves:
        findings.append(Finding(
            "template", "problem",
            "Top-level wave headings were added alongside the story phases",
            "offending headings: " + ", ".join(sorted(set(top_waves))[:6]),
            {"headings": sorted(set(top_waves))},
        ))
    elif not story_phases and _ANY_PHASE.search(text):
        findings.append(Finding(
            "template", "warning",
            "No user-story phase headings remain",
            "the file has phases but none names a user story, so task-to-story traceability "
            "is gone",
            {},
        ))

    if _WAVE_HEAD.search(text) and not _JOIN_LINE.search(text):
        findings.append(Finding(
            "template", "problem",
            "Wave join lines were removed",
            "the file declares waves but carries no `⟶ Wait` line, so the dependency "
            "boundaries between them are gone",
            {},
        ))

    if story_phases and not _CHECKPOINT.search(text):
        findings.append(Finding(
            "template", "warning",
            "Story checkpoints were removed",
            "each user-story phase should end with a Checkpoint line stating the story is "
            "independently functional",
            {},
        ))

    return CheckStatus("template", "ran"), findings


def check_trace(feature_dir: Path, ctx: dict | None = None) -> tuple:
    """What the self-trace recorded: failures with reasons, volumes, churn.

    Also reports calls that could not resolve any spec at all. Those land in the
    repo-level unattributed log, and they are the single most common capture
    failure — so a spec whose own trace is clean is not evidence that nothing
    broke while it was being built.
    """
    import run_trace

    read = run_trace.read(feature_dir)
    unattributed = _unattributed_failures(feature_dir, ctx or {})

    if read is None:
        if unattributed:
            return CheckStatus("trace", "ran"), [_unattributed_finding(unattributed)]
        return CheckStatus(
            "trace", "skipped",
            f"no {run_trace.TRACE_NAME} — this spec ran before run tracing, or nothing has "
            f"been captured since",
        ), []

    findings = []
    failures = read.failures()
    if failures:
        by_reason: dict = {}
        for e in failures:
            by_reason.setdefault(e.get("reason") or "no reason recorded", []).append(e)
        for reason, group in sorted(by_reason.items(), key=lambda kv: -len(kv[1])):
            findings.append(Finding(
                "trace", "problem",
                f"{plural(len(group), 'capture call')} failed ({group[0].get('op')})",
                reason,
                {"op": group[0].get("op"), "count": len(group), "reason": reason},
            ))

    churn = {f: n for f, n in read.rewrites().items() if n > 1}
    if churn:
        worst = sorted(churn.items(), key=lambda kv: -kv[1])
        findings.append(Finding(
            "trace", "note",
            "File rewrite counts",
            ", ".join(f"{f} x{n}" for f, n in worst[:6]),
            {"rewrites": churn},
        ))

    qualifier = "" if read.exact else " (at least — earlier entries rolled off)"
    findings.append(Finding(
        "trace", "note",
        f"{plural(len(read.events), 'capture call')} recorded{qualifier}",
        f"{read.bytes_written()} bytes written, {read.bytes_read()} bytes of input carried"
        + (f"; {read.unparseable} unreadable line(s) skipped" if read.unparseable else ""),
        {"calls": len(read.events), "failures": len(failures),
         "bytes_written": read.bytes_written(), "bytes_read": read.bytes_read(),
         "unparseable": read.unparseable, "truncated": read.truncated},
    ))

    if unattributed:
        findings.append(_unattributed_finding(unattributed))

    return CheckStatus("trace", "ran"), findings


def _unattributed_failures(feature_dir: Path, ctx: dict) -> list:
    """Failed calls that resolved to no spec, inside this spec's run window."""
    import run_trace

    log = Path(feature_dir).parent / run_trace.TRACE_NAME
    if not log.is_file():
        return []
    read = run_trace.read(log.parent)
    if read is None:
        return []
    start, end = run_window(ctx)
    out = []
    for e in read.events:
        if e.get("ok"):
            continue
        ts = parse_time(e.get("at"))
        if start and end and ts is not None and not (start <= ts <= end):
            continue
        out.append(e)
    return out


def _unattributed_finding(events: list) -> Finding:
    reasons = sorted({e.get("reason") or "no reason recorded" for e in events})
    return Finding(
        "trace", "problem",
        f"{plural(len(events), 'capture call')} could not resolve a spec and wrote nothing",
        reasons[0] + (f" (+{len(reasons) - 1} other reason(s))" if len(reasons) > 1 else ""),
        {"count": len(events), "reasons": reasons},
    )
