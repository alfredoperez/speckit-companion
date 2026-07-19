#!/usr/bin/env python3
"""Deterministic eval for the Living Specs fold-back (LS·3).

Given a feature spec (carrying `## ADDED / MODIFIED / REMOVED / RENAMED
Requirements` delta blocks), the living spec BEFORE the fold, and the living spec
AFTER the fold, assert the archive-as-merge contract and print a PASS/FAIL report.
Sibling of check_capture.py (same Report / --json shape). Stdlib only.

Asserts:
  - added-folded:   every ADDED requirement heading is present in the after-spec.
  - removed-gone:   every REMOVED requirement heading is absent from the after-spec.
  - modified-changed: every MODIFIED requirement's body differs before→after.
  - renamed-applied: every RENAMED old heading is gone and the new heading present.
  - count-delta:    the requirement-count change equals added − removed.
  - idempotent:     re-applying the deltas to the after-spec is a byte no-op.

Usage:
    check_living_spec.py --feature-spec specs/<NNN>/spec.md \\
        --before before.md --after after.md
    add --json for the machine-readable object; --strict to exit 1 on any FAIL.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parents[3] / "speckit-extension" / "scripts"


def _load_write_context():
    spec = importlib.util.spec_from_file_location(
        "write_context", _SCRIPTS / "write-context.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_REQ_HEADING_RE = re.compile(r"^###\s+(.+?)\s*$", re.MULTILINE)


def _headings(text: str) -> list[str]:
    return [m.strip() for m in _REQ_HEADING_RE.findall(text)]


class Report:
    def __init__(self) -> None:
        self.rows: list[tuple[str, str, str]] = []

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


def run_checks(feature_spec: str, before: str, after: str) -> Report:
    wc = _load_write_context()
    deltas = wc.parse_spec_deltas(feature_spec)
    r = Report()

    before_list = _headings(before)
    before_heads = set(before_list)
    after_heads = _headings(after)
    after_set = set(after_heads)

    # added-folded
    added_heads = [h for h, _ in deltas["added"]]
    missing_added = [h for h in added_heads if h not in after_set]
    r.add(
        not missing_added,
        "added-folded",
        f"{len(added_heads)} ADDED present"
        + (f"; missing {missing_added}" if missing_added else ""),
    )

    # removed-gone
    removed_heads = [h for h, _ in deltas["removed"]]
    still_present = [h for h in removed_heads if h in after_set]
    r.add(
        not still_present,
        "removed-gone",
        f"{len(removed_heads)} REMOVED gone"
        + (f"; still present {still_present}" if still_present else ""),
    )

    # modified-changed
    mod_problems = []
    for head, section in deltas["modified"]:
        if head not in after_set:
            mod_problems.append(f"{head} missing")
            continue
        b_span = wc._living_requirement_span(before.splitlines(), head)
        a_span = wc._living_requirement_span(after.splitlines(), head)
        b_body = "\n".join(before.splitlines()[b_span[0]:b_span[1]]) if b_span else ""
        a_body = "\n".join(after.splitlines()[a_span[0]:a_span[1]]) if a_span else ""
        if b_span and a_body == b_body:
            mod_problems.append(f"{head} unchanged")
    r.add(
        not mod_problems,
        "modified-changed",
        f"{len(deltas['modified'])} MODIFIED applied"
        + (f"; issues {mod_problems}" if mod_problems else ""),
    )

    # renamed-applied
    rename_problems = []
    for old_h, new_h in deltas["renamed"]:
        if old_h in after_set:
            rename_problems.append(f"{old_h} still present")
        if new_h not in after_set:
            rename_problems.append(f"{new_h} missing")
    r.add(
        not rename_problems,
        "renamed-applied",
        f"{len(deltas['renamed'])} RENAMED applied"
        + (f"; issues {rename_problems}" if rename_problems else ""),
    )

    # count-delta — expected change = added − removed (renames/mods are count-neutral).
    # Count headings positionally on both sides (a duplicate heading must count twice
    # on each side too) so the delta isn't skewed by collapsing one side to a set.
    expected = len(added_heads) - len(removed_heads)
    actual = len(after_heads) - len(before_list)
    r.add(
        expected == actual,
        "count-delta",
        f"{len(before_list)} → {len(after_heads)} (Δ {actual:+d}, expected {expected:+d})",
    )

    # idempotent — re-folding the deltas onto the after-spec changes nothing.
    refold, _ = wc.apply_deltas(after, deltas)
    r.add(
        refold == after,
        "idempotent",
        "re-applying deltas to the after-spec is a byte no-op"
        if refold == after else "re-fold mutated the after-spec",
    )

    return r


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Assert the Living Specs fold-back (LS·3).")
    ap.add_argument("--feature-spec", required=True, help="feature spec.md carrying the deltas")
    ap.add_argument("--before", required=True, help="living spec before the fold")
    ap.add_argument("--after", required=True, help="living spec after the fold")
    ap.add_argument("--json", action="store_true", help="emit the machine-readable object")
    ap.add_argument("--strict", action="store_true", help="exit 1 on any FAIL")
    args = ap.parse_args(argv)

    feature_spec = Path(args.feature_spec).read_text(encoding="utf-8")
    before = Path(args.before).read_text(encoding="utf-8")
    after = Path(args.after).read_text(encoding="utf-8")

    report = run_checks(feature_spec, before, after)
    if args.json:
        print(json.dumps(report.to_dict(), indent=2))
    else:
        print(report.to_text())
    return 1 if (args.strict and report.failed) else 0


if __name__ == "__main__":
    raise SystemExit(main())
