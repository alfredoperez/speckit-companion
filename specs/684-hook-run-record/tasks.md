# Tasks: A record of which hooks ran

No Setup or Foundational phase: each story owns its own files.

## Phase 1: User Story 1 - The assistant says whether each hook ran (P1)

Files: `apps/speckit-extension/scripts/hook_render.py`, `apps/speckit-extension/scripts/capture.py`, `apps/speckit-extension/scripts/write-context.py`, `apps/speckit-extension/tests/test_hook_runs.py`, `apps/speckit-extension/tests/test_build_pipeline.py`

### Tests

- [ ] **T001** [US1] FR-001, FR-002, FR-003, FR-004, FR-005: a rendered hook of each type ends with its record line; `--hook-outcome` alone, with `--batch` and with `--advance` appends one `hookRuns` entry and the call's own work still lands; a bad value writes nothing; history gains no row from a record · apps/speckit-extension/tests/test_hook_runs.py

### Implementation

**Wave 1 — independent (different files):**

- [ ] **T002** [P] [US1] `render_hook` takes the step and closes each hook block with the record line; `insert_hooks` passes it; keep the node-text test true · apps/speckit-extension/scripts/hook_render.py, apps/speckit-extension/tests/test_build_pipeline.py
- [ ] **T003** [P] [US1] `parse_hook_outcome` and `append_hook_runs` writer; `hookRuns` joins the protected `--set` keys · apps/speckit-extension/scripts/capture.py

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T004** [US1] `--hook-outcome` flag that rides on any call and writes alone when it is the only flag · apps/speckit-extension/scripts/write-context.py

**Checkpoint**: a built hook asks for its record, and the record lands.

## Phase 2: User Story 2 - The Workflow Builder reads the last run's outcome per hook (P1)

Files: `apps/vscode/src/protocol/pipeline.ts`, `apps/vscode/src/features/pipeline-builder/hookRuns.ts`, `apps/vscode/src/features/pipeline-builder/builderPanel.ts`, `apps/vscode/src/features/pipeline-builder/__tests__/hookRuns.test.ts`

### Tests

- [ ] **T005** [US2] FR-006, FR-007, FR-008: fixture specs: no spec gives no run; the newest spec wins; the last record per key wins; a newest spec without records gives an empty list; an unreadable record is passed over · apps/vscode/src/features/pipeline-builder/__tests__/hookRuns.test.ts

### Implementation

**Wave 1:**

- [ ] **T006** [US2] `HookRun`, `HookRunsAnswer`, `readHookRuns` and `hookRuns` messages · apps/vscode/src/protocol/pipeline.ts

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T007** [US2] `readHookRuns(specDirs)` and `latestHookRuns(root)` · apps/vscode/src/features/pipeline-builder/hookRuns.ts

**⟶ Wait, then:**

- [ ] **T008** [US2] `readHookRuns` handler posts `hookRuns` · apps/vscode/src/features/pipeline-builder/builderPanel.ts

**Checkpoint**: the panel can ask and gets the last run's outcomes.

## Phase 3: User Story 3 - The hook reference names every hook type (P3)

Files: `apps/speckit-extension/commands/reference/node-hooks.md`

- [ ] **T009** [US3] FR-009: list the `skill` type and the record rule · apps/speckit-extension/commands/reference/node-hooks.md

## Phase 4: Polish

- [ ] **T010** One `[Unreleased]` line in each changelog · CHANGELOG.md, apps/speckit-extension/CHANGELOG.md
- [ ] **T011** Validate against Success Criteria: tsc, jest related tests, the touched pytest files, docs-consistency

## Dependencies & Execution Order

Phases 1, 2 and 3 own disjoint files and can run in any order; Polish runs last. Phase 1: T002 and T003 together, then T004. Phase 2: T006, then T007, then T008.
