# Tasks: Fix Badge Status Display

**Input**: Design documents from `/specs/049-fix-badge-status-display/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md

**Tests**: Not explicitly requested. No test tasks included.

**Organization**: Tasks grouped by user story. US1 and US2 are both P1 but US2 depends on the same function change, so they share implementation. US3 (P2) is verified through the same code path.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: No new files or dependencies needed. This phase validates the existing code path.

- [X] T001 Read current `computeBadgeText()` implementation in `src/features/spec-viewer/phaseCalculation.ts` (lines 209-232) and confirm the function signature and all call sites
- [X] T002 Read current `docs/viewer-states.md` badge text section to understand existing documentation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Widen the `computeBadgeText` signature to accept `stepHistory` — required before any user story logic can be added

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add `stepHistory` to the `computeBadgeText` parameter type in `src/features/spec-viewer/phaseCalculation.ts`: add `stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>` to the context object type (line 209-214)

**Checkpoint**: Signature updated, existing behavior unchanged, project compiles

---

## Phase 3: User Story 1 - Badge reflects current step completion (Priority: P1)

**Goal**: When a step's `stepHistory` entry has `completedAt` set and `progress` is null, show `"<STEP> COMPLETE"` instead of the in-progress verb.

**Independent Test**: Set `currentStep: "tasks"` with `stepHistory.tasks.completedAt` set and `progress: null` in a `.spec-context.json`, verify badge shows "TASKS COMPLETE" not "CREATING TASKS".

### Implementation for User Story 1

- [X] T004 [US1] Add step completion label mapping (specify→"SPECIFY COMPLETE", plan→"PLAN COMPLETE", tasks→"TASKS COMPLETE", implement→"IMPLEMENT COMPLETE") in `src/features/spec-viewer/phaseCalculation.ts`
- [X] T005 [US1] Insert completion check logic in `computeBadgeText()` in `src/features/spec-viewer/phaseCalculation.ts`: after the `status` checks (line 218) and before implement-specific logic (line 223), check if `stepHistory[currentStep]?.completedAt` is set AND `progress` is null — if so, return the completion label
- [X] T006 [US1] Handle the implement step completion case in `src/features/spec-viewer/phaseCalculation.ts`: when `currentStep === "implement"` and `stepHistory.implement.completedAt` is set with no `progress` and no `currentTask`, return "IMPLEMENT COMPLETE"

**Checkpoint**: Badge shows "TASKS COMPLETE", "PLAN COMPLETE", "SPECIFY COMPLETE", "IMPLEMENT COMPLETE" when steps are completed. Existing in-progress behavior unchanged.

---

## Phase 4: User Story 2 - Badge shows in-progress state accurately (Priority: P1)

**Goal**: When `progress` is non-null, always show the in-progress verb with `...` suffix, even if `completedAt` is set.

**Independent Test**: Set `currentStep: "tasks"` with `progress: "generating"` and `completedAt` set, verify badge shows "CREATING TASKS..." not "TASKS COMPLETE".

### Implementation for User Story 2

- [X] T007 [US2] Verify that the completion check added in T005 correctly requires `progress` to be null before returning a completion label in `src/features/spec-viewer/phaseCalculation.ts` — if `progress` is non-null, the function must fall through to the existing in-progress verb logic (priority 11-13 in data-model.md wins over priority 8-10)

**Checkpoint**: In-progress indicator (`...` suffix) always takes precedence over completion label when `progress` is non-null.

---

## Phase 5: User Story 3 - Badge state transitions are predictable (Priority: P2)

**Goal**: Badge transitions follow: step verb → step verb... → STEP COMPLETE → (next step verb after explicit advance). No premature jump to next step.

**Independent Test**: Walk through specify→plan→tasks→implement with appropriate `stepHistory` entries, verify badge text at each transition.

### Implementation for User Story 3

- [X] T008 [US3] Ensure legacy fallback path in `computeBadgeText()` in `src/features/spec-viewer/phaseCalculation.ts`: when `stepHistory` is undefined or `currentStep` is not in `stepHistory`, existing verb-based logic (lines 227-229) still runs unchanged
- [X] T009 [US3] Verify the `"ACTIVE"` fallback (line 231) still returns for unknown `currentStep` values in `src/features/spec-viewer/phaseCalculation.ts`

**Checkpoint**: Full workflow walk-through shows predictable badge transitions. Legacy specs without `stepHistory` display existing behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates and validation

- [X] T010 [P] Update badge text table in `docs/viewer-states.md` to add completion rows: SPECIFY COMPLETE, PLAN COMPLETE, TASKS COMPLETE, IMPLEMENT COMPLETE with their priority/conditions
- [X] T011 [P] Update badge text flowchart in `docs/viewer-states.md` to add completion branch after step check and before in-progress check
- [X] T012 [P] Update badge derivation priority documentation in `docs/viewer-states.md` to reflect: status > step-completion > in-progress > idle-step > fallback
- [X] T013 Compile and verify no TypeScript errors with `npm run compile`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — read-only orientation
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (T003) — core completion logic
- **US2 (Phase 4)**: Depends on US1 (T005) — verifies progress-over-completion precedence
- **US3 (Phase 5)**: Depends on US1 (T005) — verifies legacy fallback path
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P1)**: Depends on US1 implementation (same function, same logic branch)
- **User Story 3 (P2)**: Can start after US1 (verifies fallback paths)

### Parallel Opportunities

- T001 and T002 can run in parallel (read-only)
- T010, T011, T012 can run in parallel (different sections of `docs/viewer-states.md`)
- US2 (T007) and US3 (T008, T009) can run in parallel after US1 completes

---

## Parallel Example: Polish Phase

```bash
# Launch all doc updates together:
Task: "Update badge text table in docs/viewer-states.md"
Task: "Update badge text flowchart in docs/viewer-states.md"
Task: "Update badge derivation priority in docs/viewer-states.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (read existing code)
2. Complete Phase 2: Foundational (widen signature)
3. Complete Phase 3: User Story 1 (add completion logic)
4. **STOP and VALIDATE**: Verify badge shows completion labels correctly
5. Continue to US2 + US3 + Polish

### Incremental Delivery

1. Setup + Foundational → Signature ready
2. Add US1 → Badge shows completion → Core fix delivered (MVP!)
3. Add US2 → Progress precedence verified
4. Add US3 → Legacy fallback verified
5. Polish → Documentation updated, compile clean
