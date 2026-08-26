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

import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from doctor import CheckStatus, Finding  # noqa: E402
from spec_context import _entry_kind, _is_per_task, _is_step_level, canonical_log  # noqa: E402

TASK_MARKER = re.compile(r"^\s*[-*]\s*\[[ xX]\]\s*(?:\*\*)?(T\d+)", re.MULTILINE)
FENCE = re.compile(r"^```([A-Za-z0-9_+-]*)\s*$", re.MULTILINE)
FILE_TREE = re.compile(r"^\s*[\w./-]+\.(?:py|ts|tsx|js|jsx|mjs|md|yml|yaml|json)\s{2,}\w", re.MULTILINE)

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


def _git(root, args: list) -> tuple:
    try:
        p = subprocess.run(["git", "-C", str(root), *args],
                           capture_output=True, text=True, timeout=30)
        return p.returncode, p.stdout
    except (OSError, subprocess.SubprocessError):
        return 1, ""


def _parse(at):
    if not isinstance(at, str) or not at:
        return None
    try:
        return datetime.fromisoformat(at.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def _read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


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
    for e in canonical_log(ctx):
        if not isinstance(e, dict) or not _is_step_level(e):
            continue
        step, at = e.get("step"), _parse(e.get("at"))
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

    spec = _read(feature_dir / "spec.md")
    plan = _read(feature_dir / "plan.md")
    tasks = _read(feature_dir / "tasks.md")

    if spec:
        ids = TASK_MARKER.findall(spec)
        if ids:
            # A fast-tracked change keeps its approach inline, but never its task list.
            signals.append({
                "step": "specify", "did": "tasks",
                "what": f"{len(ids)} task checkbox(es) in spec.md",
                "where": "spec.md", "evidence": sorted(set(ids))[:10],
            })
        if not fast_path:
            code = [(lang, n) for lang, n in _code_blocks(spec)
                    if lang in CODE_LANGS and n >= CODE_BLOCK_LINES]
            if code:
                signals.append({
                    "step": "specify", "did": "implement",
                    "what": f"{len(code)} implementation code block(s) in spec.md",
                    "where": "spec.md", "evidence": [f"{lang} x{n} lines" for lang, n in code[:5]],
                })
            if re.search(r"^##+\s*(Approach|Project Structure|Architecture|Design)\b", spec, re.MULTILINE):
                signals.append({
                    "step": "specify", "did": "plan",
                    "what": "a plan-shaped section in spec.md (approach, structure, or design)",
                    "where": "spec.md", "evidence": [],
                })

    if plan:
        ids = TASK_MARKER.findall(plan)
        if ids and not fast_path:
            signals.append({
                "step": "plan", "did": "tasks",
                "what": f"{len(ids)} task checkbox(es) in plan.md",
                "where": "plan.md", "evidence": sorted(set(ids))[:10],
            })
        code = [(lang, n) for lang, n in _code_blocks(plan)
                if lang in CODE_LANGS and n >= CODE_BLOCK_LINES]
        if code:
            signals.append({
                "step": "plan", "did": "implement",
                "what": f"{len(code)} implementation code block(s) in plan.md",
                "where": "plan.md", "evidence": [f"{lang} x{n} lines" for lang, n in code[:5]],
            })

    if tasks:
        code = [(lang, n) for lang, n in _code_blocks(tasks)
                if lang in CODE_LANGS and n >= CODE_BLOCK_LINES]
        if code:
            signals.append({
                "step": "tasks", "did": "implement",
                "what": f"{len(code)} implementation code block(s) in tasks.md",
                "where": "tasks.md", "evidence": [f"{lang} x{n} lines" for lang, n in code[:5]],
            })

    return signals


def _duplication_signals(feature_dir: Path) -> list:
    """Task identifiers living in more than one document — two copies that will diverge."""
    where: dict = {}
    for name in ("spec.md", "plan.md", "tasks.md"):
        for tid in set(TASK_MARKER.findall(_read(feature_dir / name))):
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
        code, log = _git(root, [
            "log", "--format=%H%x1f%s", "--name-only", "--no-merges",
            f"--since={start.isoformat()}", f"--until={end.isoformat()}",
        ])
        if code != 0 or not log.strip():
            continue
        commits = []
        sha = subject = None
        touched: list = []
        for line in log.splitlines():
            if "\x1f" in line:
                if sha and touched:
                    commits.append((sha[:8], subject, [f for f in touched if _is_source(f)]))
                sha, subject = line.split("\x1f", 1)
                touched = []
            elif line.strip():
                touched.append(line.strip())
        if sha and touched:
            commits.append((sha[:8], subject, [f for f in touched if _is_source(f)]))
        hits = [(s, subj, files) for s, subj, files in commits if files]
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
