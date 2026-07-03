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
# The single home for the step -> canonical completed-status map. `--advance`
# flips status to this when finishing a step; clarify/analyze are absent (no
# status advance) so the verb records only the finish for them.
STEP_COMPLETED_STATUS = {
    "specify": "specified",
    "plan": "planned",
    "tasks": "ready-to-implement",
    "implement": "implemented",
}
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


def _repo_root_for(path: Path) -> Path:
    """Repo root that contains `path`, anchoring git on that directory rather than
    cwd — so a write into a sandbox spec dir resolves the sandbox's root, not the
    process cwd. Falls back to the cwd-based root (`_repo_root()`) when git can't
    answer for `path`."""
    try:
        out = subprocess.run(
            ["git", "-C", str(path), "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        if out:
            return Path(out)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return _repo_root()


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


def feature_dir_from_tasks_file(root: Path, tasks_file: str) -> Path:
    """The spec dir that owns a tasks.md is its parent directory.

    In task-sync mode the tasks file is authoritative: the spec whose task list
    was handed in is the spec to settle, regardless of which spec the active-
    feature pointer (env / feature.json / branch) currently names. This is what
    prevents settling the wrong spec when a later spec is "active"."""
    p = Path(tasks_file)
    if not p.is_absolute():
        p = root / p
    return p.parent


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

    # 4. .specify/feature.json -> feature directory. Accept both the canonical
    #    `feature_directory` key and stock spec-kit's `FEATURE_DIR` (the upstream
    #    create-new-feature.sh shape) so a pointer written either way resolves —
    #    otherwise a bare call (e.g. --mark-complete with no --feature-dir) fails
    #    to find the spec even though the pointer is present.
    feature_json = root / ".specify" / "feature.json"
    if feature_json.is_file():
        try:
            data = json.loads(feature_json.read_text(encoding="utf-8"))
            fd = data.get("feature_directory") or data.get("FEATURE_DIR")
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


def _open_ctx_or_none(feature_dir: Path, step: str = "") -> tuple[dict, list, str] | None:
    """Read the context for a finish/journal write, returning `(ctx, log, branch)`
    primed (required keys filled, log migrated forward), or None for a spec that is
    already shipped (completed/archived) and must be left untouched. The shared
    read + cross-step-terminal guard + canonical_log + fill_required preamble of
    journal_finish / journal_task_finish / materialize_log."""
    ctx = read_ctx(feature_dir / ".spec-context.json")
    if ctx.get("status") in CROSS_STEP_TERMINAL:
        # Only the journal paths (which pass a step) announce the skip; materialize
        # passes step="" and stays silent, as it did before this preamble was shared.
        if step:
            print(
                f"[companion] {feature_dir / '.spec-context.json'} already at "
                f"status={ctx.get('status')} (not journaling {step}).",
                file=sys.stderr,
            )
        return None
    branch = _git_branch(_repo_root()) or "main"
    log = canonical_log(ctx)
    fill_required(ctx, feature_dir, branch)
    return ctx, log, branch


def append_complete(
    log: list, step: str, *, substep: str | None = None, task: str | None = None,
    by: str, at: str,
) -> None:
    """Append a `complete` event for (step, substep|task) unless one already exists —
    the single home for the `if not _has_complete(...): log.append(...)` pattern.
    Key order: step, substep, [task], kind, by, at."""
    if not _has_complete(log, step, task if task is not None else substep):
        entry: dict = {"step": step, "substep": substep}
        if task is not None:
            entry["task"] = task
        entry.update({"kind": "complete", "by": by, "at": at})
        log.append(entry)


def _coerce_value(raw: str):
    """Coerce a `--set key=value` string into bool/int/None where it reads as one, else the string."""
    low = raw.lower()
    if low in ("true", "false"):
        return low == "true"
    if low in ("null", "none"):
        return None
    try:
        return int(raw)
    except ValueError:
        return raw


PROTECTED_SET_KEYS = frozenset({"history", "transitions", "status", "currentStep"})


def set_fields(feature_dir: Path, pairs: list[str]) -> Path | None:
    """Merge top-level `key=value` fields onto the existing context, leaving the
    lifecycle log (history, status, currentStep) untouched. Used by auto to record
    `unattended=true` without disturbing it. Lifecycle keys are refused so `--set`
    can never bypass the `--mark-complete` / hook-driven status writers."""
    target = feature_dir / ".spec-context.json"
    branch = _git_branch(_repo_root()) or "main"
    ctx = read_ctx(target)
    fill_required(ctx, feature_dir, branch)
    for pair in pairs:
        if "=" not in pair:
            print(f"[companion] Skipping malformed --set '{pair}' (expected key=value).", file=sys.stderr)
            continue
        key, raw = pair.split("=", 1)
        key = key.strip()
        if not key:
            continue
        if key in PROTECTED_SET_KEYS:
            print(f"[companion] Refusing --set '{key}' — lifecycle keys are managed by the capture/mark-complete writers.", file=sys.stderr)
            continue
        ctx[key] = _coerce_value(raw.strip())
    atomic_write(target, ctx)
    return target


def set_living_specs_loaded(feature_dir: Path, names: list[str]) -> Path | None:
    """Record the capability names whose living specs were loaded into context.

    Merges onto ctx["livingSpecs"]["loaded"] preserving the resolver's
    most-specific-first order and de-duplicating, never rebuilding the record and
    never touching lifecycle keys (livingSpecs is additive metadata the strict
    schema already permits). With no names it is a no-op — opt-out writes nothing."""
    cleaned = [n.strip() for n in names if n and n.strip()]
    if not cleaned:
        return None
    target = feature_dir / ".spec-context.json"
    branch = _git_branch(_repo_root_for(feature_dir)) or "main"
    ctx = read_ctx(target)
    fill_required(ctx, feature_dir, branch)
    block = ctx.get("livingSpecs")
    if not isinstance(block, dict):
        block = {}
    prior = block.get("loaded")
    # De-dupe the FULL list (prior + new), preserving first-occurrence order, so a
    # record carrying pre-existing duplicates is normalized too (truly idempotent).
    merged: list = []
    for n in (list(prior) if isinstance(prior, list) else []) + list(cleaned):
        if n not in merged:
            merged.append(n)
    block["loaded"] = merged
    ctx["livingSpecs"] = block
    atomic_write(target, ctx)
    return target


def set_living_specs_synced(feature_dir: Path, names: list[str]) -> Path | None:
    """Record the capability names whose living specs were folded into on completion.

    Mirrors set_living_specs_loaded: merges onto ctx["livingSpecs"]["synced"]
    de-duplicating and preserving first-seen order, never rebuilding the record
    and never touching lifecycle keys (livingSpecs is additive metadata kept OUT
    of the strict capture schema). With no names it is a no-op — opt-out and the
    no-delta case write nothing."""
    cleaned = [n.strip() for n in names if n and n.strip()]
    if not cleaned:
        return None
    target = feature_dir / ".spec-context.json"
    branch = _git_branch(_repo_root_for(feature_dir)) or "main"
    ctx = read_ctx(target)
    fill_required(ctx, feature_dir, branch)
    block = ctx.get("livingSpecs")
    if not isinstance(block, dict):
        block = {}
    prior = block.get("synced")
    merged: list = []
    for n in (list(prior) if isinstance(prior, list) else []) + list(cleaned):
        if n not in merged:
            merged.append(n)
    block["synced"] = merged
    ctx["livingSpecs"] = block
    atomic_write(target, ctx)
    return target


# --- Reasoning-trail capture --------------------------------------------------
#
# Additive, de-duped, best-effort writers for the run's reasoning trail:
# decisions/verified/concerns (JSON-or-text entry lists), expectations (string
# list), coverage (per-requirement upsert), step_summaries (per-step upsert),
# classification (one object). None touch lifecycle keys; all are idempotent.


def _coerce_entry(raw: str, identity_key: str) -> dict | None:
    """JSON-or-plain-text coercion: a JSON object carrying `identity_key` is kept
    as-is (unknown keys preserved); anything else wraps the raw text under the
    identity key so a weak emitter still captures the signal."""
    text = raw.strip()
    if not text:
        return None
    if text.startswith("{"):
        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            obj = None
        if isinstance(obj, dict):
            ident = obj.get(identity_key)
            if isinstance(ident, str) and ident.strip():
                return obj
    return {identity_key: text}


def _entry_identity(item, identity_key: str) -> str | None:
    """The de-dup key for a stored entry: dicts key on identity_key, bare strings on themselves."""
    if isinstance(item, dict):
        v = item.get(identity_key)
        return v.strip() if isinstance(v, str) else None
    if isinstance(item, str):
        return item.strip()
    return None


def append_capture_entries(
    feature_dir: Path, field: str, identity_key: str, raws: list[str],
) -> Path | None:
    """De-duped additive append onto ctx[field] (decisions/verified/concerns).

    Mirrors set_living_specs_loaded: preserves first-seen order, normalizes
    pre-existing duplicates, never touches lifecycle keys. Bare strings already
    stored (hand-authored) participate in de-dup via their text."""
    entries = [e for e in (_coerce_entry(r, identity_key) for r in raws) if e]
    if not entries:
        return None
    target = feature_dir / ".spec-context.json"
    branch = _git_branch(_repo_root_for(feature_dir)) or "main"
    ctx = read_ctx(target)
    fill_required(ctx, feature_dir, branch)
    prior = ctx.get(field)
    merged: list = []
    seen: set[str] = set()
    for item in (list(prior) if isinstance(prior, list) else []) + entries:
        ident = _entry_identity(item, identity_key)
        if ident is not None:
            if ident in seen:
                continue
            seen.add(ident)
        merged.append(item)
    ctx[field] = merged
    atomic_write(target, ctx)
    return target


def append_string_list(feature_dir: Path, field: str, values: list[str]) -> Path | None:
    """De-duped additive append of plain strings onto ctx[field] (expectations)."""
    cleaned = [v.strip() for v in values if v and v.strip()]
    if not cleaned:
        return None
    target = feature_dir / ".spec-context.json"
    branch = _git_branch(_repo_root_for(feature_dir)) or "main"
    ctx = read_ctx(target)
    fill_required(ctx, feature_dir, branch)
    prior = ctx.get(field)
    merged: list = []
    for v in (list(prior) if isinstance(prior, list) else []) + cleaned:
        if v not in merged:
            merged.append(v)
    ctx[field] = merged
    atomic_write(target, ctx)
    return target


def upsert_coverage(
    feature_dir: Path, req: str, tasks: list[str] | None, tests: list[str] | None,
    title: str | None = None,
) -> Path | None:
    """Upsert ctx["coverage"][req] non-destructively (clone of _upsert_task_summary):
    only a supplied value replaces its slot, so the tasks-complete write (title +
    tasks) and the implement-close write (tests) compose without erasing each other."""
    req = req.strip()
    if not req:
        return None
    title = title.strip() if title else None
    if not tasks and not tests and not title:
        # Nothing to record — writing {} would fake a coverage entry.
        return None
    target = feature_dir / ".spec-context.json"
    branch = _git_branch(_repo_root_for(feature_dir)) or "main"
    ctx = read_ctx(target)
    fill_required(ctx, feature_dir, branch)
    coverage = ctx.get("coverage")
    if not isinstance(coverage, dict):
        coverage = {}
    existing = coverage.get(req)
    entry: dict = dict(existing) if isinstance(existing, dict) else {}
    if title:
        entry["title"] = title
    if tasks:
        entry["tasks"] = tasks
    if tests:
        entry["tests"] = tests
    coverage[req] = entry
    ctx["coverage"] = coverage
    atomic_write(target, ctx)
    return target


def upsert_step_summary(feature_dir: Path, step: str, raw: str) -> Path | None:
    """Upsert ctx["step_summaries"][step] from a JSON-or-text value keyed on `summary`."""
    if step not in CANONICAL_STEPS:
        print(
            f"[companion] Skipping --step-summary: '{step}' is not a canonical step "
            f"({', '.join(sorted(CANONICAL_STEPS))}).",
            file=sys.stderr,
        )
        return None
    entry = _coerce_entry(raw, "summary")
    if entry is None:
        return None
    target = feature_dir / ".spec-context.json"
    branch = _git_branch(_repo_root_for(feature_dir)) or "main"
    ctx = read_ctx(target)
    fill_required(ctx, feature_dir, branch)
    summaries = ctx.get("step_summaries")
    if not isinstance(summaries, dict):
        summaries = {}
    existing = summaries.get(step)
    merged: dict = dict(existing) if isinstance(existing, dict) else {}
    merged.update(entry)
    summaries[step] = merged
    ctx["step_summaries"] = summaries
    atomic_write(target, ctx)
    return target


CLASSIFICATION_VERDICTS = frozenset({"simple", "normal", "oversized"})


def set_classification(feature_dir: Path, raw: str) -> Path:
    """Store the size classification's inputs + verdict as one object.
    Raises ValueError on an unparseable value or missing/unknown verdict —
    the one caller-error case (main maps it to exit 2)."""
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"--classification is not valid JSON: {exc}") from exc
    if not isinstance(obj, dict) or obj.get("verdict") not in CLASSIFICATION_VERDICTS:
        raise ValueError(
            "--classification requires a JSON object with a verdict of simple|normal|oversized."
        )
    target = feature_dir / ".spec-context.json"
    branch = _git_branch(_repo_root_for(feature_dir)) or "main"
    ctx = read_ctx(target)
    fill_required(ctx, feature_dir, branch)
    ctx["classification"] = obj
    atomic_write(target, ctx)
    return target


# --- Living-spec fold-back (LS·3) -------------------------------------------
#
# At mark-complete, fold the feature spec's requirement deltas into the durable
# living spec for the resolved capability. The feature spec was the proposal; the
# living spec becomes the record. Opt-in (livingSpecs.enabled), best-effort, and
# a clean no-op when the feature spec carries no delta block.

# A top-level delta block header: `## ADDED Requirements` (case-insensitive verb).
_DELTA_HEADER_RE = re.compile(
    r"^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$", re.IGNORECASE
)
# A per-block target marker: `<!-- capability: todos -->`.
_CAP_MARKER_RE = re.compile(r"<!--\s*capability:\s*([^\s>]+)\s*-->", re.IGNORECASE)
# A requirement heading inside a block (OpenSpec requirement + scenario shape).
_REQ_HEADING_RE = re.compile(r"^###\s+(.+?)\s*$")
# RENAMED uses `### FROM -> TO` (or `→`) to express the heading rename.
_RENAME_RE = re.compile(r"^(.*?)\s*(?:->|→)\s*(.+)$")


def _split_requirements(block_body: str) -> list[tuple[str, str]]:
    """Split a delta block body into (heading, full_section_text) requirement units.

    A requirement is a `### <heading>` line plus everything up to the next `###`.
    Returns the heading text and the section text (heading line included)."""
    lines = block_body.splitlines()
    reqs: list[tuple[str, str]] = []
    cur_head: str | None = None
    cur_lines: list[str] = []
    for line in lines:
        m = _REQ_HEADING_RE.match(line)
        if m:
            if cur_head is not None:
                reqs.append((cur_head, "\n".join(cur_lines).rstrip() + "\n"))
            cur_head = m.group(1).strip()
            cur_lines = [line]
        elif cur_head is not None:
            cur_lines.append(line)
    if cur_head is not None:
        reqs.append((cur_head, "\n".join(cur_lines).rstrip() + "\n"))
    return reqs


def parse_spec_deltas(spec_text: str) -> dict:
    """Parse top-level delta blocks from a feature spec.

    Returns {"added": [...], "modified": [...], "removed": [...],
    "renamed": [...], "markers": {verb: capability_name}} where each verb list
    holds (heading, section_text) requirement units (REMOVED/RENAMED carry only
    the heading). An empty result (no recognized block) means a clean no-op."""
    out: dict = {"added": [], "modified": [], "removed": [], "renamed": [], "markers": {}}
    lines = spec_text.splitlines()
    cur_verb: str | None = None
    buf: list[str] = []

    def flush() -> None:
        if cur_verb is None:
            return
        body = "\n".join(buf)
        marker = _CAP_MARKER_RE.search(body)
        if marker:
            out["markers"][cur_verb] = marker.group(1).strip()
        if cur_verb == "removed":
            for head, _ in _split_requirements(body):
                out["removed"].append((head, ""))
        elif cur_verb == "renamed":
            for head, _ in _split_requirements(body):
                rm = _RENAME_RE.match(head)
                if rm:
                    out["renamed"].append((rm.group(1).strip(), rm.group(2).strip()))
        else:
            out[cur_verb].extend(_split_requirements(body))

    for line in lines:
        hm = _DELTA_HEADER_RE.match(line)
        if hm:
            flush()
            cur_verb = hm.group(1).lower()
            buf = []
            continue
        # A new top-level `## ` heading (not a delta header) closes the block.
        if line.startswith("## ") and cur_verb is not None:
            flush()
            cur_verb = None
            buf = []
            continue
        if cur_verb is not None:
            buf.append(line)
    flush()
    return out


def _has_deltas(deltas: dict) -> bool:
    return any(deltas[k] for k in ("added", "modified", "removed", "renamed"))


def _living_requirement_span(living_lines: list[str], heading: str) -> tuple[int, int] | None:
    """Find the [start, end) line span of a `### <heading>` requirement in a living
    spec, end being the next `###`/`##` or EOF. Heading match is exact (stripped)."""
    start = None
    for i, line in enumerate(living_lines):
        m = _REQ_HEADING_RE.match(line)
        if m and m.group(1).strip() == heading:
            start = i
            break
    if start is None:
        return None
    end = len(living_lines)
    for j in range(start + 1, len(living_lines)):
        s = living_lines[j]
        if s.startswith("### ") or s.startswith("## "):
            end = j
            break
    return start, end


def apply_deltas(living_text: str, deltas: dict) -> str:
    """Apply ADDED/MODIFIED/REMOVED/RENAMED deltas to a living-spec text.

    ADDED appends a requirement (idempotent — skipped when its heading already
    exists), MODIFIED replaces the matching requirement in place, REMOVED deletes
    it, RENAMED rewrites the matching heading's name. Unmatched MODIFIED/REMOVED/
    RENAMED targets are skipped (best-effort)."""
    lines = living_text.splitlines()

    for old_head, new_head in deltas["renamed"]:
        span = _living_requirement_span(lines, old_head)
        if span:
            i = span[0]
            lines[i] = re.sub(r"^(###\s+).+$", lambda m: m.group(1) + new_head, lines[i])

    for head, _ in deltas["removed"]:
        span = _living_requirement_span(lines, head)
        if span:
            del lines[span[0]:span[1]]

    for head, section in deltas["modified"]:
        span = _living_requirement_span(lines, head)
        if span:
            lines[span[0]:span[1]] = section.rstrip("\n").splitlines()

    appended = "\n".join(lines).rstrip() + "\n"
    for head, section in deltas["added"]:
        if _living_requirement_span(appended.splitlines(), head) is not None:
            continue  # idempotent — already present
        appended = appended.rstrip() + "\n\n" + section.rstrip() + "\n"
    return appended


def _initial_living_spec(capability_name: str) -> str:
    """A minimal well-formed living-spec scaffold for a capability whose spec.md
    doesn't exist yet, so the first ADDED fold creates a titled, sectioned spec
    (the accumulation story LS·4 relies on) rather than a headerless fragment.
    The slug is humanized into a title; ADDED requirements append under
    `## Requirements`."""
    title = capability_name.replace("-", " ").replace("_", " ").strip()
    if title:
        title = title[0].upper() + title[1:]
    else:
        title = capability_name
    return f"# {title} — Living Spec\n\n## Requirements\n"


def _git_changed_files(root: Path) -> list[str]:
    """Files this feature branch changed vs its merge-base with the default branch.

    Best-effort: returns [] if git can't answer (detached/odd checkout, no
    merge-base). On the write-side fold, an empty result means the caller
    (`_resolve_fold_targets`) folds ONLY capabilities named by an explicit
    `<!-- capability: ... -->` marker and never fans out to every durable spec —
    the conservative choice for a write path."""
    for base in ("origin/main", "main", "origin/master", "master"):
        try:
            mb = subprocess.run(
                ["git", "merge-base", base, "HEAD"], cwd=str(root),
                capture_output=True, text=True, check=True,
            ).stdout.strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            continue
        if not mb:
            continue
        try:
            out = subprocess.run(
                ["git", "diff", "--name-only", mb, "HEAD"], cwd=str(root),
                capture_output=True, text=True, check=True,
            ).stdout
        except (subprocess.CalledProcessError, FileNotFoundError):
            return []
        return [f.strip() for f in out.splitlines() if f.strip()]
    return []


def _load_resolver():
    """Import the LS·1 resolver (hyphenated filename) by file path, or None."""
    try:
        import importlib.util
        path = Path(__file__).resolve().parent / "resolve-spec-paths.py"
        spec = importlib.util.spec_from_file_location("resolve_spec_paths", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    except Exception:  # noqa: BLE001 - best-effort
        return None


def _resolve_fold_targets(rsp, living: dict, root: Path, deltas: dict) -> list[dict]:
    """Capabilities to fold into: the most-specific match for the change surface,
    plus any capability explicitly named by a `<!-- capability: <name> -->` marker.

    Write-most-specific: from the (most-specific-first) matched list keep only the
    head. Markered targets are added by name from the full capability set, so a
    block can route to a different/additional capability than the code change
    resolves to. When git can't determine the changed files, this folds ONLY the
    markered capabilities (never fans out to every durable spec) — the conservative
    choice for a write path; the no-changed-files fallback is logged so the
    markers-only narrowing is observable rather than a silent no-op."""
    changed = _git_changed_files(root)
    if not changed:
        print(
            "[companion] Living-spec fold: could not determine changed files; "
            "folding markered capabilities only (no fan-out to all durable specs).",
            file=sys.stderr,
        )
    matched = rsp.match_changed(changed, living, str(root)) if changed else []
    targets: list[dict] = []
    seen: set[str] = set()
    if matched:
        head = matched[0]
        targets.append(head)
        seen.add(head["name"])

    marker_names = {v for v in deltas.get("markers", {}).values() if v}
    if marker_names:
        by_name = {c["name"]: c for c in living["capabilities"]}
        all_entries = rsp.discover_all(living, str(root))
        entry_by_name = {e["name"]: e for e in all_entries}
        for name in marker_names:
            if name in seen:
                continue
            entry = entry_by_name.get(name)
            if entry is None and name in by_name:
                try:
                    entry = rsp._entry(by_name[name], str(root))
                except Exception:  # noqa: BLE001
                    entry = None
            if entry is not None:
                targets.append(entry)
                seen.add(name)
    return targets


def fold_living_spec(feature_dir: Path, by: str) -> Path | None:
    """Fold the feature spec's requirement deltas into the resolved living spec(s).

    Opt-in (livingSpecs.enabled) and best-effort: any miss (feature off, no
    config, no resolver, no delta block, no spec file) is a clean no-op that
    returns None and writes nothing. On a real fold, applies the deltas to each
    target's capabilities/<name>/spec.md, records the synced names onto
    livingSpecs.synced, logs a one-line per-capability summary, and returns the
    updated .spec-context.json path. Idempotent: re-running folds nothing new."""
    root = _repo_root_for(feature_dir)
    rsp = _load_resolver()
    if rsp is None:
        return None
    try:
        living = rsp.load_living(str(root))
    except Exception:  # noqa: BLE001
        return None
    if not living.get("enabled"):
        return None

    spec_md = feature_dir / "spec.md"
    try:
        spec_text = spec_md.read_text(encoding="utf-8")
    except OSError:
        return None
    deltas = parse_spec_deltas(spec_text)
    if not _has_deltas(deltas):
        return None  # common additive case — clean no-op

    try:
        targets = _resolve_fold_targets(rsp, living, root, deltas)
    except Exception:  # noqa: BLE001
        targets = []
    if not targets:
        print(
            "[companion] Living-spec fold: no capability resolved for this change; "
            "nothing folded.",
            file=sys.stderr,
        )
        return None

    synced: list[str] = []
    for cap in targets:
        spec_rel = cap.get("spec")
        if not spec_rel:
            continue
        living_path = root / spec_rel
        try:
            before = living_path.read_text(encoding="utf-8") if living_path.exists() else _initial_living_spec(cap.get("name") or living_path.parent.name)
        except OSError:
            continue
        after = apply_deltas(before, deltas)
        if after == before:
            print(
                f"[companion] Living-spec fold: {cap['name']} already up to date "
                f"({spec_rel}); no change.",
                file=sys.stderr,
            )
            continue
        try:
            living_path.parent.mkdir(parents=True, exist_ok=True)
            living_path.write_text(after, encoding="utf-8")
        except OSError as exc:
            print(f"[companion] Living-spec fold: could not write {spec_rel}: {exc}", file=sys.stderr)
            continue
        synced.append(cap["name"])
        counts = (
            f"+{len(deltas['added'])} added, ~{len(deltas['modified'])} modified, "
            f"-{len(deltas['removed'])} removed, ↻{len(deltas['renamed'])} renamed"
        )
        print(f"[companion] Living-spec fold: {cap['name']} ← {counts} ({spec_rel})", file=sys.stderr)

    if not synced:
        return None
    return set_living_specs_synced(feature_dir, synced)


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


def _mark_tasks_done(tasks_md: Path, ids: set) -> None:
    """Flip `- [ ] **<id>**` → `- [x]` in tasks.md for every journaled task id.

    The script owns the checkboxes so the model (and any subagent) never has to
    edit the shared tasks.md — it only appends its finish to the event log, and
    this single writer derives the checkboxes from that log. Targeted: only a
    *pending* line whose captured id is in `ids` is flipped (idempotent — an
    already-checked line never matches PENDING_TASK_RE), and only that line's
    first `[ ]` is rewritten, so surrounding text is untouched."""
    if not ids or not tasks_md.is_file():
        return
    try:
        lines = tasks_md.read_text(encoding="utf-8").splitlines(keepends=True)
    except OSError:
        return
    changed = False
    for i, line in enumerate(lines):
        m = PENDING_TASK_RE.match(line)
        if m and m.group(1) in ids:
            lines[i] = line.replace("[ ]", "[x]", 1)
            changed = True
    if not changed:
        return
    tmp = tasks_md.with_suffix(tasks_md.suffix + ".tmp")
    try:
        tmp.write_text("".join(lines), encoding="utf-8")
        os.replace(tmp, tasks_md)
    except OSError:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass


def _feature_tasks_at_100(feature_dir: Path) -> bool:
    """True when feature_dir/tasks.md exists, has markers, and every one is checked."""
    tasks_md = feature_dir / "tasks.md"
    if not tasks_md.is_file():
        return False
    return _tasks_at_100(parse_task_markers(tasks_md))


def _gc_events_log(feature_dir: Path) -> None:
    """Remove `.spec-context.events.jsonl` at the terminal `completed` transition —
    the one state after which CROSS_STEP_TERMINAL blocks every further append, so the
    file can't be recreated and a re-run of the spec dir can't re-fold stale lines."""
    try:
        (feature_dir / ".spec-context.events.jsonl").unlink(missing_ok=True)
    except OSError:
        pass


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
        append_complete(log, step, substep=substep, by=by, at=now)
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


def journal_finish(feature_dir: Path, step: str, by: str, substep: str | None = None) -> Path | None:
    """Append a single step- or substep-level **finish** to history and nothing else.

    This is the AI's timing self-close for the steps the lifecycle hooks don't
    close: a step-level finish for plan/tasks/clarify/analyze (substep=None), or a
    substep boundary (plan: research/design; tasks: generate). The capture hooks
    write the step START + status; they do NOT write these completes, so the AI
    has to — and it used to hand-author the JSON, which is what produced a
    duplicate `status` key. Routing it through the script makes the write atomic
    (no malformed file possible) and stops the AI ever editing .spec-context.json
    by hand. Deliberately does NOT touch `status` or `currentStep` (the hooks own
    those) — it only adds the honest finish timestamp. Idempotent on (step, substep);
    best-effort; a genuinely shipped spec (completed/archived) is left untouched."""
    # A finish is only meaningful for a canonical step; reject a typo'd or omitted
    # step (which would otherwise default to "specify" and journal a junk complete).
    if step not in CANONICAL_STEPS:
        print(
            f"[companion] Skipping --finish: '{step}' is not a canonical step "
            f"({', '.join(sorted(CANONICAL_STEPS))}).",
            file=sys.stderr,
        )
        return None
    target = feature_dir / ".spec-context.json"
    opened = _open_ctx_or_none(feature_dir, f"a {step}{('/' + substep) if substep else ''} finish")
    if opened is None:
        return None
    ctx, log, _branch = opened
    append_complete(log, step, substep=substep, by=by, at=_now_iso())
    commit_log(ctx, log)
    atomic_write(target, ctx)
    return target


def journal_advance(feature_dir: Path, step: str, by: str) -> Path | None:
    """Finish a step AND flip status to its canonical completed-status in one write.

    The single-call alternative to `--finish` followed by a status write: it appends
    the step's completion (idempotent — like `--finish`, never a duplicate, never a
    start) and flips `status`/`currentStep` to `STEP_COMPLETED_STATUS[step]`. The flip
    is forward-only: it reuses `_is_more_advanced` so advancing an earlier step on a
    spec that already moved past it (a re-run or a double-fired hook) records the finish
    but never drags status/currentStep backward. A step with no canonical completed-status
    (clarify/analyze) records only the finish, leaving status untouched — mirroring
    `--finish`. Idempotent; a shipped spec is left untouched."""
    if step not in CANONICAL_STEPS:
        print(
            f"[companion] Skipping --advance: '{step}' is not a canonical step "
            f"({', '.join(sorted(CANONICAL_STEPS))}).",
            file=sys.stderr,
        )
        return None
    target = feature_dir / ".spec-context.json"
    opened = _open_ctx_or_none(feature_dir, f"an {step} advance")
    if opened is None:
        return None
    ctx, log, _branch = opened
    append_complete(log, step, by=by, at=_now_iso())
    completed_status = STEP_COMPLETED_STATUS.get(step)
    if completed_status is not None:
        if _is_more_advanced(ctx, step):
            print(
                f"[companion] {target} already at currentStep={ctx.get('currentStep')} / "
                f"status={ctx.get('status')}; recorded the {step} finish without regressing status.",
                file=sys.stderr,
            )
        else:
            ctx["status"] = completed_status
            ctx["currentStep"] = step
    commit_log(ctx, log)
    atomic_write(target, ctx)
    return target


def _upsert_task_summary(
    ctx: dict, task_id: str, did: str | None, files: list[str] | None,
    status: str = "DONE",
) -> None:
    """Upsert `ctx["task_summaries"][task_id]` to the shape the Activity panel reads.

    The Tasks card (`TasksCard.tsx`, fed by `stateDerivation.ts`
    `pickRecord('task_summaries')`) keys the map by task id and reads
    `TaskSummary = { status; did?; files?; concerns? }`. We write exactly that shape
    so a script-journaled task shows up with no hand-authored `.spec-context.json` edit
    — this is the field that was silently absent on turbo runs (it used to depend on a
    skippable AI edit). Idempotent and non-destructive: re-journaling updates the single
    keyed entry, never a duplicate key, and other tasks' summaries are preserved.
    Empty `did`/`files` are omitted so the entry stays minimal but still renders the row.
    """
    summaries = ctx.get("task_summaries")
    if not isinstance(summaries, dict):
        summaries = {}
    existing = summaries.get(task_id)
    # Merge onto the existing entry rather than replacing it: a re-journal must
    # preserve previously-recorded fields (incl. hand-authored `concerns`) and
    # must NOT erase prior `did`/`files` when those flags are omitted this time.
    # Only overwrite a field when a new non-empty value is supplied (backfill).
    entry: dict = dict(existing) if isinstance(existing, dict) else {}
    entry["status"] = status
    if did:
        entry["did"] = did
    if files:
        entry["files"] = files
    summaries[task_id] = entry
    ctx["task_summaries"] = summaries


def _tasks_at_100(markers: tuple[list[str], list[str]]) -> bool:
    """100% verdict from already-parsed `(all_ids, done_ids)` — per-occurrence length
    equality, not set subset (a duplicate id with one marker unchecked isn't 100%)."""
    all_ids, done_ids = markers
    return bool(all_ids) and len(done_ids) == len(all_ids)


def _fold_task_finish(
    ctx: dict, log: list, feature_dir: Path, task_id: str, by: str,
    did: str | None, files: list[str] | None, at: str,
    markers: tuple[list[str], list[str]],
) -> None:
    """Fold one task's finish into ctx+log in place (no I/O). Shared by the live
    read-modify-write path and the append-log materializer, so both produce an
    identical `history` entry and `task_summaries` row. Idempotent on (implement,
    task_id); stamps the history entry with the supplied `at` so a materialized
    line keeps its own real finish time, not the fold time. `markers` is the caller's
    single tasks.md parse, threaded through so the file isn't re-read per task."""
    ctx["currentStep"] = "implement"
    ctx["currentTask"] = task_id
    # At 100% tasks land at `implemented`, not `implementing` — re-asserting `implementing` was the race that left a done spec unmarkable.
    if ctx.get("status") not in ("implemented", "completed", "archived"):
        ctx["status"] = "implemented" if _tasks_at_100(markers) else "implementing"
    append_complete(log, "implement", task=task_id, by=by, at=at)
    _upsert_task_summary(ctx, task_id, did, files)


def _maybe_close_implement(
    ctx: dict, log: list, feature_dir: Path, by: str,
    markers: tuple[list[str], list[str]],
) -> None:
    """Close the implement step once tasks.md is 100% AND every task has a journaled
    finish — never on one signal alone, so a journaled-but-unchecked task can't close
    the step while status is still implementing. `markers` is the caller's single
    tasks.md parse (empty when the file is absent), threaded through to avoid a re-read."""
    all_ids = markers[0]
    distinct = list(dict.fromkeys(all_ids))
    all_done = (
        bool(all_ids)
        and len(distinct) == len(all_ids)
        and _tasks_at_100(markers)
        and set(distinct) <= _journaled_tasks(log)
    )
    if all_done and not _has_complete(log, "implement", None):
        append_complete(log, "implement", by=by, at=_now_iso())
        # Keep status consistent with the closed step. The fold that ran before
        # the script checked the boxes may have left status at `implementing`
        # (tasks.md wasn't 100% yet); now that the step is closing, it's implemented.
        if ctx.get("status") not in ("completed", "archived"):
            ctx["status"] = "implemented"


def journal_task_finish(
    feature_dir: Path, task_id: str, by: str,
    did: str | None = None, files: list[str] | None = None,
) -> Path | None:
    """Append a SINGLE finish event for one implement task (finish-only model).

    Called live by the assistant after each task (`--task <id> --kind complete`).
    The delta to the previous finish (or the implement start) is the task's real
    duration — no start/complete pair, so a task can never collapse to a 0s tick.
    Idempotent (skips a task already closed) and same-step safe: it journals even
    when implement already self-closed to `implemented`; only a genuinely shipped
    spec (completed/archived) is left untouched.

    This is the read-modify-write path. For parallel runs the assistant uses the
    append path (`--append`) instead, which writes a line to `.spec-context.events.jsonl`
    with no read, and `--materialize` folds those lines through the same core here.

    Also writes `task_summaries.<task_id>` (the field the Activity panel's Tasks card
    reads) in the SAME atomic write, from `--did`/`--files`, so the panel is populated
    by the script call rather than a separately-skippable AI edit.
    """
    target = feature_dir / ".spec-context.json"
    opened = _open_ctx_or_none(feature_dir, f"task {task_id}")
    if opened is None:
        return None
    ctx, log, _branch = opened
    tasks_md = feature_dir / "tasks.md"
    _mark_tasks_done(tasks_md, {task_id})
    # One parse after the checkbox flip, shared by the fold's status verdict and the close check.
    markers = parse_task_markers(tasks_md)
    _fold_task_finish(ctx, log, feature_dir, task_id, by, did, files, _now_iso(), markers=markers)
    _maybe_close_implement(ctx, log, feature_dir, by, markers=markers)
    commit_log(ctx, log)
    atomic_write(target, ctx)
    return target


def append_task_log(
    feature_dir: Path, task_id: str, by: str,
    did: str | None = None, files: list[str] | None = None,
) -> Path | None:
    """Append ONE task-finish line to `.spec-context.events.jsonl`. The only WRITE
    is the append, so concurrent workers (subagents) each record themselves without
    contending — a single `O_APPEND` write of a short line is atomic across appenders
    on POSIX, and parallel finishes never interleave. (It reads `.spec-context.json`
    once to skip a shipped spec, but never rewrites it — concurrent reads don't
    contend, and the atomic temp+rename materialize never exposes a partial file.)

    The line carries its own `at` timestamp (real finish time) plus `did`/`files`,
    so `--materialize` can fold it later with the task's true duration preserved.
    This path never closes the step or updates status — that happens at fold time.
    A genuinely shipped spec (completed/archived) is left untouched, so a stray
    late append can't orphan a post-completion line into the events log.
    """
    if read_ctx(feature_dir / ".spec-context.json").get("status") in CROSS_STEP_TERMINAL:
        print(
            f"[companion] {feature_dir} already shipped; not appending task {task_id}.",
            file=sys.stderr,
        )
        return None
    log_path = feature_dir / ".spec-context.events.jsonl"
    entry: dict = {
        "step": "implement",
        "substep": None,
        "task": task_id,
        "kind": "complete",
        "by": by,
        "at": _now_iso(),
    }
    if did:
        entry["did"] = did
    if files:
        entry["files"] = files
    line = json.dumps(entry, ensure_ascii=False) + "\n"
    with open(log_path, "a", encoding="utf-8") as fh:
        fh.write(line)
    return log_path


def materialize_log(feature_dir: Path, by: str, quiet: bool = False) -> Path | None:
    """Fold every appended task-finish line into `.spec-context.json` in one write.

    Replays each `.spec-context.events.jsonl` line through `_fold_task_finish`, so the
    materialized `history`/`task_summaries` are byte-identical to what the live path
    would have produced — only batched into a single read-modify-write instead of one
    per task. Idempotent: dedup on (implement, task_id) means re-folding the whole log
    (per batch and again at step close) never double-counts. Leaves a genuinely shipped
    spec untouched. No log file → nothing to fold."""
    log_path = feature_dir / ".spec-context.events.jsonl"
    if not log_path.is_file():
        return None
    target = feature_dir / ".spec-context.json"
    opened = _open_ctx_or_none(feature_dir)
    if opened is None:
        return None
    ctx, log, _branch = opened
    tasks_md = feature_dir / "tasks.md"
    markers = parse_task_markers(tasks_md)
    folded = 0
    for raw in log_path.read_text(encoding="utf-8").splitlines():
        raw = raw.strip()
        if not raw:
            continue
        try:
            e = json.loads(raw)
        except json.JSONDecodeError:
            continue  # tolerate a torn line; the rest still fold
        tid = e.get("task")
        if not tid:
            continue
        _fold_task_finish(
            ctx, log, feature_dir, tid, e.get("by", by),
            e.get("did"), e.get("files"), e.get("at") or _now_iso(),
            markers=markers,
        )
        folded += 1
    # The script owns the checkboxes: flip tasks.md `[ ]` → `[x]` for every
    # journaled task (single writer, so parallel subagents that only append are
    # race-free). Must run BEFORE the step-close check, which reads tasks.md.
    _mark_tasks_done(tasks_md, _journaled_tasks(log))
    _maybe_close_implement(ctx, log, feature_dir, by, markers=parse_task_markers(tasks_md))
    commit_log(ctx, log)
    atomic_write(target, ctx)
    if not quiet:
        print(
            f"[companion] Materialized {folded} task line(s) from {log_path.name} into {target}.",
            file=sys.stderr,
        )
    return target


def mark_spec_complete(feature_dir: Path, by: str) -> Path | None:
    """Promote a finished spec to the terminal `completed` status.

    This is the only sanctioned writer of `status: completed`. The Companion
    workflow's terminal `mark-complete` node dispatches the command that calls
    this; the AI never hand-writes `completed`. `update_context` deliberately
    refuses to advance a spec whose status is already terminal (`implemented`),
    so the final promotion needs this dedicated path. `currentStep` stays at
    `implement` (the last real step), keeping the canonical invariant that the
    last `history` entry's step equals `currentStep`.

    Source state: promotes a spec that has finished implement (`status ==
    "implemented"`), and also one still `implementing` whose tasks are **all
    checked off** — that 100%-done spec is finished in fact, so it advances
    implementing → implemented → completed in a single atomic write (the
    implement step is closed in `history` first; no distinct `implemented` status
    is persisted — the status goes straight to `completed`).
    A spec still `specifying` / `planning`, or `implementing` with work left, is
    not done, so a stray or out-of-order invocation can never "ship" incomplete
    work. Idempotent: a spec already `completed`/`archived` is left untouched.
    """
    target = feature_dir / ".spec-context.json"
    ctx = read_ctx(target)
    branch = _git_branch(_repo_root()) or "main"

    if ctx.get("status") in CROSS_STEP_TERMINAL:
        print(
            f"[companion] {target} already at status={ctx.get('status')}; "
            f"nothing to mark complete.",
            file=sys.stderr,
        )
        return None

    status = ctx.get("status")
    from_implementing_at_100 = status == "implementing" and _feature_tasks_at_100(feature_dir)
    if status != "implemented" and not from_implementing_at_100:
        print(
            f"[companion] {target} is at status={status!r} with implement not "
            f"finished; refusing to mark complete (only a finished implement step, "
            f"or an implementing spec with every task checked, can be shipped).",
            file=sys.stderr,
        )
        return None

    # Fold any still-pending appended finishes into the json before the GC below
    # removes the events log — a straggler line appended after step-close would
    # otherwise be dropped. Idempotent and quiet (internal prerequisite); re-read
    # so the folded entries are in scope.
    materialize_log(feature_dir, by, quiet=True)
    ctx = read_ctx(target)

    log = canonical_log(ctx)
    fill_required(ctx, feature_dir, branch)
    ctx.setdefault("currentStep", "implement")
    # Promoting straight from implementing@100%: close the implement step first so the canonical `implemented` state exists before `completed`.
    if from_implementing_at_100:
        append_complete(log, "implement", by=by, at=_now_iso())
    ctx["status"] = "completed"
    commit_log(ctx, log)
    atomic_write(target, ctx)
    _gc_events_log(feature_dir)
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

    # Fold any appended task lines first (idempotent) so a parallel run that used
    # the append path but skipped --materialize still gets its did/files into the
    # json before this marker-based backstop fills the rest.
    materialize_log(feature_dir, by)
    ctx = read_ctx(target)

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
    # Per-occurrence verdict (same single source as _maybe_close_implement): a
    # duplicate id with one marker still unchecked must not read as 100%.
    all_done = _tasks_at_100((all_ids, done_ids))
    ctx["status"] = final_status if all_done else "implementing"

    pending = [tid for tid in distinct_all if tid not in distinct_done]
    ctx["currentTask"] = (pending[0] if pending else (distinct_done[-1] if distinct_done else None))

    # Finish-only backstop: append ONE finish per fresh task (no start/complete
    # pair → no 0s tick). The live path (`--task <id> --kind complete`) already
    # journaled tasks captured during the run; `_journaled_tasks` skips those, so
    # this only fills gaps. Each is stamped with the script's own real clock.
    for tid in fresh:
        append_complete(log, "implement", task=tid, by=by, at=_now_iso())

    # Close the implement step itself once every marker is checked off — the hook
    # owns the implement self-close (the AI is told not to write it), so its end is
    # a real script timestamp, not the next step's start.
    if all_done:
        append_complete(log, "implement", by=by, at=_now_iso())
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
    parser.add_argument(
        "--append", action="store_true",
        help="With --task: append the finish to .spec-context.events.jsonl (no read of "
             ".spec-context.json) so parallel workers never contend. Fold later with --materialize.",
    )
    parser.add_argument(
        "--materialize", action="store_true",
        help="Fold every appended .spec-context.events.jsonl task line into .spec-context.json "
             "in one write (idempotent). Run after each batch and at step close.",
    )
    parser.add_argument(
        "--mark-complete", action="store_true",
        help="Promote a finished spec to the terminal status 'completed' "
             "(the only sanctioned writer of completed; keeps currentStep=implement).",
    )
    parser.add_argument(
        "--finish", action="store_true",
        help="Append a pure timing finish for --step (and optional --substep) to history "
             "without touching status/currentStep — the AI's self-close for plan/tasks/"
             "clarify/analyze and their substeps. Replaces hand-authored JSON edits.",
    )
    parser.add_argument(
        "--advance", action="store_true",
        help="Finish --step AND flip status to that step's canonical completed-status "
             "(specify->specified, plan->planned, tasks->ready-to-implement, "
             "implement->implemented) in one atomic write. No start entry; idempotent. "
             "clarify/analyze record only the finish (no status change).",
    )
    parser.add_argument(
        "--did", default=None,
        help="With --task: a one-line summary of what the task did, written to "
             "task_summaries.<id>.did (the Activity panel's Tasks card).",
    )
    parser.add_argument(
        "--files", default=None,
        help="With --task: comma-separated files the task touched, written to "
             "task_summaries.<id>.files.",
    )
    parser.add_argument(
        "--set", dest="set_pairs", action="append", default=None, metavar="KEY=VALUE",
        help="Merge a top-level key=value onto .spec-context.json (e.g. --set unattended=true). "
             "Repeatable. Lifecycle keys (history/status/currentStep) are refused.",
    )
    parser.add_argument(
        "--living-specs", dest="living_specs", action="append", default=None, metavar="NAME",
        help="Record a loaded living-specs capability name onto livingSpecs.loaded "
             "(most-specific-first order, de-duped). Repeatable. Additive metadata; "
             "never a lifecycle key.",
    )
    parser.add_argument(
        "--fold-living-spec", dest="fold_living_spec", action="store_true",
        help="Fold this feature spec's ADDED/MODIFIED/REMOVED/RENAMED requirement "
             "deltas into the resolved capability's living spec (LS·3 archive-as-merge). "
             "Opt-in (livingSpecs.enabled), best-effort, no-op without a delta block, "
             "idempotent. Records synced names onto livingSpecs.synced.",
    )
    parser.add_argument(
        "--decision", dest="decisions", action="append", default=None, metavar="JSON|TEXT",
        help="Append a decision to decisions[] (de-duped on the decision text). "
             "JSON object with a 'decision' key (plus why/rejected), or bare text. Repeatable.",
    )
    parser.add_argument(
        "--verified", dest="verified", action="append", default=None, metavar="JSON|TEXT",
        help="Append a verification to verified[] (de-duped on 'what'). "
             "JSON object with a 'what' key (plus result/command/warnings), or bare text. Repeatable.",
    )
    parser.add_argument(
        "--concern", dest="concerns", action="append", default=None, metavar="JSON|TEXT",
        help="Append a concern to concerns[] (de-duped on 'note'). "
             "JSON object with a 'note' key (plus step/kind), or bare text. Repeatable.",
    )
    parser.add_argument(
        "--expectation", dest="expectations", action="append", default=None, metavar="TEXT",
        help="Append an out-of-scope/non-goal string to expectations[] (de-duped). Repeatable.",
    )
    parser.add_argument(
        "--context", dest="context_entries", action="append", default=None, metavar="TEXT",
        help="Append a context entry to context[] — what the run worked from (a loaded "
             "living spec, an investigated area, a constraint). De-duped. Repeatable.",
    )
    parser.add_argument(
        "--coverage-req", dest="coverage_req", default=None, metavar="REQ_ID",
        help="Upsert coverage.<REQ_ID> with --tasks and/or --tests (non-destructive merge: "
             "only a supplied list replaces its slot).",
    )
    parser.add_argument(
        "--tests", dest="coverage_tests", default=None,
        help="With --coverage-req: comma-separated test refs covering the requirement.",
    )
    parser.add_argument(
        "--tasks", dest="coverage_tasks", default=None,
        help="With --coverage-req: comma-separated task ids covering the requirement.",
    )
    parser.add_argument(
        "--title", dest="coverage_title", default=None,
        help="With --coverage-req: the requirement's one-line text, so requirements "
             "are captured as readable content, not just ids.",
    )
    parser.add_argument(
        "--step-summary", dest="step_summary", default=None, metavar="JSON|TEXT",
        help="Upsert step_summaries.<--step> from a JSON object with a 'summary' key "
             "(plus key_finding/risks) or bare text.",
    )
    parser.add_argument(
        "--classification", dest="classification", default=None, metavar="JSON",
        help="Store the size classification object {projectedFiles, projectedTasks, "
             "scopeSignal, verdict}; verdict (simple|normal|oversized) is required.",
    )
    args = parser.parse_args()

    # Best-effort guard: a non-canonical step is a no-op, never a host failure.
    # Terminal state belongs in `status`, not `currentStep`. Skipped in task-sync
    # mode, which always operates on the implement step.
    capture_mode = bool(
        args.decisions or args.verified or args.concerns or args.expectations
        or args.coverage_req or args.step_summary or args.classification or args.context_entries
    )
    if not args.tasks_file and not args.task and not args.mark_complete and not args.set_pairs and not args.living_specs and not args.fold_living_spec and not args.materialize and not args.finish and not args.advance and not capture_mode and (args.step == "done" or args.step not in CANONICAL_STEPS):
        print(
            f"[companion] Skipping: '{args.step}' is not a canonical currentStep "
            f"({', '.join(sorted(CANONICAL_STEPS))}).",
            file=sys.stderr,
        )
        return 0

    root = _repo_root()

    # Task-sync mode: the `--tasks-file` parent is the authoritative spec dir.
    # The active-feature pointer (env / feature.json / branch) can name a LATER
    # spec while settling an earlier one, so trusting it here writes completion
    # into the wrong spec. When `--feature-dir` is also given and disagrees with
    # the tasks file's dir, refuse to write (surface the mismatch) rather than
    # silently picking one.
    if args.tasks_file:
        tf_dir = feature_dir_from_tasks_file(root, args.tasks_file)
        if args.feature_dir:
            explicit_dir = resolve_feature_dir(root, args.feature_dir)
            if explicit_dir is not None and explicit_dir.resolve() != tf_dir.resolve():
                print(
                    f"[companion] --feature-dir ({explicit_dir}) and --tasks-file dir "
                    f"({tf_dir}) disagree; refusing to write to avoid settling the "
                    f"wrong spec. Drop --feature-dir or point --tasks-file at its tasks.md.",
                    file=sys.stderr,
                )
                return 0
        feature_dir: Path | None = tf_dir
    else:
        feature_dir = resolve_feature_dir(root, args.feature_dir)

    if feature_dir is None or not feature_dir.is_dir():
        print(
            "[companion] Could not resolve the active feature directory "
            "(checked --feature-dir, SPECIFY_FEATURE_DIRECTORY, SPECIFY_FEATURE, "
            ".specify/feature.json, git branch prefix). Skipping context write.",
            file=sys.stderr,
        )
        return 0  # best-effort: never fail the host command

    # Caller-error validation for --classification (exit 2, per the capture contract):
    # a malformed classification is a bug in the emitting body, not a runtime miss.
    if args.classification:
        try:
            target = set_classification(feature_dir, args.classification)
        except ValueError as exc:
            print(f"[companion] {exc}", file=sys.stderr)
            return 2
        print(f"[companion] Recorded classification in {target}")
        return 0

    # Never let a bookkeeping write fail the host spec-kit command.
    try:
        if args.set_pairs:
            target = set_fields(feature_dir, args.set_pairs)
        elif args.decisions:
            target = append_capture_entries(feature_dir, "decisions", "decision", args.decisions)
        elif args.verified:
            target = append_capture_entries(feature_dir, "verified", "what", args.verified)
        elif args.concerns:
            target = append_capture_entries(feature_dir, "concerns", "note", args.concerns)
        elif args.expectations:
            target = append_string_list(feature_dir, "expectations", args.expectations)
        elif args.context_entries:
            target = append_string_list(feature_dir, "context", args.context_entries)
        elif args.coverage_req:
            cov_tasks = (
                [t.strip() for t in args.coverage_tasks.split(",") if t.strip()]
                if args.coverage_tasks else None
            )
            cov_tests = (
                [t.strip() for t in args.coverage_tests.split(",") if t.strip()]
                if args.coverage_tests else None
            )
            target = upsert_coverage(feature_dir, args.coverage_req, cov_tasks, cov_tests, args.coverage_title)
        elif args.step_summary:
            target = upsert_step_summary(feature_dir, args.step, args.step_summary)
        elif args.living_specs:
            target = set_living_specs_loaded(feature_dir, args.living_specs)
        elif args.fold_living_spec:
            target = fold_living_spec(feature_dir, args.by)
        elif args.tasks_file:
            tasks_md = Path(args.tasks_file)
            if not tasks_md.is_absolute():
                tasks_md = root / tasks_md
            # Task-sync operates on the implement step; the global --status default
            # ("specified") would be an incoherent terminal status here.
            final_status = args.status if args.status != parser.get_default("status") else "implemented"
            target = sync_tasks(feature_dir, tasks_md, final_status, args.by)
        elif args.mark_complete:
            target = mark_spec_complete(feature_dir, args.by)
        elif args.finish:
            target = journal_finish(feature_dir, args.step, args.by, args.substep)
        elif args.advance:
            target = journal_advance(feature_dir, args.step, args.by)
        elif args.materialize:
            target = materialize_log(feature_dir, args.by)
        elif args.task:
            files = (
                [f.strip() for f in args.files.split(",") if f.strip()]
                if args.files else None
            )
            did = args.did.strip() if args.did else None
            if args.append:
                target = append_task_log(feature_dir, args.task, args.by, did, files)
            else:
                target = journal_task_finish(feature_dir, args.task, args.by, did, files)
        else:
            target = update_context(feature_dir, args.step, args.status, args.by, args.kind, args.substep)
    except Exception as exc:  # noqa: BLE001 - best-effort, swallow + report
        print(f"[companion] Warning: skipped .spec-context.json write: {exc}", file=sys.stderr)
        return 0

    if target is None and args.fold_living_spec:
        print("[companion] Living-spec fold: nothing to fold (no delta block, feature off, no capability resolved, or the living spec is already up to date).", file=sys.stderr)

    if target is not None and not args.tasks_file:
        if args.set_pairs:
            print(f"[companion] Set {', '.join(args.set_pairs)} in {target}")
        elif args.decisions:
            print(f"[companion] Recorded {len(args.decisions)} decision(s) in {target}")
        elif args.verified:
            print(f"[companion] Recorded {len(args.verified)} verification(s) in {target}")
        elif args.concerns:
            print(f"[companion] Recorded {len(args.concerns)} concern(s) in {target}")
        elif args.expectations:
            print(f"[companion] Recorded {len(args.expectations)} expectation(s) in {target}")
        elif args.context_entries:
            print(f"[companion] Recorded {len(args.context_entries)} context entr(y/ies) in {target}")
        elif args.coverage_req:
            print(f"[companion] Upserted coverage for {args.coverage_req} in {target}")
        elif args.step_summary:
            print(f"[companion] Recorded {args.step} step summary in {target}")
        elif args.living_specs:
            print(f"[companion] Recorded loaded living specs ({', '.join(args.living_specs)}) in {target}")
        elif args.fold_living_spec:
            ctx = read_ctx(target)
            synced = ((ctx.get("livingSpecs") or {}).get("synced")) or []
            print(f"[companion] Folded feature deltas into living spec(s): {', '.join(synced)} ({target})")
        elif args.mark_complete:
            print(f"[companion] Marked {target} complete (status=completed, by={args.by})")
        elif args.finish:
            _label = f"{args.step}{('/' + args.substep) if args.substep else ''}"
            print(f"[companion] Journaled {_label} finish in {target} (by={args.by})")
        elif args.advance:
            print(f"[companion] Advanced {args.step} in {target} (by={args.by})")
        elif args.materialize:
            print(f"[companion] Materialized append-log into {target}")
        elif args.task and args.append:
            print(f"[companion] Appended finish for task {args.task} to {target} (by={args.by})")
        elif args.task:
            print(f"[companion] Journaled finish for task {args.task} in {target} (by={args.by})")
        else:
            print(f"[companion] Updated {target} (currentStep={args.step}, status={args.status}, kind={args.kind}, by={args.by})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
