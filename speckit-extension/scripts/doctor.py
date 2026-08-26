#!/usr/bin/env python3
"""Report on a spec's run health — read-only, retroactive, never a gate.

Reads what is already on disk (`.spec-context.json`, the spec's documents, and
the self-trace when one exists) and recomputes the answers rather than trusting
anything a run claimed about itself. Every check reports whether it ran, so
"found nothing" and "could not look" never print the same way.

Read-only and best-effort in the strongest sense: it creates and modifies
nothing, it always exits 0, and a crash inside one check becomes that check's
skip reason while every other check still runs. Stdlib only.
"""

from __future__ import annotations

import argparse
import json
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from spec_context import _repo_root, read_ctx, resolve_feature_dir  # noqa: E402

CHECKS = ("record", "triage", "bleed", "drift", "completion", "template", "trace", "chat")

SEVERITIES = ("problem", "warning", "note")
_SEVERITY_RANK = {s: i for i, s in enumerate(SEVERITIES)}

_MARK = {"problem": "✗", "warning": "⚠", "note": "·"}


class Finding:
    """One item in the report: what is wrong, and the evidence behind it."""

    def __init__(self, check: str, severity: str, title: str, detail: str = "",
                 evidence: dict | None = None):
        if check not in CHECKS:
            raise ValueError(f"unknown check {check!r}")
        if severity not in SEVERITIES:
            raise ValueError(f"unknown severity {severity!r}")
        self.check = check
        self.severity = severity
        self.title = title
        self.detail = detail
        self.evidence = evidence or {}

    @property
    def rank(self) -> tuple:
        return (_SEVERITY_RANK[self.severity], CHECKS.index(self.check))

    def as_dict(self) -> dict:
        return {
            "check": self.check,
            "severity": self.severity,
            "title": self.title,
            "detail": self.detail,
            "evidence": self.evidence,
        }


class CheckStatus:
    """The honesty ledger — every check appears whether or not it ran.

    The summary is computed from this, never from the findings list, so a check
    that could not run can never be counted as clean.
    """

    def __init__(self, check: str, state: str, reason: str | None = None):
        if state not in ("ran", "skipped", "not-applicable"):
            raise ValueError(f"unknown state {state!r}")
        if state == "skipped" and not reason:
            raise ValueError("a skipped check must carry a reason")
        self.check = check
        self.state = state
        self.reason = reason if state == "skipped" else None
        self.findings = 0

    def as_dict(self) -> dict:
        return {
            "check": self.check,
            "state": self.state,
            "reason": self.reason,
            "findings": self.findings,
        }


class Report:
    """The accumulated ledger + findings for one spec."""

    def __init__(self, spec: str):
        self.spec = spec
        self.statuses: dict[str, CheckStatus] = {}
        self.findings: list[Finding] = []
        self.drift: list[dict] = []
        self.bleed: list[dict] = []
        self.completion: dict | None = None
        self.chat: dict | None = None

    def record(self, status: CheckStatus, findings: list | None = None) -> None:
        findings = findings or []
        status.findings = len(findings)
        self.statuses[status.check] = status
        self.findings.extend(findings)

    def ordered(self) -> list:
        return sorted(self.findings, key=lambda f: f.rank)

    def counts(self) -> dict:
        by_sev = {s: 0 for s in SEVERITIES}
        for f in self.findings:
            by_sev[f.severity] += 1
        states = [s.state for s in self.statuses.values()]
        return {
            **by_sev,
            "ran": states.count("ran"),
            "skipped": states.count("skipped"),
            "not_applicable": states.count("not-applicable"),
        }


def run_check(report: Report, check: str, fn) -> None:
    """Run one check, isolating its failure as that check's skip reason.

    A check that raises must never take the report down with it — the doctor's
    whole value is reporting what it *could* determine.
    """
    try:
        status, findings = fn()
    except Exception as exc:  # noqa: BLE001 — a broken check is a skip, not a crash
        detail = f"{type(exc).__name__}: {exc}".strip()
        if "--traceback" in sys.argv:
            traceback.print_exc()
        report.record(CheckStatus(check, "skipped", f"check raised — {detail}"))
        return
    report.record(status, findings)


