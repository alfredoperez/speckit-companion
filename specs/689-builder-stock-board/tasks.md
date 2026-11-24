# Tasks: Workflow Builder on stock Spec Kit

## Phase 1: Setup

None: the builder, its CSS and its test harness exist.

## Phase 2: Foundational

Files: `apps/vscode/src/protocol/pipeline.ts`, `apps/vscode/src/features/pipeline-builder/stockGuard.ts`, `apps/vscode/src/features/pipeline-builder/builderPanel.ts`, `apps/vscode/src/features/pipeline-builder/__tests__/stockGuard.test.ts`, `apps/vscode/webview/styles/pipeline-builder.css`

**Wave 1 — independent (different files):**

- [ ] **T001** [P] Add the `installCompanion` board message · apps/vscode/src/protocol/pipeline.ts
- [ ] **T002** [P] Replace the stock section of the stylesheet with the lane, card, gate chip, With Companion, banner, documents row, popover and modal rules for stock, on host tokens · apps/vscode/webview/styles/pipeline-builder.css

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T003** [P] Allow `installCompanion` on stock and test it (FR-005) · apps/vscode/src/features/pipeline-builder/stockGuard.ts, apps/vscode/src/features/pipeline-builder/__tests__/stockGuard.test.ts
- [ ] **T004** [P] Handle `installCompanion` by running `speckit.companion.installSpecKitExtension` · apps/vscode/src/features/pipeline-builder/builderPanel.ts

## Phase 3: User Story 2 - Hooks: an extension's and your own (P1)

Files: `StockHookModal.tsx`, `StockHookPopover.tsx`, `__tests__/StockHooks.test.tsx` (under apps/vscode/webview/src/pipeline-builder/)

### Tests

- [ ] **T005** [US2] Test FR-010: the add modal sends the step, side, name, description, optional and prompt it was given; edit sends the same address · __tests__/StockHooks.test.tsx
- [ ] **T006** [US2] Test FR-011: an own hook's popover offers Edit and Remove; an extension's offers neither and shows its source · __tests__/StockHooks.test.tsx

### Implementation

**Wave 1 — independent (different files):**

- [ ] **T007** [P] [US2] Stock add and edit hook modal on `pb-modal` and `useModal` · StockHookModal.tsx
- [ ] **T008** [P] [US2] Hook popover beside the row when wide, a sheet when narrow, with the switch, Edit and Remove · StockHookPopover.tsx

**Checkpoint**: the hook surfaces work alone.

## Phase 4: User Story 3 - Which template layer is in force (P2)

Files: `StockDocuments.tsx`, `__tests__/StockDocuments.test.tsx`

- [ ] **T009** [US3] Test FR-012: layers top first, the one in force marked, a template without layers shows Open only, constitution Revise runs the command · __tests__/StockDocuments.test.tsx
- [ ] **T010** [US3] Documents modal: template list, layer detail, Open, constitution Open and Revise · StockDocuments.tsx

**Checkpoint**: the documents modal works alone.

## Phase 5: User Story 4 - Workflows and presets (P3)

Files: `StockSetup.tsx`

- [ ] **T011** [US4] Extensions-and-workflows modal: installed workflows (draw, open) and the presets panel · StockSetup.tsx

**Checkpoint**: the setup modal works alone.

## Phase 6: User Story 1 - The same board on a stock project (P1)

Files: `StockBoard.tsx`, `__tests__/StockBoard.test.tsx`, `index.tsx`

### Tests

- [ ] **T012** [US1] Rewrite the board tests for FR-001 to FR-009, FR-013 and FR-015: lanes, cards, gate chips, With Companion, banner button, no Build, switch, + before and + after, workflow switcher · __tests__/StockBoard.test.tsx

### Implementation

- [ ] **T013** [US1] Rebuild the board as lanes of cards with hook slots, gate chips, With Companion blocks, the banner, the documents row and the header switcher, opening the three surfaces · StockBoard.tsx
- [ ] **T014** [US1] Wire add, update, remove and install messages from the board · index.tsx

**Checkpoint**: a stock project sees the full board.

## Phase 7: Polish

- [ ] **T015** Stories for the stock board wide and narrow, the add modal, a hook popover, the documents modal and the setup modal · __stories__/PipelineBuilder.stories.tsx
- [ ] **T016** Validate against Success Criteria: `npx tsc --noEmit -p ./` and the related tests

## Dependencies & Execution Order

Foundational → US2, US3, US4 (independent of each other) → US1 (imports their components) → Polish. Phase 2: Wave 1 (T001, T002) blocks Wave 2 (T003, T004).
