# Tasks: Implemented Mark-Completed + distinct Completed-group icon

## Core work

- [x] **T001** [P] Broaden the `speckit.markCompleted` menu `when`-clause to also match `spec-implemented` (alongside `spec-active` / `spec-tasks-done`) + `package.json`
- [x] **T002** [P] Add a dedicated `implemented` icon branch (`beaker` + `charts.yellow`) before the generic blue `currentStep` fall-through, after the green `COMPLETED` branch + `src/features/specs/specExplorerProvider.ts`

## Polish

- [x] **T003** Add a test asserting an `implemented` spec renders the yellow-tinted beaker (distinct from green completed / blue in-progress) + `src/features/specs/__tests__/specExplorerProvider.test.ts`
- [x] **T004** Document the Completed group's dual membership (confirmed-completed + implemented-awaiting-confirmation), the new yellow icon tint, and the new menu item + `docs/sidebar.md`
- [x] **T005** [P] Mirror the dual-membership + icon + menu note in README "Sidebar at a Glance" + `README.md`
- [x] **T006** [P] Add a user-facing `[Unreleased]` CHANGELOG entry (no internal symbol names) + `CHANGELOG.md`
- [x] **T007** Verify no regression: `npm run compile && npm test`

## Dependencies

- T001, T002 are independent source edits (different files) — parallelizable.
- T003 depends on T002 (asserts the new icon branch).
- T004, T005, T006 are doc edits, independent of source.
- T007 runs last (validates everything compiled + tests green).

## Parallel

- T001 ∥ T002 (different files, no shared dependency).
- T005 ∥ T006 (independent doc files).
