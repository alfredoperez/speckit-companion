# Tasks: Hide Resume on Terminal Specs (Make `implemented` a First-Class Status)

**Feature**: `151-implemented-terminal-status` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Lean turbo task list. The change is narrow and lives entirely in three source files + one test file + package.json.

## Phase 1: Foundational (status constant)

- [X] T001 Add `IMPLEMENTED: 'implemented'` to the `SpecStatuses` object in `src/core/constants.ts` (between `TASKS_DONE` and `COMPLETED`).

## Phase 2: User Story 1 — Hide Resume on terminal specs (P1)

**Goal**: Resume (▶) inline action hidden on `implemented` (and remains hidden on completed/archived; shown on active/tasks-done with `resumeBeta`).

- [X] T002 [US1] In `src/features/specs/specExplorerProvider.ts`, add `'spec-implemented'` to the `SpecLifecycleContextValue` union and to the `SPEC_LIFECYCLE_CONTEXT_VALUES` set so `isSpecLifecycleItem()` still returns true.
- [X] T003 [US1] In `lifecycleContextValue()` (`src/features/specs/specExplorerProvider.ts`), add `case SpecStatuses.IMPLEMENTED: return 'spec-implemented';` before the `default` branch.
- [X] T004 [US1] In `package.json`, verify the Resume `speckit.specs.resume` `when` stays scoped to `(viewItem == spec-active || viewItem == spec-tasks-done) && speckit.resumeBeta` (no broad regex matches `spec-implemented`). Add `spec-implemented` to the terminal-action `when` regexes (delete, archive) that already include `completed`, so the new terminal row mirrors a completed row.

## Phase 3: User Story 2 — Group implemented out of Active (P2)

**Goal**: An `implemented` spec is not bucketed under the Active sidebar group.

- [X] T005 [US2] In `getChildren()` grouping (~L170, `src/features/specs/specExplorerProvider.ts`), route `status === SpecStatuses.IMPLEMENTED` into `completedSpecs` (the done bucket) instead of falling through to `activeSpecs`.

## Phase 4: Tests & verification

- [X] T006 [P] In `src/features/specs/__tests__/specExplorerProvider.test.ts`, add a test asserting `lifecycleContextValue({ status: 'implemented' })` returns `'spec-implemented'` (and that `isSpecLifecycleItem('spec-implemented')` is true, `isSpecGroupItem` false).
- [X] T007 [P] In the same test file, add a test asserting an `implemented` spec is NOT in the Active group (rendered tree: implemented spec appears under Completed, not Active).
- [X] T008 Run `npm run compile && npm test`; fix any failures. Confirm the spec's `.spec-context.json` ends at `status: implemented` with a real `specName`.

## Dependencies

- T001 blocks T003 and T005 (they reference `SpecStatuses.IMPLEMENTED`).
- T002 blocks T003 (union/set must exist before the case returns the value).
- T006/T007 depend on T002–T005.
- T008 depends on all.

## MVP Scope

User Story 1 (T001–T004) is the MVP: it stops Resume from showing on terminal specs. US2 (T005) completes the grouping correctness.
