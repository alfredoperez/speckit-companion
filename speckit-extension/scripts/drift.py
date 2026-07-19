#!/usr/bin/env python3
"""Detect code that drifted from its Companion living spec.

For each configured capability, report the source files that changed SINCE the
capability's living spec (`capabilities/<name>/spec.md`) was last committed, and
classify each:

  - `tracked`   — the file appears in a `specs/*/.spec-context.json` recorded
                  SINCE the capability spec's last commit (a change that went
                  THROUGH the pipeline but was never folded back → a missed
                  recent sync). Scoped to context files changed in
                  `commit..HEAD`; degrades to `unspeced` if git can't scope it.
  - `unspeced`  — the file changed entirely outside the pipeline (the living
                  spec never saw it at all). More concerning than `tracked`.

The `✓ … in sync` claim is earned only by capabilities that were CHECKED — a run
that skipped every capability reports `0 checked, N skipped` instead, and callers
read `checked` off the result to tell "clean" from "did not run".

Deterministic: pure git + the LS·1 resolver (membership) + an exempt-glob filter.
It NEVER halts — always exits 0, including when everything was skipped (a skip
without a committed baseline is correct, not a failure). A surrounding workflow /
CI may treat findings as a gate; the command itself does not. With living specs
disabled (or no config), it reports nothing and exits 0 (the LS·1 inert/opt-in
contract).

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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


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


def _is_git_repo(root: str) -> bool:
    """True when <root> is inside a git work tree and git is runnable."""
    code, out = _git(root, ["rev-parse", "--is-inside-work-tree"])
    return code == 0 and out.strip() == "true"


def _spec_commit(root: str, spec: str) -> str | None:
    """The last commit that modified <spec>, or None if untracked / no commits."""
    code, out = _git(root, ["log", "-n", "1", "--format=%H", "--", spec])
    sha = out.strip()
    return sha if code == 0 and sha else None


def _changed_since(root: str, commit: str, pathspec: str | None = None) -> list[str]:
    args = ["diff", "--name-only", f"{commit}..HEAD"]
    if pathspec is not None:
        args += ["--", pathspec]
    code, out = _git(root, args)
    if code != 0:
        return []
    return [ln.strip() for ln in out.splitlines() if ln.strip()]


def _read_context_files(path: str) -> set[str]:
    """Files recorded in one `.spec-context.json` (canonical + legacy schema)."""
    out: set[str] = set()
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return out
    if not isinstance(data, dict):
        return out
    for f in data.get("files_modified") or []:
        if isinstance(f, str):
            out.add(rsp._posix(f))
    for entry in data.get("history") or []:
        if isinstance(entry, dict):
            for f in entry.get("files") or []:
                if isinstance(f, str):
                    out.add(rsp._posix(f))
    return out


def _tracked_files_since(root: str, commit: str) -> set[str]:
    """Files recorded in a `specs/*/.spec-context.json` that itself changed in
    `commit..HEAD` — i.e. a pipeline sync recorded SINCE the capability spec's
    last commit (FR-002: "...changed/modified set since the spec's commit").

    Scoping to context files changed in `commit..HEAD` is the git-based read
    consistent with the rest of drift. It degrades conservatively: if git can't
    scope it (no diff output / non-repo), the set is empty, so an ambiguous file
    is labeled `unspeced` rather than a false `tracked`.
    """
    out: set[str] = set()
    for rel in _changed_since(root, commit, "specs/"):
        rel = rsp._posix(rel)
        if not rel.endswith("/.spec-context.json"):
            continue
        out |= _read_context_files(os.path.join(root, rel))
    return out


def _is_own_spec_doc(fp: str, spec_posix: str) -> bool:
    """True for the capability's own living-spec documents — the spec itself or a
    reserved-tier sibling (`.arch.md` / `.coverage.md`) in the spec's directory.

    A colocated capability's `match` globs claim its own area, so without this a
    `src/billing/billing.arch.md` edit would be reported as drifted *code*. The
    spec documents ARE the spec, not drift — mirror the resolver's tier hygiene.
    """
    if fp == spec_posix:
        return True
    spec_dir = spec_posix.rsplit("/", 1)[0] if "/" in spec_posix else ""
    file_dir = fp.rsplit("/", 1)[0] if "/" in fp else ""
    return file_dir == spec_dir and any(fp.endswith(t) for t in rsp.RESERVED_TIERS)


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
        return {"enabled": False, "checked": 0, "capabilities": [], "skipped": []}

    exempt_globs = living.get("exempt") or []
    git_ok = _is_git_repo(root)
    caps_out: list[dict] = []
    skipped: list[dict] = []

    for cap in living["capabilities"]:
        spec = cap.get("spec")
        if not spec:
            skipped.append({"name": cap["name"], "reason": "no resolvable spec path"})
            continue
        if not git_ok:
            skipped.append({"name": cap["name"],
                            "reason": "git unavailable or --root is not a git repo"})
            continue
        commit = _spec_commit(root, spec)
        if commit is None:
            skipped.append({"name": cap["name"], "reason": "spec.md not yet committed"})
            continue

        spec_posix = rsp._posix(spec)
        tracked = _tracked_files_since(root, commit)
        drifted = []
        for f in _changed_since(root, commit):
            fp = rsp._posix(f)
            if _is_own_spec_doc(fp, spec_posix):
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
    return {"enabled": True, "checked": len(caps_out),
            "capabilities": caps_out, "skipped": skipped}


def _counts_line(result: dict, include_checked: bool = True) -> str:
    """`0 checked, 9 skipped (spec.md not yet committed)` — the parenthetical
    appears only when every skip shares one reason."""
    skipped = result["skipped"]
    line = f"{len(skipped)} skipped"
    if include_checked:
        line = f"{result['checked']} checked, " + line
    reasons = {sk["reason"] for sk in skipped}
    if len(reasons) == 1:
        line += f" ({reasons.pop()})"
    return line


def render_human(result: dict) -> str:
    if not result["enabled"]:
        return ""  # opt-in: disabled feature reports nothing in human mode

    lines: list[str] = []
    for sk in result["skipped"]:
        lines.append(f"ℹ {sk['name']}: {sk['reason']}; skipping drift check")

    checked = result["checked"]
    if checked == 0:
        if not result["skipped"]:
            return "No capabilities configured."
        lines.append(_counts_line(result))
        return "\n".join(lines)

    if not any(c["drifted"] for c in result["capabilities"]):
        noun = "capability" if checked == 1 else "capabilities"
        lines.append(f"✓ All {checked} checked {noun} in sync.")
        if result["skipped"]:
            lines.append(_counts_line(result, include_checked=False))
        return "\n".join(lines)

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
    lines.append(_counts_line(result))
    lines.append("👉 Fold these into the living spec (e.g. /speckit.companion.living-adopt) "
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
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        text = render_human(result)
        if text:  # no blank line when disabled / nothing to say
            print(text)
    return 0  # never halts


if __name__ == "__main__":
    raise SystemExit(main())
