# Tasks: Archive Button Left Alignment

**Input**: Design documents from `/specs/054-archive-button-left/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story. This is a small UI layout change with 2 closely related stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No setup needed — this feature modifies existing files only.

*(No tasks in this phase)*

---

## Phase 2: Foundational

**Purpose**: No foundational work needed — existing CSS layout already supports left/right separation.

*(No tasks in this phase)*

---

## Phase 3: User Story 1 - Archive Button Positioned on Left Side of Footer (Priority: P1) MVP

**Goal**: Move the Archive button from `actions-right` to `actions-left` in FooterActions.tsx, consolidating three duplicated instances into one.

**Independent Test**: Open any active spec in spec viewer — Archive on left, Regenerate + Approve on right.

### Implementation for User Story 1

- [x] T001 [US1] Remove Archive button from all three conditional branches in `actions-right` div in `webview/src/spec-viewer/components/FooterActions.tsx` (lines 45, 50, 55)
- [x] T002 [US1] Add single consolidated Archive button (`!isArchived` conditional) in `actions-left` div after Edit Source and before Toast in `webview/src/spec-viewer/components/FooterActions.tsx`
- [x] T003 [US1] Remove the Archive button from `isArchived || isCompleted` branch since archived specs should not show Archive in `webview/src/spec-viewer/components/FooterActions.tsx` (line 43-47: currently shows Archive for completed AND archived — after move, the `!isArchived` guard handles this)

**Checkpoint**: Active spec shows Archive on left, Regenerate + Approve/Plan on right. Tasks-done shows Archive on left, Complete on right.

---

## Phase 4: User Story 2 - Consistent Left Placement Across All Spec States (Priority: P2)

**Goal**: Verify and ensure Archive button left placement is consistent across all non-archived states.

**Independent Test**: Cycle through active, tasks-done, completed, and archived states — Archive always on left except when archived.

### Implementation for User Story 2

- [x] T004 [US2] Verify `actions-right` branches are simplified after Archive removal — completed state should show only Reactivate, tasks-done only Complete, active only Regenerate + Approve in `webview/src/spec-viewer/components/FooterActions.tsx`
- [x] T005 [US2] Verify archived state shows no Archive button (the `!isArchived` guard in `actions-left` handles this) and only Reactivate in `actions-right` in `webview/src/spec-viewer/components/FooterActions.tsx`

**Checkpoint**: All spec states render correctly with Archive consistently on left.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates

- [x] T006 [P] Update footer button matrix in `docs/viewer-states.md` to reflect Archive in left side column for active/tasks-done/completed states and Edit Source + Archive grouping
- [x] T007 Run quickstart.md verification steps (open active, tasks-done, completed, archived specs and verify button placement)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 3 (US1)**: No dependencies — can start immediately
- **Phase 4 (US2)**: Depends on Phase 3 completion (verification of US1 changes)
- **Phase 5 (Polish)**: Depends on Phase 4 completion

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies — core implementation
- **User Story 2 (P2)**: Depends on US1 — verification and cleanup of US1 changes

### Within User Story 1

- T001 (remove from right) and T002 (add to left) should be done together as a single edit to avoid broken intermediate state
- T003 is part of the same edit (the `!isArchived` guard in `actions-left` replaces the per-branch Archive buttons)

### Parallel Opportunities

- T006 (docs update) can run in parallel with T004-T005 (verification)
- T001-T003 are all edits to the same file and should be done as one atomic change

---

## Parallel Example: User Story 1

```bash
# T001 + T002 + T003 are all in the same file — execute as single atomic edit:
Task: "Move Archive button from actions-right to actions-left in webview/src/spec-viewer/components/FooterActions.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: Move Archive button (T001-T003)
2. **STOP and VALIDATE**: Open spec viewer in each state, verify layout
3. Ready for review after single file change

### Incremental Delivery

1. US1: Move Archive button → Verify in active state → Core done
2. US2: Verify all states → Cleanup any edge cases
3. Polish: Update docs, run full verification

### Key Insight

This is a single-file change. T001-T003 represent logical steps within one edit to `FooterActions.tsx`. The consolidated `!isArchived` guard in `actions-left` replaces three separate Archive buttons in `actions-right`, making the code both simpler and correct.

---

## Notes

- Single file change: `webview/src/spec-viewer/components/FooterActions.tsx`
- No CSS changes needed — `actions-left` already uses `margin-right: auto` for left alignment
- The move also consolidates 3 duplicated Archive buttons into 1, reducing code duplication
- `docs/viewer-states.md` already shows Archive on left in its table (line 66-71) but the mermaid diagrams and table should be verified for accuracy
