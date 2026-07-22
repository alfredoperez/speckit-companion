#!/usr/bin/env python3
"""Deterministically record which living specs cover a change.

Reads the project's living-specs registry (gate on `enabled: true`), runs the
shipped resolver over the changed files, and records the matched capability
names — most-specific first — onto `livingSpecs.loaded` in `.spec-context.json`
via the same additive writer the prose path used.

This exists so the RECORDING of living specs is a script call, not an AI
judgement: the specify command bodies call this one line instead of asking the
model to read the registry, check `enabled`, run the resolver, and decide. The
model's *reading* of the specs for drafting stays best-effort prose.

Contract (mirrors the rest of the capture runtime): best-effort, opt-in,
read-only. A missing registry, disabled feature, unresolvable feature dir,
resolver error, or absent dependency is a silent no-op that exits 0 — recording
state must never break or slow the run it observes.

Usage:
  record-living-specs.py --feature-dir <fd> --changed <file> [<file> ...]
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _load_resolver():
    """Import the hyphenated resolver module by path (mirrors drift.py)."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resolve-spec-paths.py")
    spec = importlib.util.spec_from_file_location("resolve_spec_paths", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def record(feature_dir: Path, changed: list[str], root: str) -> list[str]:
    """Resolve the capabilities that own `changed` and record them leaf-first.

    Returns the recorded names (possibly empty). Writes nothing when the feature
    is off, no files are given, or nothing matches."""
    rsp = _load_resolver()
    living = rsp.load_living(root)
    if not living.get("enabled"):
        return []
    files = [f for f in changed if f and f.strip()]
    if not files:
        return []
    names = [m["name"] for m in rsp.match_changed(files, living, root)]
    if not names:
        return []
    from capture import set_living_specs_loaded
    set_living_specs_loaded(feature_dir, names)
    return names


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Record the living specs that cover a change.")
    ap.add_argument("--feature-dir", required=True, help="spec dir whose .spec-context.json receives livingSpecs.loaded")
    ap.add_argument("--changed", nargs="+", default=[], help="changed files to resolve capabilities for")
    ap.add_argument("--root", default=None, help="repo root the registry + resolver read from (default: the feature dir's git root)")
    try:
        args = ap.parse_args(argv)
    except SystemExit:
        return 0  # a malformed arg must not fail the host command (SystemExit escapes `except Exception`)

    try:
        feature_dir = Path(args.feature_dir)
        root = args.root
        if not root:
            from spec_context import _repo_root_for
            root = str(_repo_root_for(feature_dir))
        names = record(feature_dir, args.changed, root)
        if names:
            print(f"[companion] Recorded living specs ({', '.join(names)}) in {feature_dir}/.spec-context.json")
    except Exception as exc:  # never fail the host command
        print(f"[companion] record-living-specs skipped: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
