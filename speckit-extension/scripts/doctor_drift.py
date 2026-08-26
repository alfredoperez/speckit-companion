#!/usr/bin/env python3
"""The doctor's drift audit — recompute, show the work, classify every flag.

A drift warning nobody can judge gets ignored, which makes the whole drift
feature worthless. This module never reads a recorded verdict as an answer: it
runs the deterministic drift computation itself, walks git for the commits behind
each flag, and classifies each one so the developer knows whether to act. A prior
claim is compared *against* the recomputation, never trusted in place of it.

`drift.py` is the ground truth and is invoked as a user would invoke it, so a
defect in its entry point is visible here rather than bypassed. Stdlib only.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from doctor import CheckStatus, Finding, parse_commit_log, run_git  # noqa: E402

DRIFT_SCRIPT = "drift.py"

#: Files the companion itself writes while a run is in flight. A capability whose
#: only "drift" is these is reacting to its own bookkeeping, not to real change.
COMPANION_ARTIFACTS = (
    ".spec-context.json",
    ".spec-context.events.jsonl",
    ".spec-context.lock",
    ".trace.jsonl",
)

CLASS_REAL = "real"
CLASS_SELF = "self-inflicted"
CLASS_BASELINE = "suspect-baseline"
CLASS_UNKNOWN = "unknown"

_SEVERITY = {CLASS_REAL: "warning", CLASS_BASELINE: "warning",
             CLASS_SELF: "note", CLASS_UNKNOWN: "note"}


def recompute(root) -> dict | None:
    """Run drift.py as a user would and return its result object, or None."""
    script = Path(__file__).resolve().parent / DRIFT_SCRIPT
    if not script.is_file():
        return None
    try:
        p = subprocess.run([sys.executable, str(script), "--root", str(root), "--json"],
                           capture_output=True, text=True, timeout=180)
    except (OSError, subprocess.SubprocessError):
        return None
    try:
        return json.loads(p.stdout)
    except ValueError:
        return None


def _is_companion_artifact(path: str) -> bool:
    name = os.path.basename(path)
    return name in COMPANION_ARTIFACTS


def _commits_for(root, baseline: str, files: list) -> list:
    """The commits since `baseline` that touched any of `files`, newest first."""
    if not baseline or not files:
        return []
    code, out = run_git(root, ["log", "--format=%H%x1f%s", "--name-only",
                               f"{baseline}..HEAD", "--", *files])
    if code != 0:
        return []
    return parse_commit_log(out)


def _baseline_is_ancestor(root, baseline: str) -> bool | None:
    """True / False / None — None means git could not answer, which is not a no."""
    if not baseline:
        return None
    code, _ = run_git(root, ["merge-base", "--is-ancestor", baseline, "HEAD"])
    if code == 0:
        return True
    code2, out = run_git(root, ["cat-file", "-t", baseline])
    if code2 != 0 or out.strip() != "commit":
        return None  # the baseline is not a commit we can reach — cannot tell
    return False


def _renamed_files(root, baseline: str, files: list) -> list:
    """Of `files`, the ones git can follow back through a rename since `baseline`.

    The diff runs without a pathspec on purpose: a rename is a pair of paths, and
    narrowing to the new name alone hides the pair, so git reports an add instead.
    """
    if not baseline or not files:
        return []
    code, out = run_git(root, ["diff", "--diff-filter=R", "--name-status", "-M", baseline, "HEAD"])
    if code != 0:
        return []
    renamed = {line.split("\t")[-1] for line in out.splitlines() if line.startswith("R")}
    return [f for f in files if f in renamed]


def classify(root, cap: dict) -> dict:
    """One DriftFlag: what changed, in which commits, and what kind of flag it is."""
    files = [d["file"] for d in cap.get("drifted") or []]
    baseline = cap.get("commit")
    flag = {
        "capability": cap.get("name"),
        "class": CLASS_REAL,
        "baseline": baseline,
        "files": files,
        "commits": [],
        "reason": None,
        "claim": None,
    }

    if files and all(_is_companion_artifact(f) for f in files):
        flag["class"] = CLASS_SELF
        flag["reason"] = "every changed file is a record the companion writes during a run"
        return flag

    if not baseline:
        flag["class"] = CLASS_UNKNOWN
        flag["reason"] = ("no baseline commit was recorded for this capability — its spec has "
                          "never been committed, so there is nothing to compare against")
        return flag

    ancestor = _baseline_is_ancestor(root, baseline)
    if ancestor is None:
        flag["class"] = CLASS_UNKNOWN
        flag["reason"] = (f"the baseline commit {baseline} is unreachable — history may be "
                          f"shallow or rewritten")
        return flag
    if ancestor is False:
        flag["class"] = CLASS_BASELINE
        flag["reason"] = (f"the spec's last commit {baseline} is not an ancestor of HEAD, so the "
                          f"comparison point is wrong (a rebase or a force-push moved it)")
        return flag

    renamed = _renamed_files(root, baseline, files)
    if renamed and set(renamed) == set(files):
        flag["class"] = CLASS_BASELINE
        flag["reason"] = "every changed file is a rename git can follow, not a change in behavior"
        flag["commits"] = _commits_for(root, baseline, files)
        return flag

    flag["commits"] = _commits_for(root, baseline, files)
    return flag


def _recorded_claims(ctx: dict) -> list:
    """Anything the run recorded that asserts a drift verdict."""
    out = []
    for entry in ctx.get("verified") or []:
        if isinstance(entry, dict):
            text, at = entry.get("what"), entry.get("at")
            blob = json.dumps(entry, ensure_ascii=False)
        else:
            text = blob = str(entry)
            at = None
        if text and "drift" in blob.lower():
            out.append({"source": "verified[]", "text": text, "at": at, "blob": blob})
    return out


# Whole words only. Substring matching read "cleaned up two stale entries" as a
# drift-clean assertion and accused the run of a claim it never made.
_CLEAN_CLAIM = re.compile(
    r"\b(in sync|no drift|drift[- ]clean|clean)\b", re.I)


def _claims_clean(claim: dict) -> bool:
    return bool(_CLEAN_CLAIM.search(claim["blob"]))


def check_drift(root, feature_dir: Path, ctx: dict, report=None) -> tuple:
    """Recompute drift, classify every flag, and catch a claim it contradicts."""
    result = recompute(root)
    if result is None:
        return CheckStatus("drift", "skipped",
                           "could not run the drift computation — no drift.py, or it emitted "
                           "no readable result"), []
    if not result.get("enabled"):
        return CheckStatus("drift", "not-applicable"), []

    findings = []
    flags = []

    for cap in result.get("capabilities") or []:
        if cap.get("inSync"):
            continue
        flags.append(classify(root, cap))

    for skip in result.get("skipped") or []:
        flags.append({
            "capability": skip.get("name"), "class": CLASS_UNKNOWN, "baseline": None,
            "files": [], "commits": [], "reason": skip.get("reason"), "claim": None,
        })

    for flag in flags:
        commits = flag["commits"]
        where = ""
        if flag["files"]:
            shown = ", ".join(flag["files"][:5])
            if len(flag["files"]) > 5:
                shown += f", +{len(flag['files']) - 5} more"
            where = f"{len(flag['files'])} file(s): {shown}"
            if commits:
                where += f"; {len(commits)} commit(s): " + ", ".join(
                    f"{c['sha']} {c['subject']}" for c in commits[:3])
        detail = " — ".join(x for x in (flag["reason"], where) if x)
        findings.append(Finding(
            "drift", _SEVERITY[flag["class"]],
            f"{flag['capability']} — {flag['class']}"
            + (f" (baseline {flag['baseline']})" if flag["baseline"] else ""),
            detail,
            flag,
        ))

    real = [f for f in flags if f["class"] == CLASS_REAL]
    for claim in _recorded_claims(ctx):
        if _claims_clean(claim) and real:
            names = ", ".join(f["capability"] for f in real)
            findings.append(Finding(
                "drift", "problem",
                "A recorded drift-clean claim contradicts the recomputation",
                f"the run recorded \"{claim['text']}\""
                + (f" at {claim['at']}" if claim.get("at") else "")
                + f", but recomputing now finds real drift in: {names}",
                {"claim": claim, "contradicted_by": names},
            ))
            for flag in real:
                flag["claim"] = {"source": claim["source"], "text": claim["text"],
                                 "at": claim.get("at")}

    if report is not None:
        report.drift = flags
    return CheckStatus("drift", "ran"), findings
