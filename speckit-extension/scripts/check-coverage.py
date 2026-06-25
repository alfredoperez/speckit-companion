#!/usr/bin/env python3
"""Report requirement→test coverage for a Companion living spec (LS·8).

A capability's hot spec (`<base>.spec.md`) lists requirements; its reserved
coverage tier (`<base>.coverage.md`) maps each requirement to the test(s) that
exercise it. This checker reads both, reuses the LS·1 resolver for the tier
paths, and reports — per requirement — whether it is covered (has a coverage
entry) or uncovered. It is the conformance ON-RAMP, not a gate:

  - READ-ONLY: it never edits a spec, coverage file, or context.
  - NON-FAILING: it always exits 0, even with uncovered requirements. A
    surrounding workflow / CI may treat findings as a signal; the command does
    not. (Mirrors the drift command's contract.)
  - OPT-IN: with `livingSpecs.enabled` unset/false (or no config) it reports
    nothing and exits 0 (the LS·1 inert contract).

Requirement ids are extracted from the spec as the leading `FR-NNN` / `NFR-NNN`
(also `FR001`, `NFR4`) token of a bullet or heading. A requirement is COVERED
when its id appears in the coverage file on a line that also names at least one
test (a `.test.`/`.spec.`/`_test` path or a `tests/...` reference). A capability
with no `.coverage.md` reports every requirement uncovered (with `hasCoverage:
false`); a capability with no `.spec.md` requirements reports an empty list.

Usage:
  check-coverage.py [--root <dir>] [--capability <name>] [--json]
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _load_resolver():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resolve-spec-paths.py")
    spec = importlib.util.spec_from_file_location("resolve_spec_paths", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


rsp = _load_resolver()

# A requirement id: FR / NFR optionally hyphenated, then digits. Anchored to the
# start of a list bullet or heading so prose mentions of "FR-001" don't register
# as a new requirement.
REQ_LINE = re.compile(r"^\s*(?:[-*+]|#{1,6})\s*\**(?P<id>(?:N?FR)-?\d+)\b", re.I)
REQ_ANY = re.compile(r"\b(?P<id>(?:N?FR)-?\d+)\b", re.I)
# A token that looks like a test reference.
TEST_TOKEN = re.compile(
    r"(?:[\w./-]*\.(?:test|spec)\.[\w]+"   # foo.test.ts / foo.spec.tsx
    r"|[\w./-]*_test\.[\w]+"               # foo_test.py
    r"|tests?/[\w./-]+"                    # tests/foo.py
    r"|[\w./-]+::[\w]+)",                  # pytest nodeid file::TestCase
    re.I,
)


def _norm_id(rid: str) -> str:
    """Canonicalize a requirement id for matching: upper, hyphen-normalized.

    `fr001` / `FR-001` / `FR-1` -> `FR-1`; leading zeros are stripped so the
    spec and coverage files can disagree on padding."""
    m = re.match(r"(N?FR)-?0*(\d+)", rid, re.I)
    if not m:
        return rid.upper()
    return f"{m.group(1).upper()}-{m.group(2)}"


def spec_requirements(text: str) -> list[str]:
    """Ordered, de-duped requirement ids from a spec's bullets/headings."""
    out, seen = [], set()
    for line in text.splitlines():
        m = REQ_LINE.match(line)
        if not m:
            continue
        rid = _norm_id(m.group("id"))
        if rid in seen:
            continue
        seen.add(rid)
        out.append(rid)
    return out


def coverage_map(text: str) -> dict[str, list[str]]:
    """Map requirement id -> list of test references found on its line(s)."""
    out: dict[str, list[str]] = {}
    for line in text.splitlines():
        ids = {_norm_id(m.group("id")) for m in REQ_ANY.finditer(line)}
        if not ids:
            continue
        tests = TEST_TOKEN.findall(line)
        for rid in ids:
            bucket = out.setdefault(rid, [])
            for t in tests:
                if t not in bucket:
                    bucket.append(t)
    return out


def check_capability(name: str, spec_path: str, root: str, tiers: dict) -> dict:
    cov = tiers.get("coverage", {})
    cov_path = cov.get("path")
    has_coverage = bool(cov.get("exists"))

    spec_abs = os.path.join(root, spec_path)
    reqs = []
    if os.path.isfile(spec_abs):
        with open(spec_abs, encoding="utf-8") as fh:
            reqs = spec_requirements(fh.read())

    cmap: dict[str, list[str]] = {}
    if has_coverage and cov_path:
        with open(os.path.join(root, cov_path), encoding="utf-8") as fh:
            cmap = coverage_map(fh.read())

    requirements = []
    for rid in reqs:
        tests = cmap.get(rid, [])
        requirements.append({"id": rid, "covered": bool(tests), "tests": tests})

    covered = sum(1 for r in requirements if r["covered"])
    return {
        "name": name,
        "spec": spec_path,
        "coverage": cov_path,
        "hasCoverage": has_coverage,
        "total": len(requirements),
        "covered": covered,
        "uncovered": len(requirements) - covered,
        "requirements": requirements,
    }


def run(root: str, capability: str | None) -> dict:
    living = rsp.load_living(root)
    if not living["enabled"]:
        return {"enabled": False, "capabilities": []}

    entries = rsp.discover_all(living, root)
    if capability:
        entries = [e for e in entries if e["name"] == capability]

    caps = []
    for e in entries:
        if not e.get("exists"):
            continue
        caps.append(check_capability(e["name"], e["spec"], root, e.get("tiers", {})))
    return {"enabled": True, "capabilities": caps}


def render_human(result: dict) -> str:
    if not result["enabled"]:
        return "living specs disabled — no coverage to report"
    if not result["capabilities"]:
        return "no living specs with a spec file to check"
    lines = ["📊 Coverage report"]
    for cap in result["capabilities"]:
        if not cap["hasCoverage"]:
            lines.append(f"\n📁 {cap['name']} — no .coverage.md (all {cap['total']} requirements uncovered)")
        else:
            lines.append(
                f"\n📁 {cap['name']} — {cap['covered']}/{cap['total']} requirements covered"
            )
        for r in cap["requirements"]:
            if r["covered"]:
                lines.append(f"   ✓ {r['id']} → {', '.join(r['tests'])}")
            else:
                lines.append(f"   ✗ {r['id']} — uncovered")
    return "\n".join(lines)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Report living-spec requirement→test coverage.")
    ap.add_argument("--root", default=".", help="repo root (default: cwd)")
    ap.add_argument("--capability", help="restrict to one capability by name")
    ap.add_argument("--json", action="store_true", help="emit the machine-readable object")
    args = ap.parse_args(argv)

    result = run(args.root, args.capability)
    print(json.dumps(result, indent=2) if args.json else render_human(result))
    return 0  # never fails — informational, like drift.


if __name__ == "__main__":
    raise SystemExit(main())
