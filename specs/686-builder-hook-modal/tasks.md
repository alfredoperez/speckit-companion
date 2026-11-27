# Tasks: add a hook from a focused modal

Every story lives in the same modal component, so the component, the board buttons, the wiring and the styles are foundational. The story phases own the tests.

## Phase 1: Foundational

Files: `HookModal.tsx`, `AttachForm.tsx`, `Canvas.tsx`, `index.tsx`, `pipeline-builder.css`

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US1] The modal: title from the place, focused search, kinds, result list with combobox keys, catalog rows, unknown-name row, keep open, edit mode with Runs menus, order, remove; focus trap and return · apps/vscode/webview/src/pipeline-builder/HookModal.tsx
- [x] **T002** [P] [US1] "+ before" / "+ after" edge buttons on each node, replacing the seams · apps/vscode/webview/src/pipeline-builder/Canvas.tsx
- [x] **T003** [P] [US1] Modal, sheet and edge-button styles from host tokens, reduced-motion safe · apps/vscode/webview/styles/pipeline-builder.css

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T004** [US1] Render the modal for `side.kind === 'attach'`, keep-open handling, no side column; drop the hook form from `AttachForm.tsx` · apps/vscode/webview/src/pipeline-builder/index.tsx, apps/vscode/webview/src/pipeline-builder/AttachForm.tsx

## Phase 2: User Story 1 and 2 - add from the spot, pick a skill (P1)

Files: `__tests__/HookModal.test.tsx`, `__tests__/Board.test.tsx`, `__tests__/HookDrag.test.tsx`

### Tests

**Wave 1 — independent (different files):**

- [x] **T005** [P] [US1] FR-002, FR-004, FR-009, FR-010: title, focus on open, arrows and Enter add, Escape returns focus, Tab wraps; FR-005, FR-006, FR-007: catalog source lines, quiet note, fallback names, "not installed" row · apps/vscode/webview/src/pipeline-builder/__tests__/HookModal.test.tsx
- [x] **T006** [P] [US1] FR-001: every node has both edge buttons in the Tab order and each opens the modal with its side · apps/vscode/webview/src/pipeline-builder/__tests__/Board.test.tsx, apps/vscode/webview/src/pipeline-builder/__tests__/HookDrag.test.tsx

**Checkpoint**: a skill hook can be added from a node edge with the keyboard alone.

## Phase 3: User Story 3 and 4 - keep open, other kinds, edit (P2)

Files: `__tests__/SidePanes.test.tsx`, `__tests__/AttachForm.test.tsx`, `__tests__/vocabulary.test.tsx`

### Tests

- [x] **T007** [US3] FR-008, FR-011, FR-014: keep open announces and stays; instruction and command kinds; edit prefill, move, reorder and remove send the same writes · apps/vscode/webview/src/pipeline-builder/__tests__/SidePanes.test.tsx, apps/vscode/webview/src/pipeline-builder/__tests__/AttachForm.test.tsx, apps/vscode/webview/src/pipeline-builder/__tests__/vocabulary.test.tsx

**Checkpoint**: every write the side form sent is still sent.

## Phase 4: User Story 5 - other routes and narrow (P3)

Files: `__stories__/*.stories.tsx`

- [x] **T008** [US5] FR-012, FR-013: stories for the modal wide and narrow, the edge buttons, and the edit modal; update stories that rendered the side form or seams · apps/vscode/webview/src/pipeline-builder/__stories__/

## Phase 5: Polish

- [x] **T009** Validate against Success Criteria: `npx tsc --noEmit -p ./` and `npx jest --findRelatedTests` on the changed files

## Dependencies & Execution Order

Phase 1 blocks every other phase (Wave 1 blocks T004). Phases 2 to 4 are independent of each other once Phase 1 is done. Phase 5 runs last.
