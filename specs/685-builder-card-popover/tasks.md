# Tasks: Builder card with its hooks inside, and a node popover

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md)

## Phase 1: Setup

None: no new tooling or dependency.

## Phase 2: Foundational

Files: `hookStatus.ts`, `HookIcon.tsx`, `__tests__/HookStatus.test.tsx`

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US2] Status derivation and problem short forms (FR-005) · apps/vscode/webview/src/pipeline-builder/hookStatus.ts
- [x] **T002** [P] [US1] The four hook kind icons and the gate diamond · apps/vscode/webview/src/pipeline-builder/HookIcon.tsx

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** [US2] Tests: problem wins, ran, skipped, not seen, changed since, no run draws nothing (FR-005) · apps/vscode/webview/src/pipeline-builder/__tests__/HookStatus.test.tsx

## Phase 3: User Stories 1 and 2 - The card and its hook statuses (P1)

Files: `Canvas.tsx`, `pipeline-builder.css`, `__tests__/Board.test.tsx`, `__tests__/HookDrag.test.tsx`

**Goal**: One card per node with hooks inside, each row showing its status.
**Independent Test**: A node with a before and an after hook draws one card with three rows in order; a run record fills the statuses.

### Tests

- [x] **T004** [US1] Board tests for one card per node with slots in order, marks capped at two, phase and step hook rows at the top saying their side, status words from a run record (FR-001, FR-002, FR-003, FR-004, FR-005) · apps/vscode/webview/src/pipeline-builder/__tests__/Board.test.tsx
- [x] **T005** [US1] Hook drag tests still pass against the card rows (FR-007) · apps/vscode/webview/src/pipeline-builder/__tests__/HookDrag.test.tsx

### Implementation

**Wave 1 — independent (different files):**

- [x] **T006** [P] [US1] Card with before slot, node row, after slot; hook rows with icon, name, status; phase and step hook rows; `runs` prop (FR-001 to FR-005, FR-007) · apps/vscode/webview/src/pipeline-builder/Canvas.tsx
- [x] **T007** [P] [US1] Card, slot, hook row, status and mark styles from host tokens (FR-012) · apps/vscode/webview/styles/pipeline-builder.css

**Checkpoint**: The board draws the card and statuses on its own.

## Phase 4: User Story 3 - The node popover (P2)

Files: `NodePopover.tsx`, `index.tsx`, `__tests__/NodePopover.test.tsx`, `__tests__/MoveToPhase.test.tsx`, `__tests__/MoveAnnouncement.test.tsx`, `__stories__/Components.stories.tsx`

**Goal**: Clicking a node opens its details and every action beside it.
**Independent Test**: Click a node, reach More by keyboard, remove the node from the run.

### Tests

- [x] **T008** [US3] Popover tests: opens with focus inside, Escape and close restore focus to the node, each hook shows outcome and reason with Edit and Remove, More sends every Inspector action, the sheet keeps Tab inside (FR-008, FR-009, FR-010, FR-011) · apps/vscode/webview/src/pipeline-builder/__tests__/NodePopover.test.tsx

### Implementation

**Wave 1 — independent (different files):**

- [x] **T009** [P] [US3] The popover and the bottom sheet with focus handling (FR-008, FR-010, FR-011) · apps/vscode/webview/src/pipeline-builder/NodePopover.tsx
- [x] **T010** [P] [US3] Stories for the card states and the popover · apps/vscode/webview/src/pipeline-builder/__stories__/Components.stories.tsx

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T011** [US3] Open the popover on node click, Edit node opens the Inspector, wire every action, post `readHookRuns` on each graph and keep the answer (FR-006, FR-008, FR-009) · apps/vscode/webview/src/pipeline-builder/index.tsx
- [x] **T012** [US3] Keep the move tests passing on the Inspector the popover opens · apps/vscode/webview/src/pipeline-builder/__tests__/MoveToPhase.test.tsx

**Checkpoint**: The popover works on its own over the card.

## Phase 5: Polish

- [x] **T013** Validate against Success Criteria: `npx tsc --noEmit -p ./` and `npx jest --findRelatedTests` on the changed files

## Dependencies & Execution Order

Phase 2 blocks Phases 3 and 4. Phase 3 and Phase 4 own disjoint files and can run in parallel. Within Phase 2, Wave 1 (T001, T002) blocks T003. Within Phase 4, Wave 1 (T009, T010) blocks T011 and T012. Polish runs last.

## Phase 6: Convergence

- [x] T014 Close the popover when its node is gone after a rebuild, rather than keeping a hidden selection, per spec Edge Cases (partial)
