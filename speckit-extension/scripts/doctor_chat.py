#!/usr/bin/env python3
"""The `--chat` deep audit — what the session transcript says actually happened.

The run record says what landed. The transcript says what was *attempted*: work
that was tried and failed, work that was retried, work that was never attempted
at all, and claims the run made that its own recomputed reality contradicts. It
also makes waste measurable — narration, repeated commands, the same file
rewritten over and over.

This is the one part of the doctor built on a format nobody promised to keep
stable, so it is quarantined here and degrades to a single line rather than
failing. It is a builder's tool, not a product surface. Claude-first: other
providers keep no transcript we can read, and that is reported plainly.

Stdlib only.
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import timedelta
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
from spec_context import _entry_kind, _is_step_level  # noqa: E402

TRANSCRIPT_ROOT = Path.home() / ".claude" / "projects"

#: Widen the run window slightly — a call that failed just before a step's start
#: was recorded is still part of that run.
WINDOW_PAD = timedelta(minutes=5)

#: A file touched more than this in one run is churn worth naming.
CHURN_THRESHOLD = 3

_FAILED = re.compile(r"\b(error|failed|traceback|exception|not found|refus\w+|denied)\b", re.I)


def project_key(root) -> str:
    """The directory name Claude derives from a project path."""
    return str(root).replace("/", "-")


def find_transcripts(root, override=None) -> list:
    """Transcript files for this project, newest first."""
    if override:
        p = Path(override)
        return [p] if p.is_file() else []
    d = TRANSCRIPT_ROOT / project_key(root)
    if not d.is_dir():
        return []
    try:
        return sorted((f for f in d.glob("*.jsonl") if f.is_file()),
                      key=lambda f: f.stat().st_mtime, reverse=True)
    except OSError:
        return []


def _entries(path: Path, start, end) -> tuple:
    """(entries inside the window, unparseable line count). Never raises."""
    out, bad = [], 0
    try:
        fh = path.open(encoding="utf-8", errors="replace")
    except OSError:
        return [], 0
    with fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except ValueError:
                bad += 1
                continue
            if not isinstance(obj, dict):
                bad += 1
                continue
            ts = parse_time(obj.get("timestamp"))
            if start and end and ts is not None and not (start <= ts <= end):
                continue
            out.append(obj)
    return out, bad


def _blocks(entry: dict, kind: str) -> list:
    content = (entry.get("message") or {}).get("content")
    if not isinstance(content, list):
        return []
    return [c for c in content if isinstance(c, dict) and c.get("type") == kind]


def _text(entry: dict) -> str:
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    return "\n".join(c.get("text", "") for c in content
                     if isinstance(c, dict) and c.get("type") == "text")


def analyze(entries: list) -> dict:
    """Causes and waste, from the shapes the transcript actually carries."""
    tool_calls, failures, retries = 0, 0, 0
    files: dict = {}
    narration_chars = 0
    assistant_turns = 0
    seen_commands: dict = {}

    for e in entries:
        if e.get("type") == "assistant":
            assistant_turns += 1
            narration_chars += len(_text(e))
            for block in _blocks(e, "tool_use"):
                tool_calls += 1
                params = block.get("input") or {}
                path = params.get("file_path") or params.get("notebook_path")
                if path:
                    files[str(path)] = files.get(str(path), 0) + 1
                cmd = params.get("command")
                if isinstance(cmd, str):
                    key = cmd.strip()[:120]
                    seen_commands[key] = seen_commands.get(key, 0) + 1
                    if seen_commands[key] > 1:
                        retries += 1
        elif e.get("type") == "user":
            for block in _blocks(e, "tool_result"):
                body = block.get("content")
                text = body if isinstance(body, str) else json.dumps(body, ensure_ascii=False)
                if block.get("is_error") or _FAILED.search(text or ""):
                    failures += 1

    return {
        "tool_calls": tool_calls,
        "failures": failures,
        "retries": retries,
        "assistant_turns": assistant_turns,
        "narration_chars": narration_chars,
        "churn": {f: n for f, n in files.items() if n >= CHURN_THRESHOLD},
    }


def _contradictions(ctx: dict, report) -> list:
    """Claims the run recorded that the doctor's own recomputation contradicts."""
    out = []
    for flag in (getattr(report, "drift", None) or []):
        if flag.get("claim"):
            out.append({
                "claim": flag["claim"]["text"],
                "recomputed": f"{flag['capability']} is {flag['class']} drift",
            })
    completion = getattr(report, "completion", None)
    if completion and completion.get("outcome") == "never-arrived":
        out.append({
            "claim": "a completion write was recorded as succeeding",
            "recomputed": f"the spec is still at `{ctx.get('status')}`",
        })
    return out


