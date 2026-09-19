#!/usr/bin/env python3
"""Print the subagent briefs a step dispatches, and record each worker's check-in.

  dispatch-briefs.py --feature-dir <dir>                   one read-only reader per recorded `area:`
  dispatch-briefs.py --feature-dir <dir> --docs            one writer per Phase 1 design document
  dispatch-briefs.py --feature-dir <dir> --checkin <label> a dispatched worker says it started

The decision lives here, not in the prompt: prose that says "dispatch when…" gets
argued away by an unattended run, a printed brief does not. Two or more briefs
means dispatch them all; fewer means the step works inline. Check-ins land in the
spec's trace, where the doctor compares them with what was printed. Never fails
the host command. Stdlib only.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

SCRIPT = ".specify/extensions/companion/scripts/dispatch-briefs.py"
#: Past this many, areas share a reader: specify often records single files as areas.
MAX_READERS = 4
DOCS = {
    "data-model.md": "the entities this feature introduces or reshapes, with fields, relationships, "
                     "validation rules drawn from the requirements, and any state transitions",
    "contracts/": "the interface the feature exposes (API / CLI / schema, or a UI contract listing routes "
                  "and the identifiers a consumer or test codes against), copying every identifier from "
                  "the spec's Verbatim Constraints exactly. If the feature exposes no interface, write nothing "
                  "and say so",
}


def areas(ctx: dict) -> list:
    return [c.split(":", 1)[1].strip() for c in ctx.get("context") or []
            if isinstance(c, str) and c.startswith("area:")]


def spec_file(feature_dir: Path) -> str:
    found = sorted(feature_dir.glob("*.spec.md")) or sorted(feature_dir.glob("spec.md"))
    return str(found[0]) if found else f"{feature_dir}/<short-name>.spec.md"


def checkin_line(feature_dir: Path, label: str) -> str:
    return f'python3 {SCRIPT} --feature-dir {feature_dir} --checkin "{label}"'


def reader_briefs(feature_dir: Path, ctx: dict) -> list:
    spec = spec_file(feature_dir)
    found = areas(ctx)
    groups = [found[i::MAX_READERS] for i in range(min(len(found), MAX_READERS))]
    return [(f"reader: {n}",
             f"Read-only. First run `{checkin_line(feature_dir, f'reader: {n}')}`. Then read the code in "
             f"{', '.join(f'`{a}`' for a in g)} for the feature in `{spec}`, starting from what the `context` entries in "
             f"`{feature_dir}/.spec-context.json` already name. Return a distilled finding: the pattern to "
             "copy, the concrete file paths, the conventions to match, and anything the code does that the "
             "spec does not account for. Never file contents.")
            for n, g in enumerate(groups, 1)]


def doc_briefs(feature_dir: Path, ctx: dict) -> list:
    if (ctx.get("size") or "normal") == "simple":
        return []
    spec = spec_file(feature_dir)
    return [(f"doc: {name}",
             f"First run `{checkin_line(feature_dir, f'doc: {name}')}`. Then write "
             f"`{feature_dir}/{name}`: {what}. Work from `{spec}`, `{feature_dir}/plan.md` and "
             f"`{feature_dir}/research.md`. Return only the path you wrote.")
            for name, what in DOCS.items()]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--feature-dir", required=True, type=Path)
    ap.add_argument("--docs", action="store_true")
    ap.add_argument("--checkin")
    args = ap.parse_args()
    feature_dir = args.feature_dir

    if args.checkin:
        import run_trace
        run_trace.record("dispatch-briefs", "dispatch-checkin", True, ms=0,
                         feature_dir=feature_dir, spec=feature_dir.name, files=[args.checkin])
        return 0

    try:
        ctx = json.loads((feature_dir / ".spec-context.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        ctx = {}
    briefs = doc_briefs(feature_dir, ctx) if args.docs else reader_briefs(feature_dir, ctx)
    what = "design docs" if args.docs else "readers"

    if len(briefs) < 2:
        why = "simple size keeps at most one" if args.docs else f"{len(briefs)} area recorded"
        print(f"Working inline: {why}. No {what} to dispatch.")
        return 0

    print(f"Dispatch these {len(briefs)} {what} now, all in ONE message, each brief as written. "
          "If you have no subagent tool, do each yourself instead.\n")
    for label, brief in briefs:
        print(f"=== {label} ===\n{brief}\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001 — a dispatch helper must never fail the step
        print(f"[dispatch-briefs] skipped: {exc}", file=sys.stderr)
        sys.exit(0)
