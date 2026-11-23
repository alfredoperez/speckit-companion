# Tasks: The canvas and the mod read the shared viewer core

## Phase 1: Setup

None.

## Phase 2: Foundational - the shared-core bundle

**Wave 1:**
- [x] **T001** Bundle `vendor/viewer-core.mjs` from core subpaths and the contract (`countTaskCheckboxes`, `STATUSES`, `STEP_STATUS`, `DEFAULT_PIPELINE_STEPS`, `deriveViewerState`, `markMissingTests`, plus today's step-history exports); point today's step-history importers at it and drop the old bundle (FR-001) · apps/copilot-canvas/build.mjs

## Phase 3: User Story 1 - counting and labels from the shared code (Priority: P1)

Files: apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/tasks.mjs, apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/spec-rules.mjs

**Wave 1 — independent (different files):**
- [x] **T002** [P] [US1] `countTaskCheckboxes` re-exported from the shared module; `listTasks`, `phaseProgress` and the helpers stay (FR-002, FR-003) · tasks.mjs
- [x] **T003** [P] [US1] `PIPELINE_STEPS`, the status order and the running/done tables built from the shared contract; badges, labels and board rules stay (FR-002, FR-003) · spec-rules.mjs

**Checkpoint**: `npm run test:canvas` passes unchanged.

## Phase 4: User Story 2 - the canvas Overview reads the derivation (Priority: P1)

Files: apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/overview.mjs, apps/copilot-canvas/tests/render.test.mjs

**Wave 1:**
- [x] **T004** [US2] Render test: a record with concerns shows them; a gone test file is marked missing (FR-004) · apps/copilot-canvas/tests/render.test.mjs

**⟶ Wait, then:**
- [x] **T005** [US2] Read intent, approach, expectations, context, decisions, verified, concerns and coverage from `deriveViewerState`, and missing tests from `markMissingTests`; keep the HTML (FR-004) · overview.mjs

## Phase 5: User Story 3 - the pane shows the same rows (Priority: P2)

Files: apps/claude-mod/build.mjs, apps/claude-mod/hooks/board.js, apps/claude-mod/tests/overview.test.ts

**Wave 1:**
- [x] **T006** [US3] `conditions: ['source']` in the mod build (FR-005) · apps/claude-mod/build.mjs
- [x] **T007** [US3] `overviewModel` reads `deriveViewerState`; the overview test covers concerns and checks (FR-005) · apps/claude-mod/hooks/board.js, apps/claude-mod/tests/overview.test.ts

## Phase 6: Polish

**Wave 1 — independent:**
- [x] **T008** [P] The share-no-code rule says both surfaces bundle the viewer at build time (FR-007) · CLAUDE.md
- [x] **T009** [P] Changelog lines for the board's concerns and the pane's proof rows · apps/copilot-canvas/CHANGELOG.md, apps/claude-mod/CHANGELOG.md

**⟶ Wait, then:**
- [x] **T010** Regenerate with `npm run canvas:build` and `npm run mod:build`, run `npm run test:canvas`, the mod tests, `npx tsc --noEmit -p ./` and the changelog test (FR-006) · vendor bundles

## Dependencies & Execution Order

- T001 blocks everything. Phases 3, 4 and 5 own disjoint files. Polish last.
