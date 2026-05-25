#!/usr/bin/env python3
"""Write/update a feature's .spec-context.json from a spec-kit lifecycle hook.

Invoked by the `speckit.companion.capture` command-markdown (registered on the
`after_specify` hook). Resolves the active feature directory using spec-kit's
own precedence, then does a crash-safe read-merge-write of the Companion's
canonical .spec-context.json:

  - preserves every existing/unknown top-level key (read-then-merge)
  - appends to `transitions` (append-only; never rewritten or shrunk)
  - writes atomically (temp file + os.replace)
  - emits Companion-canonical values; never the legacy `currentStep: "done"`

Stdlib only. Safe to run anywhere `python3` is available.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import subprocess
import sys
from pathlib import Path

# Canonical vocab (mirrors src/core/types/specContext.ts). Kept here only to
# reject the legacy terminal step and to avoid regressing an advanced spec.
CANONICAL_STEPS = {"specify", "clarify", "plan", "tasks", "analyze", "implement"}
STEP_ORDER = {"specify": 0, "clarify": 1, "plan": 2, "tasks": 3, "analyze": 4, "implement": 5}
# A spec at one of these statuses must never be dragged backward by a hook that
# fires after an earlier step (e.g. after_specify re-resolving to a shipped spec).
TERMINAL_STATUSES = {"implemented", "completed", "archived"}

PREFIX_RE = re.compile(r"^(\d+)-")


def _now_iso() -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def _today() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")


def _repo_root() -> Path:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        if out:
            return Path(out)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return Path.cwd()


def _git_branch(root: Path) -> str | None:
    try:
        out = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        return out or None
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def _match_by_prefix(specs_dir: Path, name: str) -> Path | None:
    """Map a branch/feature name to specs/<prefix>-* by its numeric prefix.

    Mirrors common.sh find_feature_dir_by_prefix. Exact dir name wins first.
    """
    exact = specs_dir / name
    if exact.is_dir():
        return exact
    m = PREFIX_RE.match(name)
    if not m:
        return None
    prefix = str(int(m.group(1)))  # normalize 007 -> 7 for comparison
    matches = []
    if specs_dir.is_dir():
        for child in sorted(specs_dir.iterdir()):
            if not child.is_dir():
                continue
            cm = PREFIX_RE.match(child.name)
            if cm and str(int(cm.group(1))) == prefix:
                matches.append(child)
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        print(
            f"[companion] Warning: multiple spec dirs with prefix '{m.group(1)}': "
            f"{', '.join(c.name for c in matches)}; skipping ambiguous match",
            file=sys.stderr,
        )
    return None


def resolve_feature_dir(root: Path, explicit: str | None) -> Path | None:
    """spec-kit resolution precedence, most-specific first."""
    specs_dir = root / "specs"

    # 1. explicit --feature-dir
    if explicit:
        p = Path(explicit)
        return p if p.is_absolute() else root / p

    # 2. SPECIFY_FEATURE_DIRECTORY env (a path)
    env_dir = os.environ.get("SPECIFY_FEATURE_DIRECTORY")
    if env_dir:
        p = Path(env_dir)
        return p if p.is_absolute() else root / p

    # 3. SPECIFY_FEATURE env (a feature name)
    env_feature = os.environ.get("SPECIFY_FEATURE")
    if env_feature:
        hit = _match_by_prefix(specs_dir, env_feature)
        if hit:
            return hit

    # 4. .specify/feature.json -> feature_directory
    feature_json = root / ".specify" / "feature.json"
    if feature_json.is_file():
        try:
            data = json.loads(feature_json.read_text(encoding="utf-8"))
            fd = data.get("feature_directory")
            if fd:
                p = Path(fd)
                return p if p.is_absolute() else root / p
        except (json.JSONDecodeError, OSError):
            pass

    # 5. git current branch -> numeric-prefix match
    branch = _git_branch(root)
    if branch:
        hit = _match_by_prefix(specs_dir, branch)
        if hit:
            return hit

    return None


def _spec_name(feature_dir: Path) -> str:
    spec_md = feature_dir / "spec.md"
    if spec_md.is_file():
        try:
            for line in spec_md.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("# "):
                    title = line[2:].strip()
                    # Drop a leading "Feature Specification:" / "Spec:" label.
                    title = re.sub(r"^(Feature Specification|Spec|Feature)\s*:\s*", "", title)
                    if title:
                        return title
        except OSError:
            pass
    # Fallback: humanized slug from the dir name (strip NNN- prefix).
    slug = PREFIX_RE.sub("", feature_dir.name)
    return slug.replace("-", " ").strip() or feature_dir.name


def _is_more_advanced(ctx: dict, step: str) -> bool:
    """True if the existing context already records a state past `step` — so a
    hook firing after an earlier step must not regress it."""
    if ctx.get("status") in TERMINAL_STATUSES:
        return True
    cur = ctx.get("currentStep")
    return cur in STEP_ORDER and STEP_ORDER[cur] > STEP_ORDER[step]


def update_context(feature_dir: Path, step: str, status: str, by: str) -> Path | None:
    target = feature_dir / ".spec-context.json"
    now = _now_iso()
    root = _repo_root()
    branch = _git_branch(root) or "main"

    if target.is_file():
        try:
            ctx = json.loads(target.read_text(encoding="utf-8"))
            if not isinstance(ctx, dict):
                ctx = {}
        except (json.JSONDecodeError, OSError):
            ctx = {}
    else:
        ctx = {}

    # Never drag a more-advanced (e.g. shipped) spec backward. Leave it fully
    # intact — this is the bug the schema reconciliation exists to prevent.
    if ctx and _is_more_advanced(ctx, step):
        print(
            f"[companion] {target} already at currentStep={ctx.get('currentStep')} / "
            f"status={ctx.get('status')}; not regressing to {step}/{status}.",
            file=sys.stderr,
        )
        return None

    transitions = ctx.get("transitions")
    if not isinstance(transitions, list):
        transitions = []

    # `from` = prior {step, substep}, or null on first write. Guard against a
    # malformed last entry and normalize a non-canonical prior step (e.g. legacy
    # "done") to null, which the schema's `from.step` enum permits.
    if transitions and isinstance(transitions[-1], dict):
        last = transitions[-1]
        prior_step = last.get("step")
        prior = {
            "step": prior_step if prior_step in CANONICAL_STEPS else None,
            "substep": last.get("substep"),
        }
    else:
        prior = None

    # Required-set defaults only when missing (read-then-merge preserves the rest).
    ctx.setdefault("workflow", "speckit")
    ctx.setdefault("specName", _spec_name(feature_dir))
    ctx.setdefault("branch", branch)

    ctx["currentStep"] = step
    ctx["status"] = status
    ctx["updated"] = _today()

    step_history = ctx.get("stepHistory")
    if not isinstance(step_history, dict):
        step_history = {}
    entry = step_history.get(step) if isinstance(step_history.get(step), dict) else {}
    entry.setdefault("startedAt", now)
    entry["completedAt"] = now
    step_history[step] = entry
    ctx["stepHistory"] = step_history

    transitions.append({
        "step": step,
        "substep": None,
        "from": prior,
        "by": by,
        "at": now,
    })
    ctx["transitions"] = transitions

    tmp = target.with_suffix(target.suffix + ".tmp")
    try:
        tmp.write_text(json.dumps(ctx, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        os.replace(tmp, target)
    except OSError:
        try:
            tmp.unlink(missing_ok=True)  # don't litter on a failed write
        except OSError:
            pass
        raise
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description="Write/update a feature's .spec-context.json")
    parser.add_argument("--step", default="specify")
    parser.add_argument("--status", default="specified")
    parser.add_argument("--by", default="extension")
    parser.add_argument("--feature-dir", default=None)
    args = parser.parse_args()

    # Best-effort guard: a non-canonical step is a no-op, never a host failure.
    # Terminal state belongs in `status`, not `currentStep`.
    if args.step == "done" or args.step not in CANONICAL_STEPS:
        print(
            f"[companion] Skipping: '{args.step}' is not a canonical currentStep "
            f"({', '.join(sorted(CANONICAL_STEPS))}).",
            file=sys.stderr,
        )
        return 0

    root = _repo_root()
    feature_dir = resolve_feature_dir(root, args.feature_dir)
    if feature_dir is None or not feature_dir.is_dir():
        print(
            "[companion] Could not resolve the active feature directory "
            "(checked --feature-dir, SPECIFY_FEATURE_DIRECTORY, SPECIFY_FEATURE, "
            ".specify/feature.json, git branch prefix). Skipping context write.",
            file=sys.stderr,
        )
        return 0  # best-effort: never fail the host command

    # Never let a bookkeeping write fail the host spec-kit command.
    try:
        target = update_context(feature_dir, args.step, args.status, args.by)
    except Exception as exc:  # noqa: BLE001 - best-effort, swallow + report
        print(f"[companion] Warning: skipped .spec-context.json write: {exc}", file=sys.stderr)
        return 0

    if target is not None:
        print(f"[companion] Updated {target} (currentStep={args.step}, status={args.status}, by={args.by})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
