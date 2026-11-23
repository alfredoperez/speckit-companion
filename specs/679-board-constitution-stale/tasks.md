# Tasks: Constitution card and stale documents on the board

## Phase 1: Setup

None.

## Phase 2: Foundational

- [x] **T001** Move the pure staleness rule to `packages/viewer/src/core/staleness.ts` with tests; VS Code's `staleness.ts` wraps it; its tests pass unchanged (FR-001) · packages/viewer/src/core/staleness.ts, apps/vscode/src/features/spec-viewer/staleness.ts

## Phase 3: User Stories 1 and 2 - the board (Priority: P1)

Files: apps/copilot-canvas/build.mjs, apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/{specs-core.mjs,server.mjs,public/app.js}, apps/copilot-canvas/tests

- [x] **T002** [US1] [US2] Board tests: constitution missing, template and filled; stale and not stale (FR-002, FR-003)
- [x] **T003** [US1] Constitution state on the snapshot and the header card with its run action (FR-002)
- [x] **T004** [US2] Document times on the spec detail, the bundled staleness rule, and the stale line (FR-003)

## Phase 4: Polish

- [x] **T005** Changeset, canvas changelog, docs, `canvas:build` and `mod:build`, every suite (FR-004)

## Dependencies & Execution Order

- T001 first; T002 to T004 in order; Polish last.
