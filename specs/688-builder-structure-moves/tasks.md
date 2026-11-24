# Tasks: Builder structure — add, move and remove

## Phase 1: Setup

None: the builder, its tests and stories exist.

## Phase 2: Foundational

Files: `moves.ts`, `Canvas.tsx`, `index.tsx`, `pipeline-builder.css`, `__tests__/MovePlaces.test.tsx`, `__tests__/Structure.test.tsx`

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add `movePlaces()` returning up, down and phase places with the writer's refusal reasons and held rows · apps/vscode/webview/src/pipeline-builder/moves.ts
- [x] **T002** [P] Lane "+ Add to <step>" button, "+ step" tail control, phase label menu (Rename…, Split, Merge above/below) and struck removed row with Undo · apps/vscode/webview/src/pipeline-builder/Canvas.tsx
- [x] **T003** [P] Styles for the lane button, choice row, node and step panels, move list, struck row and phase menu, host tokens only · apps/vscode/webview/styles/pipeline-builder.css

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T004** Wire modal modes, addNode and newStep from the modal, the removed row and its undo · apps/vscode/webview/src/pipeline-builder/index.tsx
- [x] **T005** [P] Unit tests for `movePlaces()` refusals (reads, readers, held) · apps/vscode/webview/src/pipeline-builder/__tests__/MovePlaces.test.tsx
- [x] **T006** [P] Board tests: lane button opens the modal, + step opens Step, phase menu merges both ways, struck row Undo · apps/vscode/webview/src/pipeline-builder/__tests__/Structure.test.tsx

## Phase 3: User Story 1 and 4 - Add a node or a step from the lane (P1, P2)

Files: `HookModal.tsx`, `__tests__/StructureModal.test.tsx`

### Tests

- [x] **T007** [US1] FR-002, FR-003, FR-004: choice row shown when adding, hidden when editing; Node lists offers, searches, sends addNode at the chosen phase · apps/vscode/webview/src/pipeline-builder/__tests__/StructureModal.test.tsx
- [x] **T008** [US4] FR-005, FR-006: Step validates the name, sends newStep, warns about auto · apps/vscode/webview/src/pipeline-builder/__tests__/StructureModal.test.tsx

### Implementation

- [x] **T009** [US1] Choice row Hook · Node · Step and the Node panel with phase pick · apps/vscode/webview/src/pipeline-builder/HookModal.tsx
- [x] **T010** [US4] Step panel with name, display name, runs after, writes and the auto warning · apps/vscode/webview/src/pipeline-builder/HookModal.tsx

**Checkpoint**: nodes and steps can be added from any lane.

## Phase 4: User Story 2 and 3 - Move and remove from the popover (P1)

Files: `NodePopover.tsx`, `__tests__/NodePopover.test.tsx`

### Tests

- [x] **T011** [US2] FR-008, FR-009: Move… lists places, refused rows inert with the reason, Back on a sheet · apps/vscode/webview/src/pipeline-builder/__tests__/NodePopover.test.tsx
- [x] **T012** [US3] FR-010: Remove from the run sends the action; inert with a reason on the last node · apps/vscode/webview/src/pipeline-builder/__tests__/NodePopover.test.tsx

### Implementation

- [x] **T013** [US2] Footer Move…, Edit node, Remove from the run; More keeps Add hook, Open the file, variants, Use the shipped node; Move list body · apps/vscode/webview/src/pipeline-builder/NodePopover.tsx

**Checkpoint**: nodes move and leave the run from the popover.

## Phase 5: Polish

- [x] **T014** Stories for the modal choices, move list, phase menu and struck row · apps/vscode/webview/src/pipeline-builder/__stories__/Components.stories.tsx
- [x] **T015** Validate against Success Criteria: `npx tsc --noEmit -p ./` and `npx jest --findRelatedTests` on the changed files

## Dependencies & Execution Order

Setup → Foundational (Wave 1 blocks Wave 2) → Phase 3 and Phase 4 (independent files, either order) → Polish.
