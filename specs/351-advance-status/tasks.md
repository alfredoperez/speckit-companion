# Tasks: finish-and-advance verb

**Branch**: `351-advance-status` | **Plan**: [plan.md](./plan.md)

Tasks are grouped by the user stories they serve. Within a group, file-disjoint tasks marked `[P]` may run in parallel.

## Phase 1 — Core verb (US1, US2, US3)

- [x] **T001** Add the `STEP_COMPLETED_STATUS` map constant next to `CANONICAL_STEPS` in `speckit-extension/scripts/write-context.py` (specify→specified, plan→planned, tasks→ready-to-implement, implement→implemented).
- [x] **T002** Add the `journal_advance(feature_dir, step, by)` function: reject non-canonical step, open via `_open_ctx_or_none` (inherits the terminal-spec guard → US3), append idempotent completion (no start), then flip status + currentStep from the map forward-only (guarded by `_is_more_advanced`) when present and leave status untouched when absent (clarify/analyze → US2), then `commit_log` + `atomic_write`.

## Phase 2 — CLI wiring (US1)

- [x] **T003** Add the `--advance` flag to the argument parser with a help string, add it to the early non-canonical-step no-op guard's bypass list, dispatch it in `main()` before the generic branch, and add a success print line — all mirroring `--finish`.

## Phase 3 — Tests

- [x] **T004 [P]** Add `AdvanceTests` to `speckit-extension/tests/test_context.py`: advancing each of specify/plan/tasks/implement flips status to the canonical value and appends exactly one completion with no start entry.
- [x] **T005 [P]** Add idempotency, terminal-refusal, and clarify/analyze-finish-only test cases to `AdvanceTests`.

## Phase 4 — Docs

- [x] **T006** Add a user-facing entry to `speckit-extension/CHANGELOG.md` and bump the patch version in `speckit-extension/extension.yml`; update `docs/capture-and-timing.md` if it documents status transitions.
