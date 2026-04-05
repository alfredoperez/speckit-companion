# Tasks: Workflow Persistence Across Spec Lifecycle

**Input**: Design documents from `/specs/038-workflow-persistence/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project setup needed — all infrastructure exists. This phase verifies existing APIs work as expected.

- [x] T001 Verify `saveFeatureWorkflow()` correctly writes workflow field to `.spec-context.json` in `src/features/workflows/workflowManager.ts`
- [x] T002 [P] Verify `getFeatureWorkflow()` correctly reads workflow field from `.spec-context.json` in `src/features/workflows/workflowManager.ts`

**Checkpoint**: Existing persistence APIs confirmed working

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational blockers — existing APIs and types are sufficient. No schema changes, no new dependencies.

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 - Workflow Selection Persists After Spec Creation (Priority: P1) 🎯 MVP

**Goal**: When a user selects a workflow in the spec editor and submits, that workflow is persisted to `.spec-context.json` so the viewer and step commands honor it.

**Independent Test**: Create a spec with a non-default workflow selected, then open the spec in the viewer and verify the correct workflow steps are displayed.

### Implementation for User Story 1

- [x] T003 [US1] Add a `pendingWorkflowWatcher` disposable property to the `SpecEditorProvider` class in `src/features/spec-editor/specEditorProvider.ts`
- [x] T004 [US1] In `handleSubmit()`, after `executeInTerminal()`, create a `vscode.workspace.createFileSystemWatcher()` for `**/specs/*/spec.md` in `src/features/spec-editor/specEditorProvider.ts`
- [x] T005 [US1] In the watcher's `onDidCreate` handler, call `saveFeatureWorkflow(parentDir, workflowName)` and dispose the watcher in `src/features/spec-editor/specEditorProvider.ts`
- [x] T006 [US1] Add a 5-minute timeout to auto-dispose the watcher if no spec is detected in `src/features/spec-editor/specEditorProvider.ts`
- [x] T007 [US1] Dispose the watcher in the panel's `onDidDispose` handler to prevent resource leaks in `src/features/spec-editor/specEditorProvider.ts`

**Checkpoint**: Specs created via the editor now have their workflow persisted. Viewer and step commands read the correct workflow.

---

## Phase 4: User Story 2 - Default Workflow Applied When None Selected (Priority: P1)

**Goal**: When no workflow is explicitly selected or persisted, the system applies the configured default workflow and persists it for consistency.

**Independent Test**: Create a spec without selecting a workflow, then verify the default workflow is applied and persisted for all subsequent operations.

### Implementation for User Story 2

- [x] T008 [US2] Verify `getOrSelectWorkflow()` reads `speckit.defaultWorkflow` setting when no context exists in `src/features/workflows/workflowSelector.ts`
- [x] T009 [US2] Verify `getOrSelectWorkflow()` falls back to built-in DEFAULT_WORKFLOW when configured default doesn't exist in `src/features/workflows/workflowSelector.ts`
- [x] T010 [US2] Verify `resolveWorkflowSteps()` follows same fallback chain in `src/features/spec-viewer/specViewerProvider.ts`
- [x] T011 [US2] In the file watcher handler (T005), if `workflowName` is empty or undefined, resolve to the configured default before calling `saveFeatureWorkflow()` in `src/features/spec-editor/specEditorProvider.ts`

**Checkpoint**: Specs without explicit workflow selection behave identically to those with the default explicitly selected.

---

## Phase 5: User Story 3 - Workflow Consistency Across All Operations (Priority: P2)

**Goal**: Once a workflow is persisted, all subsequent operations use it consistently without re-prompting or silently switching.

**Independent Test**: Create a spec with a workflow, perform multiple operations (viewer open, step click, command palette), verify the same workflow is used throughout.

### Implementation for User Story 3

- [x] T012 [US3] Verify `resolveWorkflowSteps()` reads from `.spec-context.json` before falling back to setting in `src/features/spec-viewer/specViewerProvider.ts`
- [x] T013 [US3] Verify `executeWorkflowStep()` calls `getOrSelectWorkflow()` which returns persisted workflow in `src/features/specs/specCommands.ts`
- [x] T014 [US3] Verify that when a persisted workflow name references a removed workflow, `getOrSelectWorkflow()` falls back to default and re-persists in `src/features/workflows/workflowSelector.ts`

**Checkpoint**: All user stories independently functional — workflow is persisted, defaulted, and consistent.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup and documentation

- [x] T015 [P] Add logging for watcher creation, detection, timeout, and disposal in `src/features/spec-editor/specEditorProvider.ts`
- [x] T016 [P] Update README.md to document workflow persistence behavior and `speckit.defaultWorkflow` setting
- [x] T017 Run quickstart.md validation (manual end-to-end test per quickstart.md steps)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verification only
- **Foundational (Phase 2)**: N/A — no foundational tasks needed
- **US1 (Phase 3)**: Can start immediately — core fix
- **US2 (Phase 4)**: T011 depends on T005 (watcher handler). T008-T010 are verification, can run in parallel with Phase 3
- **US3 (Phase 5)**: Verification only — can run after Phase 3 and 4
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — core implementation
- **User Story 2 (P1)**: T011 extends US1 watcher handler; T008-T010 are independent verification
- **User Story 3 (P2)**: Pure verification — depends on US1 and US2 being implemented

### Parallel Opportunities

- T001 and T002 can run in parallel (different function verification)
- T008, T009, T010 can run in parallel with Phase 3 tasks (different files)
- T012, T013, T014 can run in parallel (different files, read-only verification)
- T015 and T016 can run in parallel (different files)

---

## Parallel Example: User Story 1

```bash
# All US1 tasks are in the same file (specEditorProvider.ts), so they run sequentially:
Task T003: "Add pendingWorkflowWatcher property"
Task T004: "Create filesystem watcher after executeInTerminal()"
Task T005: "Handle onDidCreate — call saveFeatureWorkflow()"
Task T006: "Add 5-minute timeout"
Task T007: "Dispose watcher on panel dispose"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Verify existing APIs (T001-T002)
2. Complete Phase 3: User Story 1 (T003-T007)
3. **STOP and VALIDATE**: Submit a spec with a custom workflow, verify it persists
4. Deploy/demo if ready

### Incremental Delivery

1. US1 → File watcher persists workflow on creation → Core bug fixed (MVP!)
2. US2 → Default fallback verified and hardened → No-selection case handled
3. US3 → Cross-operation consistency verified → Full confidence
4. Polish → Logging + docs → Ship-ready

---

## Notes

- All production code changes are in a single file: `src/features/spec-editor/specEditorProvider.ts`
- US2 and US3 are primarily verification tasks — most existing fallback behavior already works
- The only net-new code is the filesystem watcher in `handleSubmit()` (~20-25 lines)
- Commit after each phase checkpoint
