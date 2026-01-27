# Tasks: Custom Workflows

**Input**: Design documents from `/specs/001-custom-workflows/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/workflow-api.ts

**Tests**: Not requested in the feature specification - test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Project type**: VS Code extension (single project)
- **Source**: `src/` at repository root
- **Feature module**: `src/features/workflows/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions for custom workflows

- [x] T001 [P] Create workflow type definitions from contracts in src/features/workflows/types.ts
- [x] T002 [P] Add ConfigKeys.customWorkflows constant in src/core/constants.ts
- [x] T003 Add speckit.customWorkflows configuration schema to package.json contributes.configuration
- [x] T004 Create module exports barrel file in src/features/workflows/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core workflow infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Implement DEFAULT_WORKFLOW constant in src/features/workflows/workflowManager.ts
- [x] T006 Implement validateWorkflow() function with name pattern and structure validation in src/features/workflows/workflowManager.ts
- [x] T007 Implement getWorkflows() to load from VS Code settings and merge with default in src/features/workflows/workflowManager.ts
- [x] T008 Add extension activation validation to warn about invalid workflow configurations in src/extension.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Configure Custom Workflow in Settings (Priority: P1)

**Goal**: Enable developers to define custom workflows in VS Code settings with validation

**Independent Test**: Add a workflow configuration to settings.json and verify it is recognized by the extension. Invalid workflows should show warnings and be skipped.

### Implementation for User Story 1

- [x] T009 [US1] Implement getWorkflow(name) to retrieve specific workflow by name in src/features/workflows/workflowManager.ts
- [x] T010 [US1] Add validation error collection and warning display via vscode.window.showWarningMessage in src/features/workflows/workflowManager.ts
- [x] T011 [US1] Implement onDidChangeConfiguration listener to re-validate workflows on settings change in src/features/workflows/workflowManager.ts
- [x] T012 [US1] Register configuration change handler in extension activation in src/extension.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - workflows can be configured and validated

---

## Phase 4: User Story 2 - Select Workflow When Generating Specs (Priority: P1)

**Goal**: Present workflow selection when multiple workflows exist; auto-select default when only one exists

**Independent Test**: Trigger spec generation and verify workflow selection prompt appears with all configured options. Verify auto-selection when only default exists.

### Implementation for User Story 2

- [x] T013 [US2] Implement needsSelection() to check if multiple workflows exist in src/features/workflows/workflowSelector.ts
- [x] T014 [US2] Implement selectWorkflow() with VS Code QuickPick UI in src/features/workflows/workflowSelector.ts
- [x] T015 [US2] Implement getFeatureWorkflow() to read workflow context from .speckit.json in src/features/workflows/workflowManager.ts
- [x] T016 [US2] Implement saveFeatureWorkflow() to persist workflow selection to .speckit.json in src/features/workflows/workflowManager.ts
- [x] T017 [US2] Integrate workflow selection into specify command flow in src/features/specs/specCommands.ts
- [x] T018 [US2] Add workflow context persistence after selection in specify command in src/features/specs/specCommands.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - workflows can be configured and selected

---

## Phase 5: User Story 3 - Use Lightweight Workflow with Checkpoints (Priority: P2)

**Goal**: Automatic checkpoints for committing and creating PRs after implementation with user approval prompts

**Independent Test**: Run the implement step of a workflow with checkpoints defined and verify commit/PR prompts appear at appropriate stages.

### Implementation for User Story 3

- [x] T019 [US3] Implement getTriggeredCheckpoints() to find checkpoints for a trigger event in src/features/workflows/checkpointHandler.ts
- [x] T020 [US3] Implement promptForApproval() to show confirmation dialog for checkpoints in src/features/workflows/checkpointHandler.ts
- [x] T021 [US3] Implement executeCommit() using VS Code Git API with excludeCoAuthor option in src/features/workflows/checkpointHandler.ts
- [x] T022 [US3] Implement executePR() using gh CLI via terminal in src/features/workflows/checkpointHandler.ts
- [x] T023 [US3] Implement executeCheckpoint() to orchestrate approval and execution in src/features/workflows/checkpointHandler.ts
- [x] T024 [US3] Implement checkpoint status tracking and update in .speckit.json in src/features/workflows/checkpointHandler.ts
- [x] T025 [US3] Integrate checkpoint execution into implement command flow in src/features/specs/specCommands.ts
- [x] T026 [US3] Add error handling for git operation failures with retry/skip options in src/features/workflows/checkpointHandler.ts

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work - full lightweight workflow with checkpoints

