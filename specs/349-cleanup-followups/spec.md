# Feature Specification: Cleanup follow-ups from the faithful-pipeline PR

**Feature**: Issue #349 — four non-blocking cleanups surfaced by the #348 code review
**Created**: 2026-06-17
**Branch**: `349-cleanup-followups`

## Overview

The pull request that made the Companion pipeline faithful (#348) shipped working code, but a high-effort review flagged four pieces of tidiness, efficiency, and future-fragility that didn't block the release. This feature pays them down. None of these change what a user sees or how a spec is captured — they make the internal capture script and the benchmark setup easier to maintain and harder to break later. The golden command outputs stay byte-identical and the existing test suites stay green.

## User Scenarios & Testing

### User Story 1 - The capture script is safe to change in one place (Priority: P1)

A maintainer needs to adjust how a finished step is recorded. Today the "read the context, refuse to touch a shipped spec, then append a completion event" sequence is copied across several functions, so a single change has to be made in every copy or one path silently drifts. After this work, that sequence lives in one shared helper, so one edit covers every path.

**Why this priority**: This is the largest source of future drift and the review's headline item. Folding the duplication first makes the remaining items smaller.

**Independent Test**: Run the existing capture regression suite; every lifecycle path (step finish, materialize, per-task finish, task sync) still produces identical history and status. The shared helper is exercised by those same tests.

**Acceptance Scenarios**:
1. **Given** a spec with a finished plan step, **When** the script records the finish, **Then** the history gains exactly one plan completion event, as it does today.
2. **Given** a spec already shipped (completed/archived), **When** any finish path runs, **Then** the spec is left untouched, as it does today.

### User Story 2 - The per-task path reads its task list once (Priority: P2)

When a task finishes, the script re-reads and re-parses the task list several times in a single call. After this work it reads the list once and threads the parsed result through, so finishing a task does the same thing with less repeated file work.

**Why this priority**: Pure efficiency on a hot path; no behavior change, so it ranks below the correctness-of-maintenance item.

**Independent Test**: A task finish still flips the right checkbox and closes the step at 100%; the close decision is derived from the already-parsed markers.

**Acceptance Scenarios**:
1. **Given** a task list where the final task is finishing, **When** the script folds that finish, **Then** the implement step closes exactly when every task is checked and journaled — same verdict as today.

### User Story 3 - The benchmark baker can't silently leak its framing (Priority: P2)

The benchmark builds a "clean app" copy that must not mention the benchmark anywhere the AI could read it. Today it scrubs the guidance file with exact-text replacements; if the source wording changes, a replacement quietly does nothing and the framing leaks. After this work the scrub is driven off explicit marker comments in the source, and a smoke test fails loudly if any benchmark framing survives into a baked copy.

**Why this priority**: Future-fragility with a real failure mode (a contaminated benchmark cell), but it only bites if the source wording drifts.

**Independent Test**: Bake a cell and assert its guidance file contains zero references to the benchmark.

**Acceptance Scenarios**:
1. **Given** the source guidance file with benchmark framing wrapped in markers, **When** a clean cell is baked, **Then** the baked guidance file has no benchmark references.
2. **Given** a source whose expected marker is absent, **When** the bake runs, **Then** it fails loudly rather than silently leaving the framing in place.

### User Story 4 - A re-run never replays a stale event log (Priority: P3)

The per-task finishes are appended to a small event log that is folded into the context on every materialize. Today that log is never removed, so re-running the same spec directory would replay stale lines. After this work the log is removed once the spec is marked complete — the one terminal state after which no further finish can append — always after everything in it has been folded, so no finish is ever dropped.

**Why this priority**: Lowest-impact (a separate reset already clears it on the benchmark), but it removes a genuine re-run hazard.

**Independent Test**: After the spec is marked complete, the event log file is gone, and every appended finish landed in the context first.

**Acceptance Scenarios**:
1. **Given** a spec with appended finishes (even un-materialized ones), **When** it is marked complete, **Then** every finish is folded into the context AND the event log file no longer exists.
2. **Given** a spec still implementing — or implemented but not yet marked complete — **When** materialize runs, **Then** the event log is preserved (only marking complete removes it).

## Edge Cases

- A finish path running on an already-shipped spec must still no-op (the shared guard must preserve this).
- A torn/partial event-log line must still be tolerated during the final fold before the log is removed.
- A baked cell whose source has no benchmark framing at all must still bake cleanly (zero references, no error).
- Removing the event log must never run before the final materialize folds it.

## Requirements

### Functional Requirements

- **FR-001**: The read-context + cross-step-terminal-guard preamble MUST be extracted into one shared helper and reused by the step-finish, materialize, per-task-finish, and task-sync paths, with identical observable output.
- **FR-002**: The "append a completion event if one is not already present" pattern MUST be extracted into one shared helper and routed through by its current call sites, with identical history entries.
- **FR-003**: The per-task finish path MUST read the task list once and pass the parsed markers to the implement-close check, which MUST derive its 100% verdict from those markers rather than re-reading the file.
- **FR-004**: The benchmark baker MUST strip benchmark framing from the baked guidance file using explicit source markers (not free-text literals); a missing expected marker MUST cause a loud failure rather than a silent no-op.
- **FR-005**: A smoke test MUST assert a baked cell's guidance file contains zero benchmark references.
- **FR-006**: The per-task event log MUST be removed once the spec is marked complete, and only after every appended finish has been folded into the context.
- **FR-007**: A test MUST assert the event log is retained while implementing and absent after the spec is marked complete.
- **FR-008**: The golden command outputs MUST stay byte-identical (this is a scripts/bench-only change; node/part text is untouched) and the existing python + bench test suites MUST stay green.

### Key Entities

- **Capture context** (`.spec-context.json`) — the per-spec lifecycle record; its history and status are what must stay byte-identical.
- **Event log** (`.spec-context.events.jsonl`) — the append-only per-task finish log that gets folded and now garbage-collected.
- **Baked cell** — a benchmark sandbox copy of the example app that must read as a plain app.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All existing python capture tests pass unchanged (no test weakened to pass).
- **SC-002**: The golden assemble-check and shape-parity gates pass with no re-bless required.
- **SC-003**: A baked benchmark cell's guidance file has zero benchmark references.
- **SC-004**: After a spec is marked complete, the event log file does not exist and no folded finish was lost.
- **SC-005**: The duplicated preamble and completion-append pattern each appear in exactly one shared helper.

## Assumptions

- "Simple" size: the change touches the capture script, the benchmark baker, the source guidance file's markers, and two test files — within the small-change guardrail (≤5 files / ≤10 tasks), so the fast-path applies.
- The shared helpers stay private to the capture script (no public-API change).

## Approach

Files to touch:

- `speckit-extension/scripts/write-context.py` — extract `_open_ctx_or_none(feature_dir)` → `(ctx, log, branch)` (read + cross-step-terminal guard + canonical_log + fill_required) and `append_complete(log, step, *, substep, task, by, at)`; route `journal_finish`, `materialize_log`, `journal_task_finish`/`_fold_task_finish`, `sync_tasks`, `update_context`, `mark_spec_complete`, `_maybe_close_implement` through them. Thread parsed `(all_ids, done_ids)` markers from `_fold_task_finish` into `_maybe_close_implement` so it derives the 100% verdict without re-reading. Remove `.spec-context.events.jsonl` only in the `--mark-complete` path (the terminal `completed` transition), after folding any pending appended finishes — so a straggler appended after step-close is never dropped.
- `examples/todo-claude/CLAUDE.md` — wrap the bench framing in `<!-- BENCH START -->` / `<!-- BENCH END -->` markers (mirroring the existing `<!-- SPECKIT START -->` convention) and mark the bench-target phrase + vitest comment.
- `examples/todo-claude/bench/sync-templates.mjs` — `presentAsCleanApp` strips between the BENCH markers; a missing expected marker throws loudly.
- `speckit-extension/tests/test_context.py` — tests for the GC (event log absent after close) and the threaded-markers close path.
- `examples/todo-claude/bench/sync-templates.test.mjs` (new) — smoke test: baked cell guidance has zero bench references.

Dependencies: item 1 (shared helpers) lands first; items 2 and 4 build on the threaded markers and the helper; item 3 is independent.
