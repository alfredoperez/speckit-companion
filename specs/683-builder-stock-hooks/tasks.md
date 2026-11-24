# Tasks: Your own hook on stock Spec Kit, and the template layer in force

## Phase 1: Setup

None: the worktree, dependencies and the dev install of the spec-kit extension are already in place.

## Phase 2: Foundational

Files: apps/vscode/src/protocol/pipeline.ts, apps/vscode/src/features/pipeline-builder/stockGuard.ts, apps/vscode/src/features/pipeline-builder/__tests__/stockGuard.test.ts

**Wave 1 — one file:**

- [ ] **T001** Add `StockHookDraft`, `StockTemplateLayer`, `own` and `prompt` on `StockHookRow`, `inForce` and `layers` on `StockTemplate`, and the `addStockHook`, `updateStockHook`, `removeStockHook` messages · apps/vscode/src/protocol/pipeline.ts

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [ ] **T002** [P] Allow the three messages on a stock project (FR-008) · apps/vscode/src/features/pipeline-builder/stockGuard.ts
- [ ] **T003** [P] Test that the three messages are allowed on stock and the rest still refused (FR-008) · apps/vscode/src/features/pipeline-builder/__tests__/stockGuard.test.ts

## Phase 3: User Stories 1 and 2 - attach, edit and remove my own hook (P1)

Files: apps/vscode/src/features/pipeline-builder/stockHooks.ts, apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/src/features/pipeline-builder/__tests__/stockHooks.test.ts

### Tests

- [ ] **T004** [US1] Tests: add keeps every other line byte for byte (FR-002), creates the file when missing, adds a missing key or `hooks:` section, parses back with the values given (FR-001); edit changes only that entry (FR-003); remove drops the entry and an emptied key (FR-004); extension-owned entry refused (FR-005); malformed YAML and flow-style shapes refused with text unchanged (FR-006) · apps/vscode/src/features/pipeline-builder/__tests__/stockHooks.test.ts

### Implementation

**Wave 1 — one file:**

- [ ] **T005** [US1] `addUserHook`, `updateUserHook`, `removeUserHook` text writers with validation and a parse-back check · apps/vscode/src/features/pipeline-builder/stockHooks.ts

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T006** [US1] Handlers that check the step against the board, read or create the registry, write, re-send the board and report status · apps/vscode/src/features/pipeline-builder/builderPanel.ts

**Checkpoint**: a stock project can add, edit and remove its own hooks from the panel's messages.

## Phase 4: User Stories 3 and 4 - which hooks are mine, which template layer is in force (P2)

Files: apps/vscode/src/features/pipeline-builder/stockWorkflow.ts, apps/vscode/src/features/pipeline-builder/__tests__/stockWorkflow.test.ts

### Tests

- [ ] **T007** [US3] Tests: a git hook reads as git's and a hand-written one as own with its prompt (FR-007); layer in force is override, preset (replace), preset over core (append), extension, core; override-only template listed (FR-009, FR-010) · apps/vscode/src/features/pipeline-builder/__tests__/stockWorkflow.test.ts

### Implementation

- [ ] **T008** [US3] `own` and `prompt` on registry hooks; `layers` and `inForce` per template in Spec Kit's resolution order; override-only rows · apps/vscode/src/features/pipeline-builder/stockWorkflow.ts

**Checkpoint**: the board's data says whose each hook is and which layer each template comes from.

## Phase 5: Polish

- [ ] **T009** One `[Unreleased]` changelog line for the stock board · CHANGELOG.md
- [ ] **T010** Validate against Success Criteria: `npx tsc --noEmit -p ./`, related jest tests, docs-consistency test · (no file)

## Dependencies & Execution Order

Phase 2 blocks Phases 3 and 4, which own disjoint files and can run in either order; Polish runs last. Phase 2: Wave 1 (T001) blocks Wave 2 (T002, T003). Phase 3: T005 blocks T006. Phase 4: T008 alone after its tests.
