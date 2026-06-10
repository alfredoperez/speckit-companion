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
# Narrower guard for per-task / backstop writes: "implemented" is the implement
# step's own same-step terminal, so per-task journaling is still allowed there;
# only a genuinely shipped spec (completed/archived) is left untouched.
CROSS_STEP_TERMINAL = {"completed", "archived"}

PREFIX_RE = re.compile(r"^(\d+)-")


def _now_iso() -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


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


def fill_required(ctx: dict, feature_dir: Path, branch: str) -> None:
    """Set required keys only when missing (read-then-merge preserves the rest)."""
    ctx.setdefault("workflow", "speckit")
    ctx.setdefault("specName", _spec_name(feature_dir))
    ctx.setdefault("branch", branch)


# `**` is optional: matches the turbo/companion bold form `- [x] **T001**` AND the
# standard tasks-template plain form `- [x] T001 …`. A `T\d+` is still required right
# after the checkbox, so non-task checkboxes never false-match.
COMPLETED_TASK_RE = re.compile(r"^\s*[-*]\s*\[[xX]\]\s*(?:\*\*)?(T\d+)")
PENDING_TASK_RE = re.compile(r"^\s*[-*]\s*\[\s\]\s*(?:\*\*)?(T\d+)")


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


def _entry_kind(e: dict) -> str:
    """The entry's kind. Legacy `transitions[]`/pre-`kind` migrated entries may
    carry no explicit `kind`; there the old convention is that a self-loop
    (`from.step == step` with the matching substep) is a completion and anything
    else is a start. Inferring it keeps the dedup correct on migrated specs."""
    k = e.get("kind")
    if k in ("start", "complete"):
        return k
    frm = e.get("from") or {}
    if frm.get("step") == e.get("step") and frm.get("substep") == e.get("substep"):
        return "complete"
    return "start"


def _is_step_level(e: dict) -> bool:
    """A step-level boundary entry: no substep and no per-task id. The single
    Python expression of the rule TypeScript's `isStepLevelEntry` owns."""
    return e.get("substep") is None and e.get("task") is None


def _is_per_task(e: dict) -> bool:
    """A per-task implement finish: carries a `task` id (`isPerTaskEntry`)."""
    return e.get("task") is not None


def _has_step_start(log: list, step: str, substep: object = None) -> bool:
    """True if a `start` for `(step, substep)` already exists. A step (or a folded
    substep entry) is started once; this collapses every redundant start — the
    GUI's startStep, the body's own start call, and the after_specify hook-start
    that lands AFTER the body already self-closed specify (which the old
    last-entry-only dedup missed, since the preceding entry was the complete). The
    `substep` arg keeps a folded fast-path start (substep="fast-path") idempotent
    without colliding with the step-level (substep None) start."""
    return any(
        isinstance(e, dict)
        and e.get("step") == step
        and e.get("substep") == substep
        and not _is_per_task(e)
        and _entry_kind(e) == "start"
        for e in log
    )


def _has_complete(log: list, step: str, task: object = None) -> bool:
    """True if a `complete` for (step, task) already exists. task=None matches the
    step-level complete (substep None); a task id matches that per-task complete.
    Per-task entries are keyed on `task` (the canonical id); a legacy record that
    still mirrors the id into `substep` matches via the fallback. Makes
    script-driven completes idempotent — it absorbs the GUI's guarded completeStep,
    re-runs, the per-task backstop double-writing a task, and a legacy self-loop
    completion entry on a migrated spec."""
    def _matches(e: dict) -> bool:
        if task is None:
            # Step-level complete only. A per-task finish now also has substep None
            # (the id lives in `task`), so it must NOT count as the step's complete —
            # otherwise the first task finish would skip the real step close and leave
            # the step permanently in-flight.
            return _is_step_level(e)
        return e.get("task") == task or e.get("substep") == task
    return any(
        isinstance(e, dict)
        and e.get("step") == step
        and _matches(e)
        and _entry_kind(e) == "complete"
        for e in log
    )


def update_context(
    feature_dir: Path, step: str, status: str, by: str, kind: str = "start",
    substep: str | None = None,
) -> Path | None:
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
    fill_required(ctx, feature_dir, branch)

    ctx["currentStep"] = step
    ctx["status"] = status

    if kind == "complete":
        # Deterministic self-close. Idempotent: skip if the step is already closed,
        # so the body's `--kind complete` and the GUI's guarded completeStep (or a
        # re-run) never produce two completes. No `from` on a complete. A `substep`
        # ("fast-path") folds plan/tasks into the specify run; it dedups on (step,
        # substep) so it never collides with a real step-level complete.
        if not _has_complete(log, step, substep):
            log.append({
                "step": step,
                "substep": substep,
                "kind": "complete",
                "by": by,
                "at": now,
            })
    else:
        # A step is started once. Skip a redundant start if this (step, substep)
        # already has a start anywhere in the log — this collapses the GUI startStep +
        # the body start + the late after_specify hook-start into one entry.
        if not _has_step_start(log, step, substep):
            log.append({
                "step": step,
                "substep": substep,
                "kind": "start",
                "by": by,
                "at": now,
            })
    commit_log(ctx, log)

    atomic_write(target, ctx)
    return target


