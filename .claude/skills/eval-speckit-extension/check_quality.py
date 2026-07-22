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
# Full lifecycle order — overlap handling must see clarify/analyze spans too,
# exactly like the viewer's STEP_NAMES.
STEP_NAMES = ["specify", "clarify", "plan", "tasks", "analyze", "implement"]
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
        t = dt.datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    # Naive timestamps read as UTC so mixed offset styles stay comparable.
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


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
        except (OSError, UnicodeDecodeError) as exc:
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


def _dedupe_consecutive(entries: list[dict]) -> list[dict]:
    """Viewer parity: collapse adjacent duplicates before lifecycle grouping."""
    out: list[dict] = []
    for e in entries:
        if out:
            p = out[-1]
            pf = p.get("from") if isinstance(p.get("from"), dict) else {}
            ef = e.get("from") if isinstance(e.get("from"), dict) else {}
            if (p.get("step") == e.get("step")
                    and p.get("substep") == e.get("substep")
                    and p.get("task") == e.get("task")
                    and p.get("kind") == e.get("kind")
                    and pf.get("step") == ef.get("step")
                    and pf.get("substep") == ef.get("substep")):
                continue
        out.append(e)
    return out


def _derive_trusted_spans(history: list[dict]) -> dict[str, float]:
    """Mirror of the viewer's duration-trust rule (`deriveStepHistory` in
    src/features/specs/stepHistoryDerivation.ts): a step's span is trusted only
    when the raw log carries exactly ONE extension-stamped step-level start,
    the lifecycle close boundary — the step's own extension complete OR the
    next step's extension start — lands strictly after it, no step-level
    complete precedes the start, no competing step-level start falls inside
    the span, and the span doesn't overlap another trusted span (overlap
    untrusts both sides). Returns step -> seconds for trusted spans only."""
    raw = [e for e in history if isinstance(e, dict)]
    deduped = _dedupe_consecutive(raw)

    order: list[str] = []
    groups: dict[object, list[int]] = {}
    for i, e in enumerate(deduped):
        step = e.get("step")
        if step not in groups:
            groups[step] = []
            order.append(step)
        groups[step].append(i)

    spans: dict[str, tuple[float, float]] = {}
    for step in order:
        idxs = groups[step]
        own = [deduped[i] for i in idxs]
        boundary = next((deduped[j] for j in range(idxs[-1] + 1, len(deduped))
                         if deduped[j].get("step") != step), None)
        last_step_level = next((e for e in reversed(own) if _is_step_level(e)), None)
        last_own_is_completion = (last_step_level is not None
                                  and last_step_level.get("kind") == "complete")

        close = None
        if boundary is not None:
            g_idx = STEP_NAMES.index(step) if step in STEP_NAMES else -1
            b_step = boundary.get("step")
            b_idx = STEP_NAMES.index(b_step) if b_step in STEP_NAMES else -1
            rolled_back = g_idx >= 0 and 0 <= b_idx < g_idx and _is_step_level(boundary)
            close = (last_step_level if last_own_is_completion else None) if rolled_back else boundary
        elif last_own_is_completion:
            close = last_step_level
        if close is None:
            continue

        raw_own = [e for e in raw if e.get("step") == step]
        explicit_starts = [e for e in raw_own
                           if _is_step_level(e) and e.get("kind") == "start"
                           and e.get("by") == TRUSTED_BOUNDARY_BY]
        if len(explicit_starts) != 1:
            continue
        close_is_own_completion = (close.get("step") == step and _is_step_level(close)
                                   and close.get("kind") == "complete"
                                   and close.get("by") == TRUSTED_BOUNDARY_BY)
        close_is_next_start = (close.get("step") != step and _is_step_level(close)
                               and close.get("kind") == "start"
                               and close.get("by") == TRUSTED_BOUNDARY_BY)
        if not (close_is_own_completion or close_is_next_start):
            continue
        s = _parse_at(explicit_starts[0].get("at"))
        c = _parse_at(close.get("at"))
        if s is None or c is None or c <= s:
            continue
        if any(_is_step_level(e) and e.get("kind") == "complete"
               and (t := _parse_at(e.get("at"))) is not None and t < s
               for e in raw_own):
            continue
        if any(e is not explicit_starts[0]
               and _is_step_level(e) and e.get("kind") == "start"
               and (t := _parse_at(e.get("at"))) is not None and s < t <= c
               for e in raw_own):
            continue
        spans[step] = (s.timestamp(), c.timestamp())

    trusted = dict(spans)
    prev: tuple[str, float] | None = None
    for step in STEP_NAMES:
        if step not in spans:
            continue
        start, end = spans[step]
        if prev is not None and start < prev[1]:
            trusted.pop(prev[0], None)
            trusted.pop(step, None)
            prev = None
        else:
            prev = (step, end)
    return {step: end - start for step, (start, end) in trusted.items()}


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
    except (json.JSONDecodeError, UnicodeDecodeError, OSError) as exc:
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

    # trusted-boundaries — each reached step needs extension-stamped boundaries (close = own complete or next step's start).
    reached = [s for s in PIPELINE_STEPS if any(e.get("step") == s for e in history)]
    all_spans = _derive_trusted_spans(history)
    spans = {s: all_spans[s] for s in reached if s in all_spans}
    untrusted = [s for s in reached if s not in spans]
    if not reached:
        r.add("WARN", "trusted-boundaries", "no pipeline steps in history")
    elif untrusted:
        r.add("WARN", "trusted-boundaries",
              f"{len(spans)}/{len(reached)} reached steps trusted — "
              f"untrusted span(s): {', '.join(untrusted)}")
    else:
        r.add("PASS", "trusted-boundaries",
              f"{len(spans)}/{len(reached)} reached steps carry ordered "
              "extension-stamped boundaries (closed by own complete or next step's start)")

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
        except (OSError, UnicodeDecodeError) as exc:
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
        except (OSError, UnicodeDecodeError) as exc:
            r.add("FAIL", cid, f"roster file unreadable: {exc}")
            continue
        hits = _prompt_hits(text)
        if hits:
            r.add("PASS", cid, f"{len(hits)} ask instruction(s) present")
        else:
            r.add("FAIL", cid, "clarify-type command never asks the user")


