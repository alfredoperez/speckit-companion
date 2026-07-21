# Tasks: Completing the pipeline closes the loop

Size: normal. Two P1 user stories, each an independently testable slice.

## Phase 1: Setup

No setup work — the change edits existing modules and their existing test files.

## Phase 2: Foundational

No shared foundation blocks the two stories — they touch disjoint areas (viewer/reconciler vs. fold-back script). They can proceed independently.

## Phase 3: User Story 1 — The panel unlocks the moment tasks finishes (P1)

**Goal**: A step whose completion is in `history[]` reads as settled even when the top-level `status` lags, so the footer offers the forward action.

**Independent Test**: Derive viewer state from a run with a `tasking` status but a tasks-complete history and confirm the step reads settled and the forward action is offered.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US1] Reorder `isStepInFlight` so a `completed` step badge or a `completedAt` in step history returns `false` before consulting `status` · `webview/src/spec-viewer/stepInFlight.ts`
- [x] **T002** [P] [US1] Add the forward-only reconciler settle: move a lagging in-progress `status` (specifying/planning/tasking) to its settled form when history records that step's completion; never for implement, never backward · `src/features/specs/specContextReconciler.ts`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** [US1] Compute `FooterActions`' `stepInFlight` through the resilient `isStepInFlight` (using the derived step history/badges) instead of `inFlightStepFor(status)` alone · `webview/src/spec-viewer/components/FooterActions.tsx`

### Tests

- [x] **T004** [P] [US1] Status-settles eval: assert `isStepInFlight('tasks', …)` is `false` and the forward action is offered when `status:'tasking'` but history records the tasks completion; and that a genuinely-running tasks step still reads in flight · `webview/src/spec-viewer/__tests__/stepInFlight.test.ts`
- [x] **T005** [P] [US1] Reconciler-settle eval: assert a `tasking` + tasks-complete-history context reconciles to `ready-to-implement`; a still-running tasks step is left `tasking`; implement is never promoted to `completed` · `src/features/specs/__tests__/specContextReconciler.test.ts`

**Checkpoint**: US1 is independently functional — the viewer unlocks after tasks and the on-disk status self-heals.

## Phase 4: User Story 2 — Completing a feature records its changes back into the living spec (P1)

**Goal**: Fold-back writes a real delta block into the capability spec and names the exact outcome, with an actionable signal when capabilities loaded but no delta exists.

**Independent Test**: Complete a feature with a delta block (fold writes the capability spec) and one that loaded capabilities but has no delta (actionable message, not silent success).

### Implementation

**Wave 1 — single task (fold module owns its message):**

- [x] **T006** [US2] In `fold_living_spec`, give every early-return its exact reason on stderr (living specs off, spec unreadable, no delta block, no capability resolved, already up to date); in the no-delta branch, read `livingSpecs.loaded` and emit an actionable "N capabilities loaded, nothing to fold yet — run … to sync" message when non-empty · `speckit-extension/scripts/living_spec_fold.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T007** [US2] Drop the generic four-way OR-string in `write-context.py` so the fold owns its message; keep the folded-synced success line · `speckit-extension/scripts/write-context.py`

### Tests

- [x] **T008** [P] [US2] Fold-back-writes eval: a feature WITH a real capability delta block folds into the capability spec and records `livingSpecs.synced`; a feature that loaded capabilities but has no delta produces the actionable signal (asserts the exact-reason strings, not a silent success) · `speckit-extension/tests/test_living_specs.py`
- [x] **T009** [P] [US2] After_tasks settles status regression lock: `write-context.py --step tasks --status ready-to-implement` yields `status: ready-to-implement` · `speckit-extension/tests/test_context.py`

**Checkpoint**: US2 is independently functional — completion writes the delta back and every no-op names its reason.

## Phase 5: Polish

- [x] **T010** [P] Update `docs/viewer-states.md` with the status-lag resilience note (a history-recorded completion settles the step regardless of a lagging status) · `docs/viewer-states.md`
- [x] **T011** [P] Add a `speckit-extension/CHANGELOG.md` `[Unreleased]` entry and a `speckit-extension/README.md` note for the exact-reason fold-back and actionable loaded-but-no-delta signal · `speckit-extension/{CHANGELOG.md,README.md}`
- [x] **T012** Verify: `npm run compile && npm test`, `python3 speckit-extension/scripts/check-shape-parity.py`, and the speckit-extension python tests all green · repo-wide

## Dependencies & Execution Order

- Phase 3 (US1) and Phase 4 (US2) are independent and may run in either order.
- US1: Wave 1 (T001, T002) is parallel; T003 waits for T001; tests T004/T005 follow their targets.
- US2: T006 then T007; tests T008/T009 follow.
- Polish (T010–T012) runs after both stories land.
