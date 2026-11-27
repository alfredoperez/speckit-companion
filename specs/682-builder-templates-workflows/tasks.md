# Tasks: Templates and saved workflows in the Workflow Builder

W = `apps/vscode/webview/src/pipeline-builder`

## Phase 1: Setup

None: no new tooling or dependency.

## Phase 2: Foundational

Files: `W/useModal.ts`, `W/documentNode.ts`

**Wave 1 — independent (different files):**

- [x] **T001** [P] Shared modal behaviour: focus on open, Tab trap, Escape, focus return · W/useModal.ts
- [x] **T002** [P] Which node writes a step's template file, with the author-node fallback · W/documentNode.ts

## Phase 3: User Story 1 - Change a document's sections from its node (P1)

Files: `W/DocumentModal.tsx`, `W/NodePopover.tsx`, `W/Canvas.tsx`, `W/TemplateForm.tsx`

### Tests

- [x] **T003** [P] [US1] FR-001..FR-006: Document row counts; modal lists sections; a section opens to fragments and Restore shipped; Done sends only changed picks; Cancel sends nothing; outline reflects picks; placeholder advice shown · W/__tests__/DocumentModal.test.tsx

### Implementation

**⟶ Wait for Phase 2, then Wave 2 — independent (different files):**

- [x] **T004** [P] [US1] DocumentModal: sections, fragment picker, staged picks, outline, Sections/Preview tabs when narrow · W/DocumentModal.tsx
- [x] **T005** [P] [US1] Document row in the popover, given a template summary and an opener · W/NodePopover.tsx
- [x] **T006** [P] [US1] FR-007: remove the Document shape chip and its prop · W/Canvas.tsx
- [x] **T007** [P] [US1] FR-007: delete the side-pane template form · W/TemplateForm.tsx

**Checkpoint**: the document modal works on its own in tests and stories.

## Phase 4: User Story 2 - Switch workflows from the header (P1)

Files: `W/WorkflowMenu.tsx`, `W/Header.tsx`

### Tests

- [x] **T008** [P] [US2] FR-008, FR-009: menu groups, in-force mark, Selected-not-built line while the build is stale after a switch · W/__tests__/WorkflowMenu.test.tsx

### Implementation

**Wave 3 — independent (different files):**

- [x] **T009** [P] [US2] Grouped workflow dropdown with keyboard support · W/WorkflowMenu.tsx

**⟶ Wait for Wave 3, then:**

- [x] **T010** [US2] Header uses WorkflowMenu and shows Selected, not built · W/Header.tsx

**Checkpoint**: switching reads honestly in the header.

## Phase 5: User Story 3 - Create a workflow from a modal (P2)

Files: `W/NewWorkflowModal.tsx`, `W/AttachForm.tsx`

### Tests

- [x] **T011** [P] [US3] FR-010: name validation, start choices, Create sends name and start, Escape cancels · W/__tests__/NewWorkflowModal.test.tsx

### Implementation

- [x] **T012** [US3] NewWorkflowModal, and drop NewWorkflowForm from AttachForm · W/NewWorkflowModal.tsx, W/AttachForm.tsx

**Checkpoint**: a workflow can be created from the header.

## Phase 6: Integration and Polish

Files: `W/index.tsx`, `apps/vscode/webview/styles/pipeline-builder.css`, `W/__stories__/*`, `W/__tests__/Board.test.tsx`, `W/__tests__/SidePanes.test.tsx`, `W/__tests__/HeaderChip.test.tsx`

- [x] **T013** FR-011, FR-012: wire both modals and the menu in the app; remove the template and new-workflow side panes · W/index.tsx
- [x] **T014** [P] Styles from the design in host tokens, sheets at narrow width, reduced motion · apps/vscode/webview/styles/pipeline-builder.css
- [x] **T015** [P] Stories for the document modal, workflow menu and new-workflow modal; drop retired stories · W/__stories__/
- [x] **T016** [P] Update the old tests that covered the chip, TemplateForm and NewWorkflowForm · W/__tests__/Board.test.tsx, SidePanes.test.tsx, HeaderChip.test.tsx
- [x] **T017** Validate against Success Criteria: tsc and the related jest tests

## Dependencies & Execution Order

Phase 2 blocks Phases 3 to 5, which are disjoint and can run in any order; Phase 6 needs all three. Wave 1 blocks Wave 2; Wave 3 blocks T010; T013 to T016 block T017.