def _stalled_steps(ctx: dict) -> list:
    """Steps started and never finished — work that stopped rather than failed.

    The run's own current step is excluded: a step that is still in flight has
    not stalled, it simply has not finished yet.
    """
    started, done = set(), set()
    for e in log_entries(ctx):
        if not _is_step_level(e):
            continue
        step = e.get("step")
        (started if _entry_kind(e) == "start" else done).add(step)
    open_steps = {s for s in started - done if isinstance(s, str)}
    if ctx.get("status") not in ("completed", "archived"):
        open_steps.discard(ctx.get("currentStep"))
    return sorted(open_steps)


def check_chat(root, feature_dir: Path, ctx: dict, report=None, override=None) -> tuple:
    """Read the run's transcript and explain causes and waste, or say why not."""
    transcripts = find_transcripts(root, override or os.environ.get("SPECKIT_DOCTOR_TRANSCRIPT"))
    if not transcripts:
        result = {"available": False,
                  "reason": "no session transcript for this project — the provider that ran it "
                            "keeps none, or it has been cleared"}
        if report is not None:
            report.chat = result
        return CheckStatus("chat", "skipped", result["reason"]), []

    start, end = run_window(ctx, WINDOW_PAD)
    entries, unparseable, source = [], 0, None
    for path in transcripts:
        found, bad = _entries(path, start, end)
        if found:
            entries, unparseable, source = found, bad, path
            break

    if not entries:
        result = {"available": False,
                  "reason": "a transcript exists but none of it falls inside this run's recorded "
                            "time window"}
        if report is not None:
            report.chat = result
        return CheckStatus("chat", "skipped", result["reason"]), []

    stats = analyze(entries)
    contradictions = _contradictions(ctx, report) if report is not None else []
    stalled = _stalled_steps(ctx)

    findings = []
    if stats["failures"]:
        findings.append(Finding(
            "chat", "warning",
            f"{plural(stats['failures'], 'tool call')} failed during this run",
            f"of {stats['tool_calls']} calls; {stats['retries']} repeated a command already run — "
            f"work that was tried and retried rather than work that was skipped",
            {"failures": stats["failures"], "tool_calls": stats["tool_calls"],
             "retries": stats["retries"]},
        ))
    for step in stalled:
        findings.append(Finding(
            "chat", "problem",
            f"`{step}` was started and never attempted again",
            "the transcript shows no further work on it inside the run window — this step "
            "stopped rather than failed",
            {"step": step},
        ))
    for c in contradictions:
        findings.append(Finding(
            "chat", "problem",
            "The run claimed something its own recomputation contradicts",
            f"claimed: {c['claim']} — recomputed: {c['recomputed']}",
            c,
        ))
    if stats["churn"]:
        worst = sorted(stats["churn"].items(), key=lambda kv: -kv[1])
        findings.append(Finding(
            "chat", "note",
            "Files rewritten repeatedly",
            ", ".join(f"{os.path.basename(f)} x{n}" for f, n in worst[:6]),
            {"churn": stats["churn"]},
        ))
    findings.append(Finding(
        "chat", "note",
        f"{stats['assistant_turns']} assistant turns, {stats['narration_chars']} characters of "
        f"narration",
        f"across {stats['tool_calls']} tool calls"
        + (f"; {unparseable} transcript line(s) could not be read" if unparseable else ""),
        stats,
    ))

    result = {"available": True, "transcript": str(source), **stats,
              "contradictions": contradictions, "stalled_steps": stalled}
    if report is not None:
        report.chat = result
    return CheckStatus("chat", "ran"), findings
