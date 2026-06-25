#!/usr/bin/env python3
"""Detect code that drifted from its Companion living spec.

For each configured capability, report the source files that changed SINCE the
capability's living spec (`capabilities/<name>/spec.md`) was last committed, and
classify each:

  - `tracked`   — the file appears in some `specs/*/.spec-context.json` changed
                  set (a change that went THROUGH the pipeline but was never
                  folded back into the living spec → a missed sync).
  - `unspeced`  — the file changed entirely outside the pipeline (the living
                  spec never saw it at all). More concerning than `tracked`.

Deterministic: pure git + the LS·1 resolver (membership) + an exempt-glob filter.
It NEVER halts — always exits 0. A surrounding workflow / CI may treat findings
as a gate; the command itself does not. With living specs disabled (or no
config), it reports nothing and exits 0 (the LS·1 inert/opt-in contract).

All git operations are anchored to `--root` (via `git -C <root>`), never cwd, so
pointing it at a sandbox or sibling repo records THAT repo's history.

Usage:
  drift.py [--root <dir>] [--json]
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import subprocess
import sys
from glob import glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import companion_config as cc  # noqa: E402


def _load_resolver():
    """Import the hyphenated resolver module by path (mirrors how the resolver
    imports companion_config)."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resolve-spec-paths.py")
    spec = importlib.util.spec_from_file_location("resolve_spec_paths", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


rsp = _load_resolver()


def _git(root: str, args: list[str]) -> tuple[int, str]:
    try:
        out = subprocess.run(
            ["git", "-C", root, *args],
            capture_output=True, text=True, check=False,
        )
        return out.returncode, out.stdout
    except (OSError, FileNotFoundError):
        return 1, ""


def _spec_commit(root: str, spec: str) -> str | None:
    """The last commit that modified <spec>, or None if untracked / no commits."""
    code, out = _git(root, ["log", "-n", "1", "--format=%H", "--", spec])
    sha = out.strip()
    return sha if code == 0 and sha else None


def _changed_since(root: str, commit: str) -> list[str]:
    code, out = _git(root, ["diff", "--name-only", f"{commit}..HEAD"])
    if code != 0:
        return []
    return [ln.strip() for ln in out.splitlines() if ln.strip()]


def _tracked_files(root: str) -> set[str]:
    """Every file recorded in any specs/*/.spec-context.json changed set.

    Reads both the canonical `history[].files` and the legacy top-level
    `files_modified` so a file that went through the pipeline is recognized
    regardless of which schema captured it.
    """
    out: set[str] = set()
    for ctx in glob(os.path.join(root, "specs", "*", ".spec-context.json")):
        try:
            with open(ctx, encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, ValueError):
            continue
        if not isinstance(data, dict):
            continue
        for f in data.get("files_modified") or []:
            if isinstance(f, str):
                out.add(rsp._posix(f))
        for entry in data.get("history") or []:
            if isinstance(entry, dict):
                for f in entry.get("files") or []:
                    if isinstance(f, str):
                        out.add(rsp._posix(f))
    return out


def _exempt(file: str, exempt_globs: list[str]) -> bool:
    """A file is exempt if any glob matches its full path OR its basename.

    The basename pass lets a segment-scoped pattern like `*.test.*` exempt
    `src/a/b.test.ts` — `*` never crosses `/`, so without it the pattern would
    only match top-level files. A `**/...` glob still matches via the path pass.
    """
    base = file.rsplit("/", 1)[-1]
    return any(
        rsp._glob_matches(g, file) or rsp._glob_matches(g, base)
        for g in exempt_globs
    )


def compute_drift(root: str, living: dict) -> dict:
    """The drift result object. Inert (empty) when living specs are disabled."""
    if not living["enabled"]:
        return {"enabled": False, "capabilities": [], "skipped": []}

    exempt_globs = living.get("exempt") or []
    tracked = _tracked_files(root)
    caps_out: list[dict] = []
    skipped: list[dict] = []

    for cap in living["capabilities"]:
        spec = cap.get("spec")
        if not spec:
            skipped.append({"name": cap["name"], "reason": "no resolvable spec path"})
            continue
        commit = _spec_commit(root, spec)
        if commit is None:
            skipped.append({"name": cap["name"], "reason": "spec.md not yet committed"})
            continue

        spec_posix = rsp._posix(spec)
        drifted = []
        for f in _changed_since(root, commit):
            fp = rsp._posix(f)
            if fp == spec_posix:
                continue
            if not rsp.matches(cap, fp):
                continue
            if _exempt(fp, exempt_globs):
                continue
            severity = "tracked" if fp in tracked else "unspeced"
            drifted.append({"file": fp, "severity": severity})
        drifted.sort(key=lambda d: (d["severity"], d["file"]))
        caps_out.append({
            "name": cap["name"],
            "spec": spec_posix,
            "commit": commit[:8],
            "drifted": drifted,
            "inSync": len(drifted) == 0,
        })

    caps_out.sort(key=lambda c: c["name"])
    return {"enabled": True, "capabilities": caps_out, "skipped": skipped}


def render_human(result: dict) -> str:
    if not result["enabled"]:
        return "✓ Living specs disabled — nothing to check."

    lines: list[str] = []
    for sk in result["skipped"]:
        lines.append(f"ℹ {sk['name']}: {sk['reason']}; skipping drift check")

    has_drift = any(c["drifted"] for c in result["capabilities"])
    if not has_drift:
        if lines:
            lines.append("✓ All capabilities in sync.")
            return "\n".join(lines)
        return "✓ All capabilities in sync."

    lines.append("🔍 Spec drift report")
    for cap in result["capabilities"]:
        if not cap["drifted"]:
            lines.append(f"✓ {cap['name']} — in sync")
            continue
        n = len(cap["drifted"])
        lines.append("")
        lines.append(f"📁 {cap['spec']}  (last committed {cap['commit']})")
        lines.append(f"   {n} file{'s' if n != 1 else ''} changed since spec was last committed:")
        for d in cap["drifted"]:
            note = ("changed via pipeline, never folded back"
                    if d["severity"] == "tracked"
                    else "changed outside the pipeline")
            lines.append(f"   {d['severity']:<8} {d['file']}  — {note}")
    lines.append("")
    lines.append("👉 Fold these into the living spec (e.g. /speckit.companion.adopt) "
                 "or add the path to livingSpecs.exempt.")
    return "\n".join(lines)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Report Companion living-spec drift.")
    ap.add_argument("--root", default=".", help="repo root (default: cwd)")
    ap.add_argument("--json", action="store_true",
                    help="emit the machine-readable JSON object")
    args = ap.parse_args(argv)

    living = rsp.load_living(args.root)
    result = compute_drift(args.root, living)
    print(json.dumps(result, indent=2) if args.json else render_human(result))
    return 0  # never halts


if __name__ == "__main__":
    raise SystemExit(main())