def render_human(report: Report) -> str:
    out = [f"SpecKit Companion doctor — {report.spec}", ""]
    grouped: dict[str, list] = {c: [] for c in CHECKS}
    for f in report.ordered():
        grouped[f.check].append(f)

    for check in CHECKS:
        status = report.statuses.get(check)
        if status is None:
            out.append(f"  {check.upper():<11} not run")
            continue
        if status.state == "skipped":
            out.append(f"  {check.upper():<11} skipped — {status.reason}")
            continue
        if status.state == "not-applicable":
            out.append(f"  {check.upper():<11} not applicable")
            continue
        items = grouped[check]
        if not items:
            out.append(f"  {check.upper():<11} clean")
            continue
        counts = []
        for sev in SEVERITIES:
            n = sum(1 for f in items if f.severity == sev)
            if n:
                counts.append(f"{n} {sev}{'s' if n > 1 else ''}")
        out.append(f"  {check.upper():<11} {', '.join(counts)}")
        for f in items:
            out.append(f"    {_MARK[f.severity]} {f.title}")
            if f.detail:
                out.append(f"      {f.detail}")
        out.append("")

    c = report.counts()
    head = f"{c['problem']} problem{'s' if c['problem'] != 1 else ''}"
    if c["warning"]:
        head += f", {c['warning']} warning{'s' if c['warning'] != 1 else ''}"
    tail = [f"across {c['ran']} check{'s' if c['ran'] != 1 else ''}"]
    if c["skipped"]:
        tail.append(f"{c['skipped']} skipped")
    if c["not_applicable"]:
        tail.append(f"{c['not_applicable']} not applicable")
    not_run = len(CHECKS) - len(report.statuses)
    if not_run:
        tail.append(f"{not_run} not run")
    out.append(f"  {head} {'; '.join(tail)}.")
    return "\n".join(out)


def render_json(report: Report, generated_at: str) -> str:
    return json.dumps(
        {
            "spec": report.spec,
            "generated_at": generated_at,
            "checks": [report.statuses[c].as_dict() for c in CHECKS if c in report.statuses],
            "findings": [f.as_dict() for f in report.ordered()],
            "bleed": report.bleed,
            "drift": report.drift,
            "completion": report.completion,
            "chat": report.chat,
        },
        indent=2,
        ensure_ascii=False,
    )


def _via(module: str, func: str, *args):
    """Call `module.func(*args)`, importing on demand.

    Importing inside the call is deliberate: an import error becomes that check's
    skip reason through run_check, rather than taking the whole report down for a
    module that happens to be missing from a partial install.
    """
    import importlib

    return getattr(importlib.import_module(module), func)(*args)


def examine(feature_dir: Path, root: Path, chat: bool) -> Report:
    """Run every check against one spec directory and return its report."""
    rel = str(feature_dir.relative_to(root)) if feature_dir.is_relative_to(root) else str(feature_dir)
    report = Report(rel)
    ctx = read_ctx(feature_dir / ".spec-context.json")

    run_check(report, "record", lambda: _via("doctor_checks", "check_record", feature_dir, ctx))
    run_check(report, "triage", lambda: _via("doctor_checks", "check_triage", feature_dir, ctx))
    run_check(report, "bleed", lambda: _via("doctor_bleed", "check_bleed", root, feature_dir, ctx, report))
    run_check(report, "drift", lambda: _via("doctor_drift", "check_drift", root, feature_dir, ctx, report))
    run_check(report, "completion", lambda: _via("doctor_checks", "check_completion", feature_dir, ctx, report))
    run_check(report, "template", lambda: _via("doctor_checks", "check_template", feature_dir))
    run_check(report, "trace", lambda: _via("doctor_checks", "check_trace", feature_dir, ctx))
    if chat:
        run_check(report, "chat", lambda: _via("doctor_chat", "check_chat", root, feature_dir, ctx, report))
    return report


def _spec_dirs(root: Path) -> list:
    specs = root / "specs"
    if not specs.is_dir():
        return []
    return sorted(d for d in specs.iterdir() if d.is_dir() and (d / ".spec-context.json").is_file())


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Report on a spec's run health (read-only)")
    parser.add_argument("--feature-dir", default=None)
    parser.add_argument("--chat", action="store_true",
                        help="Also run the session-transcript deep audit.")
    parser.add_argument("--json", dest="as_json", action="store_true")
    parser.add_argument("--all", action="store_true",
                        help="Examine every spec directory under specs/.")
    parser.add_argument("--traceback", action="store_true",
                        help="Print a traceback for a check that raised (debugging the doctor).")
    args = parser.parse_args(argv)

    from spec_context import _now_iso

    root = _repo_root()
    if args.all:
        targets = _spec_dirs(root)
        if not targets:
            print("[doctor] No spec directories with a run record under specs/.", file=sys.stderr)
            return 0
    else:
        target = resolve_feature_dir(root, args.feature_dir)
        if target is None or not target.is_dir():
            print(
                "[doctor] Could not resolve the spec to examine (checked --feature-dir, "
                "SPECIFY_FEATURE_DIRECTORY, SPECIFY_FEATURE, .specify/feature.json, git "
                "branch prefix). Nothing examined.",
                file=sys.stderr,
            )
            return 0
        targets = [target]

    at = _now_iso()
    reports = [examine(d, root, args.chat) for d in targets]
    if args.as_json:
        if args.all:
            print(json.dumps(
                {"generated_at": at,
                 "specs": [json.loads(render_json(r, at)) for r in reports]},
                indent=2, ensure_ascii=False))
        else:
            print(render_json(reports[0], at))
    else:
        print("\n\n".join(render_human(r) for r in reports))
    return 0


if __name__ == "__main__":
    sys.exit(main())
