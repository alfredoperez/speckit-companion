# Tasks: Tree Group Counts

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-21

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Append counts to group labels — `src/features/specs/specExplorerProvider.ts` | R001, R002, R004, R005
  - **Do**: In `getChildren` (root branch), change the three `new SpecItem('Active' | 'Completed' | 'Archived', …)` calls to pass `` `Active (${activeSpecs.length})` ``, `` `Completed (${completedSpecs.length})` ``, and `` `Archived (${archivedSpecs.length})` `` respectively. Keep the existing `if (xxx.length > 0)` guards so empty groups stay hidden.
  - **Verify**: `npm run compile` passes. Launch Extension Dev Host (F5), open a workspace with mixed specs, confirm headers read `Active (N)`, `Completed (N)`, `Archived (N)` with correct numbers.

- [x] **T002** Make icon/tooltip lookup count-agnostic *(depends on T001)* — `src/features/specs/specExplorerProvider.ts` | R003
  - **Do**: In the `SpecItem` constructor's `contextValue === 'spec-group'` branch, compute `const baseLabel = label.split(' (')[0];` and use `baseLabel` instead of `label` when indexing `groupIcons` and `groupTooltips`. Keep the final fallback behavior (`|| 'pulse'`, `|| label`) intact so the default path still renders something sensible.
  - **Verify**: `npm run compile` passes. In the Dev Host, confirm group icons (pulse / check / archive) and tooltips (`Specs in progress`, `Completed specs`, …) render correctly on hover.

- [x] **T003** Update existing group-label assertions *(depends on T001)* — `src/features/specs/__tests__/specExplorerProvider.test.ts` | R001
  - **Do**: Update every test assertion that compares a group label exactly (e.g., `expect(children[0].label).toBe('Active')`, `'Completed'`, `'Archived'`) to include the count for that test's fixture — e.g., a test with one active spec expects `'Active (1)'`. Cover all occurrences in `describe('getChildren')` and `describe('sorting')` / `describe('spec-group icons')` blocks.
  - **Verify**: `npm test` passes with no failures.

---

## Progress

- Phase 1: T001–T003 [x]
