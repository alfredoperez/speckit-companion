#!/usr/bin/env python3
"""Step bleed — where one pipeline step did the next step's work.

The value of a staged pipeline comes from each step stopping where it stops. In
practice a step bleeds: specify starts naming files and dependencies, plan starts
writing a task checklist, tasks starts writing the implementation. Nothing looks
wrong at the time, because each artifact is plausible on its own. The cost lands
later as duplicated work, a step that took three times as long as it should have,
and two artifacts that now disagree with each other.

Every signal here is read from artifacts already on disk plus git, so this works
retroactively like the rest of the doctor. Bleed is reported, never blocked — a
run that bleeds still produces working software; the point is to make the cost
visible. Stdlib only.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from doctor import (  # noqa: E402
    CheckStatus,
    Finding,
    log_entries,
    parse_commit_log,
    parse_time,
    read_text,
    run_git,
)
from spec_context import _entry_kind, _is_step_level  # noqa: E402
from task_sync import parse_task_markers  # noqa: E402

#: A fenced block longer than this in a task list is implementation, not a task
#: description. Short snippets (a command to run, a one-line signature) are fine.
CODE_BLOCK_LINES = 12

#: Fence languages that mean executable source rather than an illustrative shape.
CODE_LANGS = {"py", "python", "ts", "typescript", "js", "javascript", "tsx", "jsx",
              "go", "rs", "java", "rb", "c", "cpp", "sh", "bash", "zsh"}

#: Paths that are pipeline bookkeeping rather than product source.
NON_SOURCE_PREFIXES = ("specs/", "capabilities/", ".specify/", ".claude/", "docs/")
NON_SOURCE_SUFFIXES = (".md", ".json", ".yml", ".yaml", ".lock", ".txt")

STEP_ORDER_PRE_IMPLEMENT = ("specify", "plan", "tasks")


def _task_ids(path: Path) -> list:
    """Task ids declared in a document, through the runtime's single counter.

    A second checkbox regex is how the two counters drift apart, so this goes
    through `task_sync` rather than matching markers here.
    """
    if not path.is_file():
        return []
    all_ids, _done = parse_task_markers(path)
    return all_ids


def _code_blocks(text: str) -> list:
    """(language, line_count) for each fenced block."""
    out, lang, start = [], None, None
    for i, line in enumerate(text.splitlines()):
        m = re.match(r"^```([A-Za-z0-9_+-]*)\s*$", line)
        if not m:
            continue
        if start is None:
            lang, start = (m.group(1) or "").lower(), i
        else:
            out.append((lang, i - start - 1))
            lang, start = None, None
    return out


def _implementation_blocks(text: str) -> list:
    """Fenced blocks long enough, in a source language, to be implementation."""
    return [(lang, n) for lang, n in _code_blocks(text)
            if lang in CODE_LANGS and n >= CODE_BLOCK_LINES]


def _code_signals(step: str, doc: str, text: str) -> list:
    """The `did implement` signal for one document — one entry, or none at all."""
    code = _implementation_blocks(text)
    if not code:
        return []
    return [{
        "step": step, "did": "implement",
        "what": f"{len(code)} implementation code block(s) in {doc}",
        "where": doc, "evidence": [f"{lang} x{n} lines" for lang, n in code[:5]],
    }]


def _is_source(path: str) -> bool:
    p = path.strip()
    if not p or p.startswith(NON_SOURCE_PREFIXES):
        return False
    return not p.endswith(NON_SOURCE_SUFFIXES)


def _step_windows(ctx: dict) -> dict:
    """{step: (start, end)} from the recorded boundaries, ordered by the record.

    Computed from the boundaries themselves rather than assumed sequential, so a
    re-run or an out-of-order step does not shift another step's window.
    """
    starts, ends = {}, {}
    for e in log_entries(ctx):
        if not _is_step_level(e):
            continue
        step, at = e.get("step"), parse_time(e.get("at"))
        if not isinstance(step, str) or at is None:
            continue
        if _entry_kind(e) == "start":
            starts.setdefault(step, at)
        else:
            ends[step] = at
    return {s: (starts[s], ends[s]) for s in starts if s in ends and ends[s] >= starts[s]}


def _artifact_signals(feature_dir: Path, ctx: dict) -> list:
    """What each document contains that belongs to a later step."""
    size = (ctx.get("size") or "normal").lower()
    fast_path = size == "simple"
    signals = []

    spec = read_text(feature_dir / "spec.md")
    plan = read_text(feature_dir / "plan.md")
    tasks = read_text(feature_dir / "tasks.md")

    if spec:
        ids = _task_ids(feature_dir / "spec.md")
        if ids:
            # A fast-tracked change keeps its approach inline, but never its task list.
            signals.append({
                "step": "specify", "did": "tasks",
                "what": f"{len(ids)} task checkbox(es) in spec.md",
                "where": "spec.md", "evidence": sorted(set(ids))[:10],
            })
        if not fast_path:
            signals += _code_signals("specify", "spec.md", spec)
            if re.search(r"^##+\s*(Approach|Project Structure|Architecture|Design)\b", spec, re.MULTILINE):
                signals.append({
                    "step": "specify", "did": "plan",
                    "what": "a plan-shaped section in spec.md (approach, structure, or design)",
                    "where": "spec.md", "evidence": [],
                })

    if plan:
        ids = _task_ids(feature_dir / "plan.md")
        if ids and not fast_path:
            signals.append({
                "step": "plan", "did": "tasks",
                "what": f"{len(ids)} task checkbox(es) in plan.md",
                "where": "plan.md", "evidence": sorted(set(ids))[:10],
            })
        signals += _code_signals("plan", "plan.md", plan)

    if tasks:
        signals += _code_signals("tasks", "tasks.md", tasks)

    return signals


def _duplication_signals(feature_dir: Path) -> list:
    """Task identifiers living in more than one document — two copies that will diverge."""
    where: dict = {}
    for name in ("spec.md", "plan.md", "tasks.md"):
        for tid in set(_task_ids(feature_dir / name)):
            where.setdefault(tid, []).append(name)
    dupes = {tid: docs for tid, docs in where.items() if len(docs) > 1}
    if not dupes:
        return []
    docs = sorted({d for ds in dupes.values() for d in ds})
    return [{
        "step": "tasks", "did": "tasks",
        "what": f"{len(dupes)} task id(s) appear in more than one document",
        "where": " and ".join(docs),
        "evidence": sorted(dupes)[:10],
    }]


def _early_source_signals(root, ctx: dict) -> list:
    """Source files committed while the run was still before implement."""
    windows = _step_windows(ctx)
    out = []
    for step in STEP_ORDER_PRE_IMPLEMENT:
        if step not in windows:
            continue
        start, end = windows[step]
        code, log = run_git(root, [
            "log", "--format=%H%x1f%s", "--name-only", "--no-merges",
            f"--since={start.isoformat()}", f"--until={end.isoformat()}",
        ])
        if code != 0 or not log.strip():
            continue
        hits = []
        for commit in parse_commit_log(log):
            sources = [f for f in commit["files"] if _is_source(f)]
            if sources:
                hits.append((commit["sha"], commit["subject"], sources))
        if hits:
            files = sorted({f for _s, _subj, fs in hits for f in fs})
            out.append({
                "step": step, "did": "implement",
                "what": f"{len(files)} source file(s) committed during the {step} step",
                "where": ", ".join(f"{s} {subj}" for s, subj, _f in hits[:3]),
                "evidence": files[:10],
            })
    return out


def _time_share(ctx: dict) -> dict | None:
    """A pre-implement step that consumed more of the run than implement itself."""
    windows = _step_windows(ctx)
    if "implement" not in windows:
        return None
    durations = {s: (e - b).total_seconds() for s, (b, e) in windows.items()}
    total = sum(durations.values())
    if total <= 0:
        return None
    impl = durations["implement"]
    worse = {s: d for s, d in durations.items()
             if s in STEP_ORDER_PRE_IMPLEMENT and d > impl}
    if not worse:
        return None
    step, dur = max(worse.items(), key=lambda kv: kv[1])
    return {
        "step": step, "share": dur / total, "seconds": dur,
        "implement_seconds": impl, "implement_share": impl / total,
    }


def check_bleed(root, feature_dir: Path, ctx: dict, report=None) -> tuple:
    """Report where one step did another step's work."""
    feature_dir = Path(feature_dir)
    if not any((feature_dir / n).is_file() for n in ("spec.md", "plan.md", "tasks.md")):
        return CheckStatus("bleed", "not-applicable"), []

    signals = _artifact_signals(feature_dir, ctx)
    signals += _duplication_signals(feature_dir)
    signals += _early_source_signals(root, ctx)

    findings = []
    for s in signals:
        detail = s["what"]
        if s["evidence"]:
            detail += " — " + ", ".join(str(x) for x in s["evidence"])
        if s["where"] and s["where"] not in ("spec.md", "plan.md", "tasks.md"):
            detail += f" ({s['where']})"
        title = (f"`{s['step']}` did `{s['did']}` work" if s["step"] != s["did"]
                 else "The same task list lives in two documents")
        findings.append(Finding("bleed", "warning", title, detail, s))

    share = _time_share(ctx)
    if share:
        findings.append(Finding(
            "bleed", "note",
            f"`{share['step']}` took longer than `implement`",
            f"{share['step']} {share['seconds']:.0f}s ({share['share']:.0%} of the run) versus "
            f"implement {share['implement_seconds']:.0f}s ({share['implement_share']:.0%}) — a "
            f"hard planning phase can be a legitimate reason, so read this alongside the "
            f"evidence above rather than on its own",
            share,
        ))

    if report is not None:
        report.bleed = signals
    return CheckStatus("bleed", "ran"), findings