def check_living_specs_accountability(r: Report, spec_dir: Path) -> None:
    """A completed spec that loaded living-spec capabilities must account for each
    one — a folded delta (synced) or an explicit skip note. A loaded capability
    that is neither is the 'silently nothing' hole this closes: WARN, never fail."""
    target = spec_dir / ".spec-context.json"
    try:
        ctx = json.loads(target.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError, OSError):
        return  # timing check already reports an unreadable context
    if not isinstance(ctx, dict):
        return
    status = ctx.get("status")
    if status not in ("completed", "archived"):
        return  # accountability is a completion-time property
    block = ctx.get("livingSpecs") if isinstance(ctx.get("livingSpecs"), dict) else {}
    loaded = [c for c in (block.get("loaded") or []) if isinstance(c, str) and c.strip()]
    if not loaded:
        return  # nothing was loaded — nothing to account for
    synced = {c for c in (block.get("synced") or []) if isinstance(c, str)}
    skipped = {
        str(e.get("name", "")).strip()
        for e in (block.get("skipped") or [])
        if isinstance(e, dict) and str(e.get("name", "")).strip()
    }
    unaccounted = [c for c in loaded if c not in synced and c not in skipped]
    if unaccounted:
        r.add("WARN", "living-specs-accountability",
              f"{len(unaccounted)}/{len(loaded)} loaded capabilit"
              f"{'y' if len(unaccounted) == 1 else 'ies'} neither folded nor "
              f"skipped: {', '.join(unaccounted)} — author a delta or record a skip")
    else:
        r.add("PASS", "living-specs-accountability",
              f"all {len(loaded)} loaded capabilit"
              f"{'y is' if len(loaded) == 1 else 'ies are'} accounted for "
              f"({len(synced)} folded, {len(skipped)} skipped)")


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
        check_living_specs_accountability(r, spec_dir)
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
