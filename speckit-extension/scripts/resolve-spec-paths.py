#!/usr/bin/env python3
"""Resolve living-spec paths for Companion capabilities.

Single source of truth for the rules the later Living Specs steps (sync / fold /
drift) call instead of re-interpreting the `livingSpecs` block in
`.specify/companion.yml`:

  - membership:  a file belongs to a capability if it matches any `match` glob
                 and no `exclude` glob.
  - path:        centralized -> `capabilities/<name>/spec.md` (default), or the
                 explicit `spec` path (colocated).
  - discovery:   union of configured capabilities and the on-disk `*.spec.md`
                 glob, de-duped by resolved spec path.
  - ordering:    most-specific first (longest matching glob literal-prefix that
                 prefixes the file), tiebreak by capability name.
  - tiers:       `.spec.md` (hot, loaded in v1); `.arch.md` / `.coverage.md`
                 reserved siblings, never flagged as orphans.
  - orphans:     `*.spec.md` in the tree not claimed by any capability's spec.

OPT-IN: when `livingSpecs.enabled` is unset/false (or there is no config), the
resolver is inert — every mode returns empty with exit 0 and no error.

Usage:
  resolve-spec-paths.py --changed <file>...   # capabilities in scope (ordered)
  resolve-spec-paths.py --all                 # every capability (union) + orphans
  resolve-spec-paths.py --orphans             # orphan *.spec.md files only
  add --json for machine-readable output (default for --changed/--all).
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import sys
from glob import glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import companion_config as cc  # noqa: E402

CONFIG = os.path.join(".specify", "companion.yml")
RESERVED_TIERS = (".arch.md", ".coverage.md")


def load_living(root: str) -> dict:
    """Load + normalize the livingSpecs block from <root>/.specify/companion.yml."""
    cfg, _warnings = cc.load_config(os.path.join(root, CONFIG))
    return cc.load_living_specs(cfg)


def _posix(p: str) -> str:
    return p.replace(os.sep, "/")


def _literal_prefix(glob_pat: str) -> str:
    """Longest leading literal path of a glob (before the first wildcard).

    `src/checkout/**` -> `src/checkout`; stops at the first `*`/`?`/`[`.
    """
    out = []
    for ch in glob_pat:
        if ch in "*?[":
            break
        out.append(ch)
    return "".join(out).rstrip("/")


def _glob_to_regex(pat: str) -> str:
    """Translate a glob with cross-directory `**` into a regex.

    `**` matches any depth (incl. zero), `*` matches within one segment, `?` one
    char. A trailing `/**` also matches the directory itself (`src/checkout/**`
    matches `src/checkout`).
    """
    out = ["^"]
    i, n = 0, len(pat)
    while i < n:
        c = pat[i]
        if c == "*":
            if i + 1 < n and pat[i + 1] == "*":
                # `**` — consume an optional following slash; match any depth.
                if i + 2 < n and pat[i + 2] == "/":
                    out.append("(?:.*/)?")
                    i += 3
                    continue
                out.append(".*")
                i += 2
                continue
            out.append("[^/]*")
            i += 1
        elif c == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(c))
            i += 1
    return "".join(out) + "$"


def _glob_matches(pat: str, f: str) -> bool:
    """Glob match supporting cross-directory `**`.

    `src/checkout/**` matches `src/checkout/cart/x.ts` AND `src/checkout` itself;
    `src/checkout/**/*.test.ts` matches only files ending `.test.ts` at any depth.
    Falls back to plain fnmatch when the pattern has no `**`.
    """
    pat, f = _posix(pat), _posix(f)
    if "**" not in pat:
        return fnmatch.fnmatch(f, pat)
    return re.match(_glob_to_regex(pat), f) is not None


def matches(cap: dict, f: str) -> bool:
    """File belongs to capability: any `match` glob, minus any `exclude` glob."""
    f = _posix(f)
    for ex in cap.get("exclude") or []:
        if _glob_matches(ex, f):
            return False
    return any(_glob_matches(pat, f) for pat in cap.get("match") or [])


def _specificity(cap: dict, f: str) -> int:
    """How specific this capability is for file f: longest matching-glob literal
    prefix that prefixes f. Deeper code area -> higher specificity."""
    f = _posix(f)
    best = 0
    for pat in cap.get("match") or []:
        if not _glob_matches(pat, f):
            continue
        lit = _literal_prefix(pat)
        if lit and (f == lit or f.startswith(lit + "/")):
            best = max(best, len(lit))
        else:
            best = max(best, 1)
    return best


def _location(cap: dict) -> str:
    expected = f"{cc.DEFAULT_CAPABILITY_ROOT}/{cap['name']}/spec.md"
    return "centralized" if _posix(cap.get("spec") or "") == expected else "colocated"


def _resolve_spec(cap: dict) -> str:
    """The capability's spec path. A colocated capability with no path is an error."""
    spec = cap.get("spec")
    if spec in (None, ""):
        raise ValueError(
            f'capability "{cap["name"]}" is colocated but has no resolvable spec path'
        )
    return spec


