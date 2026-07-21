#!/usr/bin/env python3
"""Command-quality eval for the Companion pipeline.

Scores what `check_capture.py` deliberately does not: did the commands write
too much (artifact budgets), waste time (untrusted spans, bursts, outliers),
or prompt wrongly (static text checks on the command-body sources)? Stdlib
only; read-only; WARN is the judgment-call tier and never affects exit codes.

Usage:
    python3 check_quality.py --feature-dir specs/<NNN>-<slug>
    python3 check_quality.py --commands-dir speckit-extension/commands
    python3 check_quality.py --feature-dir specs/<NNN>-<slug> --commands-dir speckit-extension/commands --json --strict
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import statistics
import sys
from pathlib import Path

PIPELINE_STEPS = ["specify", "plan", "tasks", "implement"]
# Same trust rule as the viewer's deriveStepHistory: only extension-stamped
# boundaries anchor a span; cli/user/derive writes are honest but not span-grade.
TRUSTED_BOUNDARY_BY = "extension"

# Verbosity budgets — the single home of every threshold.
# artifact -> (warn_lines, fail_lines, warn_chars, fail_chars); calibrated on
# recent healthy completed specs (spec 93-145L, plan 45-60L, tasks 70-101L).
BUDGETS = {
    "spec.md": (250, 450, 30_000, 60_000),
    "plan.md": (150, 300, 15_000, 30_000),
    "tasks.md": (250, 450, 20_000, 40_000),
}

# Timing-waste thresholds.
BURST_WINDOW_SECONDS = 1.0
BURST_MIN_FINISHES = 3
OUTLIER_FACTOR = 8
OUTLIER_FLOOR_SECONDS = 300

# Prompting rosters — enumerated on purpose: never-prompt is per-command
# semantics, not a namespace property. A missing roster file FAILs loudly.
NEVER_PROMPT = [
    "speckit.companion.after-specify.md",
    "speckit.companion.after-plan.md",
    "speckit.companion.after-tasks.md",
    "speckit.companion.after-implement.md",
    "speckit.companion.living-drift.md",
    "speckit.companion.living-sync.md",
    "speckit.companion.living-coverage.md",
    "speckit.companion.mark-complete.md",
    "speckit.companion.status.md",
    "speckit.companion.resume.md",
    "speckit.companion.classify.md",
]
# The clarify carrier lives in the preset dir next to --commands-dir.
MUST_ASK_RELATIVE = Path("presets") / "companion-standard" / "commands"
MUST_ASK = ["speckit.clarify.md"]

# Word-bounded phrases only — a bare "ask" would match "tasks"; the article is
# optional so "ask user" reads the same as "ask the user".
PROMPT_PATTERNS = [re.compile(p, re.IGNORECASE) for p in (
    r"\bask(?:s|ing)? (?:the )?user\b",
    r"\bprompt(?:s|ing)? (?:the )?user\b",
    r"\bwait(?:s|ing)? for (?:the )?user\b",
    r"\bconfirm with (?:the )?user\b",
    r"\bask(?:s|ing)? (?:the )?developer\b",
    r"\bpresent exactly one question\b",
    r"\bask(?:s|ing)? up to \d+[^.\n]*question",
    r"\bone question at a time\b",
    r"\bwait(?:s|ing)? for (?:an? |the )?(?:answer|approval|confirmation)\b",
)]
NEGATION_WINDOW_CHARS = 40
# Explicit negation forms only — a bare "not"/"no" would excuse real
# violations like "If not possible, ask the user".
NEGATION_RE = re.compile(
    r"\b(?:do(?:es)? not|don'?t|never|without|rather than|instead of|skip)\b",
    re.IGNORECASE,
)


def _parse_at(s: object) -> dt.datetime | None:
    try:
        return dt.datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


class Report:
    def __init__(self) -> None:
        self.rows: list[tuple[str, str, str]] = []  # (status, id, detail)

    def add(self, status: str, cid: str, detail: str) -> None:
        self.rows.append((status, cid, detail))

    @property
    def failed(self) -> int:
        return sum(1 for s, _, _ in self.rows if s == "FAIL")

    @property
    def warned(self) -> int:
        return sum(1 for s, _, _ in self.rows if s == "WARN")

    def to_text(self) -> str:
        marks = {"PASS": "✓", "WARN": "!", "FAIL": "✗", "INFO": "·"}
        out = [f"  {marks[s]} [{s}] {c}: {d}" for s, c, d in self.rows]
        passes = sum(1 for s, _, _ in self.rows if s == "PASS")
        out.append("")
        out.append(f"  → {passes} pass / {self.warned} warn / {self.failed} fail / "
                   f"{sum(1 for s, _, _ in self.rows if s == 'INFO')} info")
        return "\n".join(out)

    def to_dict(self) -> dict:
        return {
            "checks": [{"status": s, "id": c, "detail": d} for s, c, d in self.rows],
            "failed": self.failed,
            "warned": self.warned,
        }


def check_verbosity(r: Report, spec_dir: Path) -> None:
    """Only oversize is this eval's defect: a missing or tiny artifact (e.g. a
    fast-path pointer plan.md) is capture/completeness territory, not verbosity."""
    for name, (warn_l, fail_l, warn_c, fail_c) in BUDGETS.items():
        path = spec_dir / name
        cid = f"verbosity-{name.removesuffix('.md')}"
        try:
            text = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            r.add("INFO", cid, "absent (not scored)")
            continue
        except OSError as exc:
            r.add("FAIL", cid, f"unreadable: {exc}")
            continue
        lines, chars = len(text.splitlines()), len(text)
        measured = f"{lines} lines / {chars} chars"
        if lines >= fail_l or chars >= fail_c:
            r.add("FAIL", cid,
                  f"{measured} — ballooned past the regression band "
                  f"(FAIL ≥ {fail_l} lines / {fail_c} chars)")
        elif lines >= warn_l or chars >= warn_c:
            r.add("WARN", cid,
                  f"{measured} — above the healthy band "
                  f"(WARN ≥ {warn_l} lines / {warn_c} chars)")
        else:
            r.add("PASS", cid,
                  f"{measured} (budget: warn {warn_l}L/{warn_c}c, fail {fail_l}L/{fail_c}c)")


def _is_step_level(e: dict) -> bool:
    return e.get("substep") is None and e.get("task") is None


def _trusted_span(history: list, step: str) -> float | None:
    """start→complete seconds when the step carries an ordered pair of
    extension-stamped step-level boundaries; None means the span is untrusted."""
    starts = [e for e in history
              if e.get("step") == step and _is_step_level(e)
              and e.get("kind") == "start" and e.get("by") == TRUSTED_BOUNDARY_BY]
    completes = [e for e in history
                 if e.get("step") == step and _is_step_level(e)
                 and e.get("kind") == "complete" and e.get("by") == TRUSTED_BOUNDARY_BY]
    if not starts or not completes:
        return None
    s, c = _parse_at(starts[0].get("at")), _parse_at(completes[-1].get("at"))
    if s is None or c is None or c < s:
        return None
    return (c - s).total_seconds()


def _fmt(seconds: float) -> str:
    if seconds < 1:
        return f"{int(seconds * 1000)}ms"
    if seconds < 90:
        return f"{seconds:.1f}s"
    return f"{seconds / 60:.1f}m"


def check_timing(r: Report, spec_dir: Path) -> None:
    target = spec_dir / ".spec-context.json"
    try:
        ctx = json.loads(target.read_text(encoding="utf-8"))
    except FileNotFoundError:
        r.add("WARN", "timing-not-examinable", f"no .spec-context.json in {spec_dir}")
        return
    except (json.JSONDecodeError, OSError) as exc:
        r.add("WARN", "timing-not-examinable", f"could not parse .spec-context.json: {exc}")
        return
    if not isinstance(ctx, dict):
        r.add("WARN", "timing-not-examinable", ".spec-context.json is not an object")
        return
    history = ctx.get("history")
    if not isinstance(history, list) or not history:
        r.add("WARN", "timing-not-examinable", "history[] missing or empty")
        return
    history = [e for e in history if isinstance(e, dict)]

    # trusted-boundaries — each reached step needs an ordered deterministic pair.
    reached = [s for s in PIPELINE_STEPS if any(e.get("step") == s for e in history)]
    spans: dict[str, float] = {}
    untrusted: list[str] = []
    for step in reached:
        span = _trusted_span(history, step)
        if span is None:
            untrusted.append(step)
        else:
            spans[step] = span
    if not reached:
        r.add("WARN", "trusted-boundaries", "no pipeline steps in history")
    elif untrusted:
        r.add("WARN", "trusted-boundaries",
              f"{len(spans)}/{len(reached)} reached steps trusted — "
              f"untrusted span(s): {', '.join(untrusted)}")
    else:
        r.add("PASS", "trusted-boundaries",
              f"{len(spans)}/{len(reached)} reached steps carry ordered "
              "extension-stamped start→complete boundaries")

    # burst-journaling — ai task finishes dumped in one instant instead of live.
    ai_finishes = sorted(
        t for t in (_parse_at(e.get("at")) for e in history
                    if isinstance(e.get("task"), str) and e.get("by") == "ai"
                    and e.get("kind") == "complete")
        if t is not None)
    if len(ai_finishes) < BURST_MIN_FINISHES:
        r.add("INFO", "burst-journaling",
              f"{len(ai_finishes)} ai task finishes — sample too small to judge")
    else:
        span = (ai_finishes[-1] - ai_finishes[0]).total_seconds()
        if span <= BURST_WINDOW_SECONDS:
            r.add("FAIL", "burst-journaling",
                  f"{len(ai_finishes)} ai task finishes within {_fmt(span)} — "
                  "one end-of-step dump, not live per-task journaling")
        else:
            r.add("PASS", "burst-journaling",
                  f"{len(ai_finishes)} ai task finishes span {_fmt(span)}")

    # step-duration-outlier — relative judgment, WARN only (wall-clock varies).
    if len(spans) >= 2:
        outliers = []
        for step, span in spans.items():
            others = [v for k, v in spans.items() if k != step]
            med = statistics.median(others)
            if span > OUTLIER_FACTOR * med and span > OUTLIER_FLOOR_SECONDS:
                outliers.append(f"{step} {_fmt(span)} vs median {_fmt(med)}")
        if outliers:
            r.add("WARN", "step-duration-outlier",
                  f"out-of-band step duration: {'; '.join(outliers)} "
                  f"(> {OUTLIER_FACTOR}× median and > {_fmt(OUTLIER_FLOOR_SECONDS)})")
        else:
            r.add("PASS", "step-duration-outlier",
                  "trusted step durations are in band: "
                  + ", ".join(f"{k} {_fmt(v)}" for k, v in spans.items()))
    else:
        r.add("INFO", "step-duration-outlier",
              f"{len(spans)} trusted span(s) — need ≥ 2 to compare")


def _prompt_hits(text: str) -> list[str]:
    """Lines carrying a non-negated user-prompt instruction. Fenced code blocks
    are skipped (templates inside fences aren't instructions to the agent), and
    a negation within the window before the match suppresses it."""
    hits: list[str] = []
    in_fence = False
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for pat in PROMPT_PATTERNS:
            m = pat.search(line)
            if not m:
                continue
            window = line[max(0, m.start() - NEGATION_WINDOW_CHARS):m.start()]
            if NEGATION_RE.search(window):
                continue
            hits.append(line.strip())
            break
    return hits


def check_prompting(r: Report, commands_dir: Path) -> None:
    if not commands_dir.is_dir():
        r.add("FAIL", "commands-dir", f"not a directory: {commands_dir}")
        return
    for name in NEVER_PROMPT:
        short = name.removeprefix("speckit.companion.").removesuffix(".md")
        cid = f"never-prompts-{short}"
        path = commands_dir / name
        try:
            text = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            r.add("FAIL", cid, f"roster file missing: {path} (scan surface shrank)")
            continue
        except OSError as exc:
            r.add("FAIL", cid, f"roster file unreadable: {exc}")
            continue
        hits = _prompt_hits(text)
        if hits:
            r.add("FAIL", cid,
                  f"never-halts command instructs prompting: \"{hits[0]}\""
                  + (f" (+{len(hits) - 1} more)" if len(hits) > 1 else ""))
        else:
            r.add("PASS", cid, "no user-prompt instruction")
    ask_dir = commands_dir.parent / MUST_ASK_RELATIVE
    for name in MUST_ASK:
        cid = f"must-ask-{name.removeprefix('speckit.').removesuffix('.md')}"
        path = ask_dir / name
        try:
            text = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            r.add("FAIL", cid, f"roster file missing: {path} (scan surface shrank)")
            continue
        except OSError as exc:
            r.add("FAIL", cid, f"roster file unreadable: {exc}")
            continue
        hits = _prompt_hits(text)
        if hits:
            r.add("PASS", cid, f"{len(hits)} ask instruction(s) present")
        else:
            r.add("FAIL", cid, "clarify-type command never asks the user")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--feature-dir", help="spec dir to score (verbosity + timing)")
    ap.add_argument("--commands-dir",
                    help="command-body sources dir (prompting); the clarify "
                         "carrier resolves as a sibling under presets/")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--strict", action="store_true",
                    help="exit 1 on any FAIL; WARN never affects the exit code")
    args = ap.parse_args(argv)

    if not args.feature_dir and not args.commands_dir:
        ap.error("pass --feature-dir and/or --commands-dir")

    r = Report()
    if args.feature_dir:
        spec_dir = Path(args.feature_dir)
        check_verbosity(r, spec_dir)
        check_timing(r, spec_dir)
    if args.commands_dir:
        check_prompting(r, Path(args.commands_dir))

    if args.json:
        print(json.dumps(r.to_dict(), indent=2))
    else:
        target = " + ".join(x for x in (args.feature_dir, args.commands_dir) if x)
        print(f"\nCommand-quality eval — {target}\n")
        print(r.to_text())
    return 1 if (args.strict and r.failed) else 0


if __name__ == "__main__":
    sys.exit(main())