---

## Phase 6: User Story 4 - Custom Workflow Step Mapping (Priority: P2)

**Goal**: Map each workflow step to custom command names for team-specific conventions

**Independent Test**: Configure step mappings and verify the correct commands are invoked at each workflow stage.

### Implementation for User Story 4

- [x] T027 [US4] Implement resolveStepCommand() to get command for a workflow step with fallback in src/features/workflows/workflowManager.ts
- [x] T028 [US4] Add command existence validation at execution time in src/features/workflows/workflowManager.ts
- [x] T029 [US4] Integrate step command resolution into specify command in src/features/specs/specCommands.ts
- [x] T030 [US4] Integrate step command resolution into plan command in src/features/specs/specCommands.ts
- [x] T031 [US4] Integrate step command resolution into implement command in src/features/specs/specCommands.ts
- [x] T032 [US4] Add warning message when custom command not found with fallback to default in src/features/workflows/workflowManager.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T033 [P] Add JSDoc documentation to all exported functions and interfaces in src/features/workflows/
- [x] T034 [P] Verify edge case handling: missing commands fall back to default with warning
- [x] T035 [P] Verify edge case handling: workflow deleted while feature uses it
- [x] T036 [P] Verify edge case handling: user cancels at checkpoint (workflow pauses)
- [x] T037 Run quickstart.md validation scenarios
- [x] T038 Code cleanup: ensure consistent error handling across workflow module

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on Foundational phase completion (can run in parallel with US1)
- **User Story 3 (Phase 5)**: Depends on Foundational phase completion (can run in parallel with US1, US2)
- **User Story 4 (Phase 6)**: Depends on Foundational phase completion (can run in parallel with US1, US2, US3)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Independent of US1 for core functionality, integrates during specCommands.ts modifications
- **User Story 3 (P2)**: Can start after Foundational - Independent of US1/US2 for core checkpoint logic
- **User Story 4 (P2)**: Can start after Foundational - Independent of other stories for core mapping logic

### Within Each User Story

- Core module functions before integration points
- Manager/handler functions before specCommands.ts integration
- Validation before execution logic

### Parallel Opportunities

- T001, T002 can run in parallel (different files, Setup phase)
- T033-T036 can run in parallel (verification/documentation tasks)
- User stories can be worked on in parallel by different developers after Foundational phase

---

## Parallel Example: Setup Phase

```bash
# Launch all parallel Setup tasks together:
Task: "Create workflow type definitions from contracts in src/features/workflows/types.ts"
Task: "Add ConfigKeys.customWorkflows constant in src/core/constants.ts"
```

## Parallel Example: User Stories After Foundation

```bash
# After Phase 2 completes, these can start in parallel:
Developer A: User Story 1 (T009-T012) - Configure workflows
Developer B: User Story 2 (T013-T018) - Workflow selection
Developer C: User Story 3 (T019-T026) - Checkpoints
Developer D: User Story 4 (T027-T032) - Step mapping
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Configure workflows)
4. Complete Phase 4: User Story 2 (Select workflows)
5. **STOP and VALIDATE**: Test workflow configuration and selection independently
6. Deploy/demo if ready - users can now define and select custom workflows

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add User Story 1 + 2 -> Test independently -> Deploy/Demo (MVP: custom workflow selection!)
3. Add User Story 3 -> Test independently -> Deploy/Demo (adds checkpoints)
4. Add User Story 4 -> Test independently -> Deploy/Demo (adds step mapping)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 + User Story 2 (closely related - workflow configuration and selection)
   - Developer B: User Story 3 (independent checkpoint logic)
   - Developer C: User Story 4 (independent step mapping logic)
3. Stories complete and integrate via specCommands.ts modifications

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Key integration point: src/features/specs/specCommands.ts - coordinate changes across stories