def _entry(cap: dict, root: str) -> dict:
    spec = _resolve_spec(cap)
    return {
        "name": cap["name"],
        "spec": spec,
        "location": _location(cap),
        "exists": os.path.isfile(os.path.join(root, spec)),
    }


def match_changed(files: list[str], living: dict, root: str) -> list[dict]:
    hits = []
    for cap in living["capabilities"]:
        hit_files = [f for f in files if matches(cap, f)]
        if not hit_files:
            continue
        entry = _entry(cap, root)
        entry["specificity"] = max(_specificity(cap, f) for f in hit_files)
        hits.append(entry)
    hits.sort(key=lambda e: (-e["specificity"], e["name"]))
    return hits


def discover_all(living: dict, root: str) -> list[dict]:
    out, seen = [], set()
    for cap in living["capabilities"]:
        entry = _entry(cap, root)
        out.append(entry)
        seen.add(os.path.normpath(entry["spec"]))
    for sp in sorted(glob(os.path.join(root, "**", "*.spec.md"), recursive=True)):
        rel = os.path.normpath(os.path.relpath(sp, root))
        if rel in seen:
            continue
        top = rel.split(os.sep, 1)[0]
        if top == "specs":
            continue
        name = os.path.basename(os.path.dirname(rel)) or os.path.basename(rel)
        out.append({"name": name, "spec": _posix(rel), "location": "colocated",
                    "exists": True})
        seen.add(rel)
    out.sort(key=lambda e: e["name"])
    return out


def find_orphans(living: dict, root: str) -> list[str]:
    """`*.spec.md` on disk not claimed by any capability spec path.

    `.arch.md` / `.coverage.md` are reserved tiers, never orphans. Excludes
    `specs/` (feature specs) and any configured `capabilities/<name>` spec.
    """
    claimed = {os.path.normpath(c.get("spec") or "")
               for c in living["capabilities"] if c.get("spec")}
    orphans = []
    for sp in glob(os.path.join(root, "**", "*.spec.md"), recursive=True):
        rel = os.path.normpath(os.path.relpath(sp, root))
        if rel.split(os.sep, 1)[0] == "specs":
            continue
        if any(rel.endswith(t) for t in RESERVED_TIERS):
            continue
        if rel not in claimed:
            orphans.append(_posix(rel))
    return sorted(orphans)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Resolve Companion living-spec paths.")
    ap.add_argument("--root", default=".", help="repo root (default: cwd)")
    ap.add_argument("--changed", nargs="*", help="changed files -> capabilities in scope")
    ap.add_argument("--all", action="store_true", help="every capability (union) + orphans")
    ap.add_argument("--orphans", action="store_true", help="orphan *.spec.md files")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args(argv)
    root = args.root
    living = load_living(root)

    if not living["enabled"]:
        if args.orphans:
            result = {"orphans": []}
        elif args.all:
            result = {"capabilities": [], "orphans": []}
        else:
            result = {"changed": args.changed or [], "matched": []}
        print(json.dumps(result, indent=2))
        return 0

    try:
        if args.orphans:
            result = {"orphans": find_orphans(living, root)}
        elif args.all:
            result = {"capabilities": discover_all(living, root),
                      "orphans": find_orphans(living, root)}
        else:
            files = args.changed or []
            result = {"changed": files, "matched": match_changed(files, living, root)}
    except ValueError as exc:
        sys.stderr.write(f"resolve-spec-paths: {exc}\n")
        return 2
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
