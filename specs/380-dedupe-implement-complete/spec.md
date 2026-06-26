# Feature Specification: One implement-complete marker, no matter how the step closed

**Feature Branch**: `380-dedupe-implement-complete`
**Created**: 2026-06-26
**Status**: Specified
**Issue**: #357

## Why this matters

When a spec-driven run finishes its implement step, the run's history should say "implement finished" exactly once. The implement step can be closed from several different places — as each task finishes live, by an end-of-step hook, by a batch fold of parallel work, and by the final "mark complete" action. A past run recorded the same "implement finished" event four times because those paths each wrote their own marker. Duplicate markers make the timeline confusing and can throw off anything that counts steps or measures how long implement took.

This change locks in the single-marker guarantee with a test that drives a full implement close through every closing path at once — including when different paths attribute the close to different actors (the AI vs. the extension) — and proves only one marker survives.

## User Scenarios & Testing

### User Story 1 - A finished implement step shows one completion marker (Priority: P1)

A developer finishes implementing a spec. Behind the scenes the step gets closed by the live per-task path, an end-of-step hook, a batch fold, and the final mark-complete action. The recorded history contains exactly one step-level "implement complete" entry.

**Why this priority**: This is the whole point of the ticket — the duplicate markers are the observed bug.

**Independent Test**: Drive a temp spec through all four closing paths in one run and assert the count of step-level implement-complete entries is exactly one.

**Acceptance Scenarios**:
1. **Given** a spec whose tasks are all finished, **When** the implement step is closed by the live per-task path, then the end-of-step hook, then a materialize fold, then mark-complete, **Then** history holds exactly one entry with step `implement`, no substep, no task, kind `complete`.
2. **Given** two of those closing paths attribute the close to different actors (one `ai`, one `extension`), **When** the step closes, **Then** the de-duplication still collapses them to a single marker — the actor field does not make them count as separate events.
3. **Given** the step is already closed, **When** mark-complete runs, **Then** the spec lands at the terminal completed status with the single marker intact.

## Edge Cases

- The closing paths run in different orders (live-first vs. hook-first) — the surviving marker reflects whichever path closed the step first, and there is still only one.
- A late batch fold or a re-run of any path after the step already closed adds no second marker.

## Requirements

### Functional Requirements

- **FR-001**: Every step-level implement-complete MUST route through the single de-duplicated writer, so no closing path appends a second marker.
- **FR-002**: The de-duplication MUST treat an `ai` complete and an `extension` complete for the same step as the same event (it MUST NOT key on the actor field).
- **FR-003**: A regression test MUST drive a full implement close through the live per-task path, the end-of-step hook, the materialize fold, and mark-complete, and assert exactly one step-level implement-complete entry — including when the actor differs across paths.

## Success Criteria

### Measurable Outcomes

- **SC-001**: After a full implement close through all four paths, the count of step-level implement-complete entries in history is exactly 1.
- **SC-002**: The guarantee holds regardless of which path closes the step first and regardless of differing actor attribution across paths.
- **SC-003**: The new test fails if any closing path is changed to bypass the shared de-duplicated writer.

## Assumptions

- Verification on current `main` shows the de-duplication is already hardened (all step-level completes route through the shared writer, whose dedup checks step-level identity and not the actor field). The genuinely-missing deliverable is the regression test that locks this in. Code is only changed if the test reveals a real bypass.

## Approach

Verification-first: the shared writer and its step-level dedup already collapse duplicate implement-completes across paths, so the deliverable is the locking regression test (and a changelog line).

Files to touch:
- `speckit-extension/tests/test_context.py` — add a multi-path regression test that drives the implement close through the live per-task path, the end-of-step hook (the complete branch of the context updater), the materialize fold, and mark-complete, asserting exactly one step-level implement-complete; plus a focused assertion that differing actor attribution still de-duplicates.
- `speckit-extension/CHANGELOG.md` — one user-facing line noting the implement step now records a single completion marker.

Dependencies: none — stdlib `unittest`, matches the existing test style in the same file.

Only touch `write-context.py` if the new test fails (it does not on current `main`).
