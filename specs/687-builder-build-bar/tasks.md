# Tasks: the build bar

## Phase 1: Setup

None: the builder, its tests and its stories exist.

## Phase 2: Foundational

**Wave 1 — independent (different files):**

- [ ] **T001** [P] Write the `BuildBar` component: headline, Review/Hide, Build, review list (last write with Undo, problem hooks with Edit and Remove, warnings, changed steps with Show, commands the preview would change), built confirmation, failed warning state · apps/vscode/webview/src/pipeline-builder/BuildBar.tsx
- [ ] **T002** [P] Trim the header to the title, the switcher, one overflow menu and the quiet "Built, up to date" line; keep the notices · apps/vscode/webview/src/pipeline-builder/Header.tsx
- [ ] **T003** [P] Style the bar and the trimmed header with host tokens, a narrow layout, focus rings and reduced motion · apps/vscode/webview/styles/pipeline-builder.css

## Phase 3: User Story 1 and 2 - The bar and its review (P1)

Files: apps/vscode/webview/src/pipeline-builder/index.tsx, apps/vscode/webview/src/pipeline-builder/__tests__/BuildBar.test.tsx

### Tests

- [ ] **T004** [US1] [US2] Bar tests through the rendered bar: appears on stale (FR-003), absent on current, Review opens and asks for a preview when none is held (FR-004), Undo sends the token (FR-005), problem rows listed once with Edit and Remove (FR-006), warnings not repeated (FR-007), Show and commands named (FR-008), confirmation leaves (FR-009), failure stays with nothing written (FR-010) · apps/vscode/webview/src/pipeline-builder/__tests__/BuildBar.test.tsx

### Implementation

**⟶ Wait for Phase 2 to finish, then:**

- [ ] **T005** [US1] [US2] Wire the bar into the panel: open state, hide under the hook modal and narrow sheets (FR-011), status inside the bar when it is up and on the foot line otherwise (FR-012), Edit/Remove/Undo/Show/Preview/Build messages · apps/vscode/webview/src/pipeline-builder/index.tsx

Checkpoint: the bar works and its review lists real changes.

## Phase 4: User Story 3 - The smaller header (P2)

Files: apps/vscode/webview/src/pipeline-builder/__tests__/HeaderChip.test.tsx

### Tests

- [ ] **T006** [US3] Header tests: no Build (FR-001), overflow lists and fires every action, quiet line on current (FR-002), notices kept · apps/vscode/webview/src/pipeline-builder/__tests__/HeaderChip.test.tsx

Checkpoint: every header action is reachable from the menu.

## Phase 5: Polish

**Wave 1 — independent (different files):**

- [ ] **T007** [P] Stories for the bar's states and the trimmed header · apps/vscode/webview/src/pipeline-builder/__stories__/Components.stories.tsx
- [ ] **T008** [P] Fix other tests and stories that read the old header or status line · apps/vscode/webview/src/pipeline-builder/__tests__/MoveAnnouncement.test.tsx

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T009** Validate against the Success Criteria: `npx tsc --noEmit -p ./` and `npx jest --findRelatedTests` on the changed files (FR-013 focus and names checked in the bar tests)

## Dependencies & Execution Order

Phase 2 blocks Phases 3 and 4. Phase 2 is one wave of three files. Phase 3 writes its tests, then wires the panel. Phase 4 is one test file. Polish runs its two files together, then validates.
