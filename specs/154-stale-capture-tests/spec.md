# Feature Specification: Green-Baseline Stale Capture Tests + CI Gate

**Feature Branch**: `154-stale-capture-tests`
**Created**: 2026-06-11
**Status**: Draft
**Input**: GitHub issue #263 — Stale capture tests: 6 test_context.py failures from the #138 shape change

## Overview

The Python capture test suite (`speckit-extension/tests/test_context.py`) carried 6 tests that encoded the *old* `.spec-context.json` capture contract from before #138/#233/#244 hardened the shape. The production capture scripts (`write-context.py`, `derive-from-files.py`) moved on; the tests did not, so they fail on clean `main` (4 failures + 2 errors). This feature re-derives each stale assertion from the *current* correct shape so the whole suite is green, then wires the Python suite into CI so it gates future capture changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Green capture suite on clean main (Priority: P1)

A maintainer runs the Python capture suite on `main` and gets a fully green result that genuinely encodes the current capture contract, so the suite is a trustworthy regression guard again.

**Why this priority**: A red suite on `main` is noise — it trains maintainers to ignore failures and masks real regressions. This is the core deliverable.

**Independent Test**: `python3 -m unittest discover -s speckit-extension/tests -p "test_*.py"` reports 0 failures, 0 errors, and each updated test still fails if the current contract regresses.

### User Story 2 - Capture suite gates PRs (Priority: P1)

A contributor opens a PR to `main` that changes capture behavior; CI runs the Python capture suite and the shape-parity check and blocks the merge if either fails.

**Why this priority**: Without a CI gate the suite drifts stale again. Making it required is what compounds the green-baseline work.

**Independent Test**: The CI workflow YAML is well-formed and contains a step that runs the unittest discovery and `check-shape-parity.py` on `pull_request` to `main`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each of the 6 failing tests MUST be updated to assert the CURRENT capture contract, not the pre-#138 contract. The 6: `test_history_is_append_only`, `test_next_step_start_still_appends_after_a_deduped_start`, `test_per_task_entries_are_substeps_not_step_completions`, `test_step_complete_only_when_all_tasks_done`, `test_per_task_completes_when_all_checked`, `test_derive_all_tasks_done`.
- **FR-002**: History entries carry no `from` key; append-only assertions MUST verify append-only against the current `{step, substep, kind, by, at}` shape (prior entries preserved, new entry at tail) without referencing `from`.
- **FR-003**: Per-task entries carry the task id in `task` with `substep` None (the #138 move); assertions MUST verify a per-task entry is distinguishable from a step-level boundary (which has both `substep` and `task` None), not that `substep == task`.
- **FR-004**: A step-level complete is `substep is None AND task is None`; filters counting step-level completes MUST exclude per-task completes (which now also have `substep` None), so the "implement self-closes only when all tasks done" intent holds.
- **FR-005**: Derive writes finish-only per-task events (one `complete` per task, no start/complete pair); the derive round-trip assertion MUST expect `["complete"]` per task.
- **FR-006**: No assertion may be weakened to a tautology (`assertTrue(True)`) or deleted. Each updated assertion MUST still fail if the corresponding contract regresses.
- **FR-007**: The Python capture suite MUST run in CI on `pull_request` to `main` as a required gate, invoking `python3 -m unittest discover -s speckit-extension/tests -p "test_*.py"` and `python3 speckit-extension/scripts/check-shape-parity.py`.
- **FR-008**: The CI addition MUST use stdlib unittest only (no pip dependencies) and match the existing `ci.yml` style (runner, triggers, job naming).
- **FR-009**: If any of the 6 tests reveals a genuine production bug (the code SHOULD have the asserted behavior but does not), that test MUST be left failing and reported as its own issue, not papered over.

### Non-Functional Requirements

- **NFR-001**: No regression to the TypeScript build/tests (`npm run compile && npm test` stay green).
- **NFR-002**: `check-shape-parity.py` stays green.

## Success Criteria *(mandatory)*

- **SC-001**: The Python capture suite reports 0 failures and 0 errors on the feature branch.
- **SC-002**: A simulated regression in any of the 4 covered contract points (the `from` absence, per-task `task` field, step-level-complete exclusivity, finish-only derive) would make the corresponding test fail.
- **SC-003**: CI runs the Python suite + shape-parity on PRs to `main` and the workflow YAML parses.
- **SC-004**: `npm run compile && npm test` and `check-shape-parity.py` remain green.

## Assumptions

- All 6 failures are stale expectations (the production code is the source of truth) unless a test is found to describe correct-but-missing behavior — none was, per the analysis.
- The existing `ci.yml` is the right workflow to extend (single `test` job on push/PR to `main`).

## Scope

**In scope**: Updating the 6 stale tests; adding the Python suite + shape-parity to CI.

**Out of scope**: Changing any production capture script behavior; reordering existing `.spec-context.json` history; touching the other 37 passing tests.
