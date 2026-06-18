# Implementation Plan: finish-and-advance verb

**Branch**: `351-advance-status` | **Spec**: [spec.md](./spec.md)

## Summary

Add an `--advance` verb to the capture script (`speckit-extension/scripts/write-context.py`) that, for a given `--step`, appends the step's completion (idempotent) and flips `status` to that step's canonical completed-status, in one atomic write. No bare `--status` path, no start entry. Centralize the step→status map in one constant. Refuse on a terminal spec, and leave `clarify`/`analyze` status untouched (finish-only).

## Approach

### The map (single source of truth)

Add one module-level constant next to the existing `CANONICAL_STEPS`:

```python
STEP_COMPLETED_STATUS = {
    "specify": "specified",
    "plan": "planned",
    "tasks": "ready-to-implement",
    "implement": "implemented",
}
```

`clarify`/`analyze` are intentionally absent — `.get(step)` returns `None`, meaning "record the finish, don't touch status."

### The verb (`journal_advance`)

A new function that reuses the existing shared preamble and completion helper, so it inherits the terminal-spec guard for free:

- Reject a non-canonical step up front (same message shape as `journal_finish`).
- Open via `_open_ctx_or_none(...)` — this already returns `None` (and stays silent appropriately) for a `completed`/`archived` spec, satisfying FR6 with zero new guard code.
- `append_complete(log, step, by=by, at=now())` — idempotent completion, never a duplicate, never a start.
- Look up `STEP_COMPLETED_STATUS.get(step)`; if present, set `ctx["status"]`. If absent (`clarify`/`analyze`), leave status as-is.
- `commit_log` + `atomic_write`, same as `journal_finish`.
- On a forward flip, set `ctx["currentStep"] = step` alongside the status so the pair stays coherent; on the no-regress path (spec already past the step) leave both untouched. Guard the flip with `_is_more_advanced` so a re-advanced earlier step never drags status/currentStep backward.

### CLI wiring

- Add `--advance` (store_true) to the parser, documented as "finish the step and flip its status to that step's canonical completed-status in one atomic write."
- Dispatch in `main()` before the generic `update_context` branch, alongside `--finish`.
- Add `--advance` to the early "non-canonical step is a no-op" guard's bypass list (it does its own canonical-step check), mirroring `--finish`.
- Add a success print line mirroring the `--finish` one.

### Why this does NOT trip the no-regress guard

The no-regress guard lives in `update_context` / `_is_more_advanced`. `journal_advance` never calls `update_context`; it writes `status` directly via the same append-only, terminal-guarded path `journal_finish` uses. The direct-`--status` guard is therefore unchanged, and `--advance` is the sanctioned forward flip.

## Files changed

- `speckit-extension/scripts/write-context.py` — new constant, new `journal_advance`, CLI flag + dispatch + print + guard-bypass.
- `speckit-extension/tests/test_context.py` — new `AdvanceTests` class.
- `speckit-extension/CHANGELOG.md` — user-facing entry.
- `speckit-extension/extension.yml` — patch version bump.
- `docs/capture-and-timing.md` — note the new one-call status transition if it documents transitions.

## Testing strategy

New `AdvanceTests`: advancing each of specify/plan/tasks/implement flips to the canonical value and appends exactly one completion (no start); idempotent on re-run; refused on completed/archived; clarify/analyze record the finish without changing status. Run the full `test_context` suite plus `test_nodes`, `test_config`, `assemble-nodes.py --check`, `check-shape-parity.py` (scripts-only change → golden command bodies unchanged).
