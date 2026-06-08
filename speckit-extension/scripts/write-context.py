#!/usr/bin/env python3
"""Write/update a feature's .spec-context.json from a spec-kit lifecycle hook.

Invoked by the `speckit.companion.capture` command-markdown (registered on the
`after_specify` hook). Resolves the active feature directory using spec-kit's
own precedence, then does a crash-safe read-merge-write of the Companion's
canonical .spec-context.json:

  - preserves every existing/unknown top-level key (read-then-merge)
  - appends to the canonical `history[]` (append-only; never rewritten or
    shrunk), migrating a legacy `transitions[]` array forward so the extension
    and the VS Code GUI write the same single field
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


def read_ctx(target: Path) -> dict:
    """Read the existing context, tolerating absence or corruption."""
    if target.is_file():
        try:
            ctx = json.loads(target.read_text(encoding="utf-8"))
            if isinstance(ctx, dict):
                return ctx
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def atomic_write(target: Path, ctx: dict) -> None:
    """Crash-safe write: serialize to a temp file, then rename over the target."""
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


def canonical_log(ctx: dict) -> list:
    """The append-only lifecycle log. Canonical field is `history`; an older
    file may still carry the legacy `transitions` name — migrate it forward so
    both the extension and the VS Code GUI write the same single array."""
    log = ctx.get("history")
    if isinstance(log, list):
        return log
    legacy = ctx.get("transitions")
    if isinstance(legacy, list):
        return legacy
    return []


def commit_log(ctx: dict, log: list) -> None:
    """Persist the log under the canonical `history` key and drop the legacy
    `transitions` / derived `stepHistory` keys (the GUI derives stepHistory)."""
    ctx["history"] = log
    ctx.pop("transitions", None)
    ctx.pop("stepHistory", None)


def step_from(prev_current: object, step: str) -> dict:
    """`from` for a step `start` entry — the prior step, or null when there is
    none or it equals `step` (mirrors the GUI's setStepStarted, which nulls a
    self-origin so the reader can't misread it as a step completion)."""
    prior = prev_current if (prev_current in CANONICAL_STEPS and prev_current != step) else None
    return {"step": prior, "substep": None}


def fill_required(ctx: dict, feature_dir: Path, branch: str) -> None:
    """Set required keys only when missing (read-then-merge preserves the rest)."""
    ctx.setdefault("workflow", "speckit")
    ctx.setdefault("specName", _spec_name(feature_dir))
    ctx.setdefault("branch", branch)


COMPLETED_TASK_RE = re.compile(r"^\s*[-*]\s*\[[xX]\]\s*\*\*(T\d+)")
PENDING_TASK_RE = re.compile(r"^\s*[-*]\s*\[\s\]\s*\*\*(T\d+)")


def parse_task_markers(tasks_md: Path) -> tuple[list[str], list[str]]:
    """Return (all_task_ids, completed_task_ids) in document order from tasks.md."""
    all_ids: list[str] = []
    done_ids: list[str] = []
    try:
        for line in tasks_md.read_text(encoding="utf-8").splitlines():
            m = COMPLETED_TASK_RE.match(line)
            if m:
                all_ids.append(m.group(1))
                done_ids.append(m.group(1))
                continue
            m = PENDING_TASK_RE.match(line)
            if m:
                all_ids.append(m.group(1))
    except OSError:
        pass
    return all_ids, done_ids


def _journaled_tasks(transitions: list) -> set[str]:
    """Task ids already recorded as per-task transitions (idempotency key)."""
    return {
        t["task"]
        for t in transitions
        if isinstance(t, dict) and isinstance(t.get("task"), str)
    }


def update_context(feature_dir: Path, step: str, status: str, by: str) -> Path | None:
    target = feature_dir / ".spec-context.json"
    now = _now_iso()
    branch = _git_branch(_repo_root()) or "main"

    ctx = read_ctx(target)

    # Never drag a more-advanced (e.g. shipped) spec backward. Leave it fully
    # intact — this is the bug the schema reconciliation exists to prevent.
    if ctx and _is_more_advanced(ctx, step):
        print(
            f"[companion] {target} already at currentStep={ctx.get('currentStep')} / "
            f"status={ctx.get('status')}; not regressing to {step}/{status}.",
            file=sys.stderr,
        )
        return None

    log = canonical_log(ctx)
    from_ = step_from(ctx.get("currentStep"), step)
    fill_required(ctx, feature_dir, branch)

    ctx["currentStep"] = step
    ctx["status"] = status
    ctx["updated"] = _today()

    # Dedupe a duplicate same-step start: if the latest history entry is already a
    # `start` for this step (substep None) with no intervening complete, the step is
    # still open — a second fresh start-from-null just inflates history and corrupts
    # duration math (e.g. the GUI's startStep + the after_specify hook both firing).
    last = log[-1] if log else None
    dup_start = (
        isinstance(last, dict)
        and last.get("step") == step
        and last.get("substep") is None
        and last.get("kind") == "start"
    )
    if not dup_start:
        log.append({
            "step": step,
            "substep": None,
            "kind": "start",
            "from": from_,
            "by": by,
            "at": now,
        })
    commit_log(ctx, log)

    atomic_write(target, ctx)
    return target


def sync_tasks(feature_dir: Path, tasks_md: Path, final_status: str, by: str) -> Path | None:
    """Per-task journaling for the implement step.

    Reads completed task markers in tasks.md and appends one transition per
    newly-completed task (idempotent — task ids already journaled are skipped).
    Sets currentStep=implement, currentTask to the last completed (or next
    pending) task, and status to `final_status` once every marker is checked,
    else "implementing". Honors the same no-backward-clobber guard.
    """
    target = feature_dir / ".spec-context.json"
    branch = _git_branch(_repo_root()) or "main"
    ctx = read_ctx(target)

    if ctx and _is_more_advanced(ctx, "implement"):
        print(
            f"[companion] {target} already at currentStep={ctx.get('currentStep')} / "
            f"status={ctx.get('status')}; not regressing to implement.",
            file=sys.stderr,
        )
        return None

    all_ids, done_ids = parse_task_markers(tasks_md)
    if not all_ids:
        print(f"[companion] No task markers found in {tasks_md}; nothing to sync.", file=sys.stderr)
        return None

    # Distinct, order-preserving — a marker id repeated in tasks.md is one task.
    distinct_all = list(dict.fromkeys(all_ids))
    distinct_done = list(dict.fromkeys(done_ids))

    log = canonical_log(ctx)
    already = _journaled_tasks(log)
    fresh = [tid for tid in distinct_done if tid not in already]

    fill_required(ctx, feature_dir, branch)
    ctx["currentStep"] = "implement"
    all_done = bool(distinct_all) and set(distinct_done) >= set(distinct_all)
    ctx["status"] = final_status if all_done else "implementing"
    ctx["updated"] = _today()

    pending = [tid for tid in distinct_all if tid not in distinct_done]
    ctx["currentTask"] = (pending[0] if pending else (distinct_done[-1] if distinct_done else None))

    # Per-task entries are substeps of implement (substep = task id, kind=start).
    # A substep entry can never be read as a step-completion boundary (which is a
    # substep==null self-loop), and distinct substep names keep dedupeConsecutive
    # from collapsing them.
    for tid in fresh:
        log.append({
            "step": "implement",
            "substep": tid,
            "task": tid,
            "kind": "start",
            "from": {"step": "implement", "substep": None},
            "by": by,
            "at": _now_iso(),
        })
    commit_log(ctx, log)

    atomic_write(target, ctx)
    print(
        f"[companion] Synced {len(fresh)} new task event(s) "
        f"({len(distinct_done)}/{len(distinct_all)} complete) into {target}.",
        file=sys.stderr,
    )
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description="Write/update a feature's .spec-context.json")
    parser.add_argument("--step", default="specify")
    parser.add_argument("--status", default="specified")
    parser.add_argument("--by", default="extension")
    parser.add_argument("--feature-dir", default=None)
    parser.add_argument(
        "--tasks-file", default=None,
        help="Per-task journaling: append a transition per completed marker in this tasks.md.",
    )
    args = parser.parse_args()

    # Best-effort guard: a non-canonical step is a no-op, never a host failure.
    # Terminal state belongs in `status`, not `currentStep`. Skipped in task-sync
    # mode, which always operates on the implement step.
    if not args.tasks_file and (args.step == "done" or args.step not in CANONICAL_STEPS):
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
        if args.tasks_file:
            tasks_md = Path(args.tasks_file)
            if not tasks_md.is_absolute():
                tasks_md = root / tasks_md
            # Task-sync operates on the implement step; the global --status default
            # ("specified") would be an incoherent terminal status here.
            final_status = args.status if args.status != parser.get_default("status") else "implemented"
            target = sync_tasks(feature_dir, tasks_md, final_status, args.by)
        else:
            target = update_context(feature_dir, args.step, args.status, args.by)
    except Exception as exc:  # noqa: BLE001 - best-effort, swallow + report
        print(f"[companion] Warning: skipped .spec-context.json write: {exc}", file=sys.stderr)
        return 0

    if target is not None and not args.tasks_file:
        print(f"[companion] Updated {target} (currentStep={args.step}, status={args.status}, by={args.by})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