def journal_task_finish(feature_dir: Path, task_id: str, by: str) -> Path | None:
    """Append a SINGLE finish event for one implement task (finish-only model).

    Called live by the assistant after each task (`--task <id> --kind complete`).
    The delta to the previous finish (or the implement start) is the task's real
    duration — no start/complete pair, so a task can never collapse to a 0s tick.
    Idempotent (skips a task already closed) and same-step safe: it journals even
    when implement already self-closed to `implemented`; only a genuinely shipped
    spec (completed/archived) is left untouched.
    """
    target = feature_dir / ".spec-context.json"
    ctx = read_ctx(target)
    branch = _git_branch(_repo_root()) or "main"

    if ctx.get("status") in CROSS_STEP_TERMINAL:
        print(
            f"[companion] {target} already at status={ctx.get('status')}; "
            f"not journaling task {task_id}.",
            file=sys.stderr,
        )
        return None

    log = canonical_log(ctx)
    fill_required(ctx, feature_dir, branch)
    ctx["currentStep"] = "implement"
    ctx["currentTask"] = task_id
    if ctx.get("status") not in ("implemented", "completed", "archived"):
        ctx["status"] = "implementing"

    if not _has_complete(log, "implement", task_id):
        log.append({
            "step": "implement",
            "substep": None,
            "task": task_id,
            "kind": "complete",
            "by": by,
            "at": _now_iso(),
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

    # Same-step safe: journal per-task even when implement already self-closed
    # (status "implemented"), so the backstop fills the journal regardless of AI
    # behavior. Only a genuinely shipped spec (completed/archived) is left alone.
    if ctx.get("status") in CROSS_STEP_TERMINAL:
        print(
            f"[companion] {target} already at status={ctx.get('status')}; "
            f"not regressing to implement.",
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

    pending = [tid for tid in distinct_all if tid not in distinct_done]
    ctx["currentTask"] = (pending[0] if pending else (distinct_done[-1] if distinct_done else None))

    # Finish-only backstop: append ONE finish per fresh task (no start/complete
    # pair → no 0s tick). The live path (`--task <id> --kind complete`) already
    # journaled tasks captured during the run; `_journaled_tasks` skips those, so
    # this only fills gaps. Each is stamped with the script's own real clock.
    for tid in fresh:
        log.append({
            "step": "implement",
            "substep": None,
            "task": tid,
            "kind": "complete",
            "by": by,
            "at": _now_iso(),
        })

    # Close the implement step itself once every marker is checked off — the hook
    # owns the implement self-close (the AI is told not to write it), so its end is
    # a real script timestamp, not the next step's start.
    if all_done and not _has_complete(log, "implement", None):
        log.append({
            "step": "implement",
            "substep": None,
            "kind": "complete",
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
    parser.add_argument("--kind", default="start", choices=["start", "complete"])
    parser.add_argument(
        "--substep", default=None,
        help="Tag the step-level start/complete with a substep (e.g. 'fast-path' "
             "to fold plan/tasks into the specify run).",
    )
    parser.add_argument("--feature-dir", default=None)
    parser.add_argument(
        "--tasks-file", default=None,
        help="Per-task journaling: append a transition per completed marker in this tasks.md.",
    )
    parser.add_argument(
        "--task", default=None,
        help="Per-task finish (finish-only): append one complete event for this task id.",
    )
    args = parser.parse_args()

    # Best-effort guard: a non-canonical step is a no-op, never a host failure.
    # Terminal state belongs in `status`, not `currentStep`. Skipped in task-sync
    # mode, which always operates on the implement step.
    if not args.tasks_file and not args.task and (args.step == "done" or args.step not in CANONICAL_STEPS):
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
        elif args.task:
            target = journal_task_finish(feature_dir, args.task, args.by)
        else:
            target = update_context(feature_dir, args.step, args.status, args.by, args.kind, args.substep)
    except Exception as exc:  # noqa: BLE001 - best-effort, swallow + report
        print(f"[companion] Warning: skipped .spec-context.json write: {exc}", file=sys.stderr)
        return 0

    if target is not None and not args.tasks_file:
        if args.task:
            print(f"[companion] Journaled finish for task {args.task} in {target} (by={args.by})")
        else:
            print(f"[companion] Updated {target} (currentStep={args.step}, status={args.status}, kind={args.kind}, by={args.by})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
