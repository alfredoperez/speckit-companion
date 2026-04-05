# Tasks: Fix Plan Sub-files Indentation in Sidebar

**Input**: Design documents from `/specs/049-fix-plan-indent/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: Not requested in spec. Existing tests must continue to pass.

**Organization**: Single user story (P1) — single-method bug fix.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No setup needed — this is a bug fix in an existing codebase with all tooling in place.

(No tasks)

---

## Phase 2: Foundational

**Purpose**: No foundational work needed — single method change, no new infrastructure.

(No tasks)

---

## Phase 3: User Story 1 - Plan sub-files display as children (Priority: P1) :dart: MVP

**Goal**: Fix the early-return bug in `getStepSubFiles()` so Plan step combines both `subFiles` (research, data-model, quickstart) and `subDir` (contracts/) into its child items, making them appear indented under Plan in the sidebar tree.

**Independent Test**: Expand a spec with Plan sub-files (research.md, data-model.md) in the sidebar. Verify they appear indented under Plan, matching how Requirements appears under Specification.

### Implementation for User Story 1

- [X] T001 [US1] Refactor `getStepSubFiles()` to use accumulator pattern instead of early-return in `src/features/specs/specExplorerProvider.ts` — collect results from both `subFiles` and `subDir` blocks into a single array, then return the combined sorted result (see quickstart.md for exact code)
- [X] T002 [US1] Run `npm run compile` to verify no type errors in `src/features/specs/specExplorerProvider.ts`
- [X] T003 [US1] Run `npm test` to verify all existing tests pass

**Checkpoint**: Plan sub-files should now appear indented under the Plan node in the sidebar, matching Specification/Requirements nesting.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Verify edge cases and documentation

- [X] T004 Manual verification: expand a spec with both `subFiles` and `subDir` (contracts/) — confirm both sources appear as children under Plan
- [X] T005 Manual verification: expand a spec with no plan sub-files — confirm Plan appears as a leaf node
- [X] T006 Manual verification: confirm Specification/Requirements nesting is unchanged

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 3 (User Story 1)**: No dependencies — can start immediately
- **Phase 4 (Polish)**: Depends on Phase 3 completion

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies — single method fix

### Within User Story 1

- T001 (code change) → T002 (compile check) → T003 (test run) — sequential
- T004, T005, T006 — can run in parallel after T003

### Parallel Opportunities

- T004, T005, T006 (manual verifications) can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001: Fix `getStepSubFiles()` accumulator pattern
2. Complete T002: Compile check
3. Complete T003: Test run
4. **STOP and VALIDATE**: Manual verification (T004-T006)

### Single Delivery

This is a single-commit bug fix. All tasks deliver in one increment.

---

## Notes

- Single file change: `src/features/specs/specExplorerProvider.ts`
- Single method: `getStepSubFiles()` (lines 376-411)
- Root cause: early-return after `subFiles` block prevents `subDir` block from executing
- Fix: accumulator pattern — collect from both blocks, return combined sorted array
