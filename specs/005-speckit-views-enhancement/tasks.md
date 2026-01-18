# Tasks: SpecKit Views Enhancement

**Input**: Design documents from `/specs/005-speckit-views-enhancement/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not explicitly requested - test tasks omitted per specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md structure:
- Main source: `src/` at repository root
- Feature modules: `src/features/`
- Core utilities: `src/core/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Verify TypeScript compilation with `npm run compile`
- [X] T002 [P] Add SpecKit file type interfaces to src/features/steering/types.ts (new file)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Copy SpecKitFileType, SpecKitFile, and SpecKitFilesResult interfaces from specs/005-speckit-views-enhancement/contracts/speckit-files.ts to src/features/steering/types.ts
- [X] T004 [P] Copy SPECKIT_CONTEXT_VALUES, SPECKIT_ICONS, and SPECKIT_PATHS constants from specs/005-speckit-views-enhancement/contracts/speckit-files.ts to src/features/steering/types.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Contextual Initialization Message (Priority: P1) 🎯 MVP

**Goal**: Initialization message only appears when a valid workspace is selected (not when VS Code opens without a project)

**Independent Test**: Open VS Code without a workspace → verify no initialization prompt appears. Open VS Code with a valid workspace → verify message appears appropriately.

### Implementation for User Story 1

- [X] T005 [US1] Add workspace check condition to showInitSuggestion call in src/extension.ts (lines 50-53)
- [X] T006 [US1] Add hasWorkspace constant before init suggestion check: `const hasWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;`
- [X] T007 [US1] Update conditional to include hasWorkspace: `if (cliInstalled && !workspaceInitialized && hasWorkspace)`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - SpecKit Files in Steering View (Priority: P1)

**Goal**: Display SpecKit-generated files (constitution.md, scripts, templates) in the steering view panel

**Independent Test**: Initialize a SpecKit project with constitution.md, scripts, and templates → verify all files appear in the steering view panel

### Implementation for User Story 2

- [X] T008 [US2] Import path module and add fs import in src/features/steering/steeringExplorerProvider.ts
- [X] T009 [US2] Implement private async getSpecKitFiles() method in src/features/steering/steeringExplorerProvider.ts
- [X] T010 [US2] Implement private async scanDirectory(dirPath: string, recursive: boolean) helper method in src/features/steering/steeringExplorerProvider.ts
- [X] T011 [US2] Add SpecKit header item to getChildren() root level when hasSpecKitContent in src/features/steering/steeringExplorerProvider.ts
- [X] T012 [US2] Add speckit-header contextValue case to getChildren() method routing in src/features/steering/steeringExplorerProvider.ts
- [X] T013 [US2] Implement private async getSpecKitHeaderChildren() method in src/features/steering/steeringExplorerProvider.ts
- [X] T014 [US2] Implement private async getSpecKitScripts() method in src/features/steering/steeringExplorerProvider.ts
- [X] T015 [US2] Implement private async getSpecKitTemplates() method in src/features/steering/steeringExplorerProvider.ts
- [X] T016 [US2] Add icon cases for speckit-header, speckit-constitution, speckit-scripts-category, speckit-script, speckit-templates-category, speckit-template in SteeringItem constructor

**Checkpoint**: At this point, User Story 2 should be fully functional and testable independently

---

## Phase 5: User Story 3 - Organized SpecKit File Categories (Priority: P2)

**Goal**: SpecKit files are organized by category (Constitution, Scripts, Templates) with collapsible headers

**Independent Test**: Create a SpecKit project with multiple file types → verify files appear under logical groupings with collapsible categories

### Implementation for User Story 3

- [X] T017 [US3] Add speckit-scripts-category contextValue case to getChildren() method routing in src/features/steering/steeringExplorerProvider.ts
- [X] T018 [US3] Add speckit-templates-category contextValue case to getChildren() method routing in src/features/steering/steeringExplorerProvider.ts
- [X] T019 [US3] Create file watcher for .specify/ directory in src/core/fileWatchers.ts
- [X] T020 [US3] Add debounced refresh trigger for steeringExplorer when .specify/ files change in src/core/fileWatchers.ts
- [X] T021 [US3] Register specifyWatcher disposable in context.subscriptions in src/core/fileWatchers.ts

**Checkpoint**: At this point, all user stories should be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T022 Verify extension compiles without errors using `npm run compile`
- [ ] T023 Manual testing: Open VS Code without workspace → verify no init message
- [ ] T024 Manual testing: Open VS Code with workspace, SpecKit initialized → verify SpecKit Files section in steering view
- [ ] T025 Manual testing: Click SpecKit file in steering view → verify file opens in editor
- [ ] T026 Manual testing: Add/delete file in .specify/ → verify steering view updates within 2 seconds
- [X] T027 Update CLAUDE.md with completed feature notes for 005-speckit-views-enhancement

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 and US2 can proceed in parallel (different files)
  - US3 depends on US2 completion (extends category routing)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Modifies src/extension.ts only
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Modifies src/features/steering/steeringExplorerProvider.ts
- **User Story 3 (P2)**: Depends on US2 completion - Extends steering explorer and adds file watcher

### Within Each User Story

- Models/types before implementation
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 can run in parallel (different concerns)
- T003 and T004 can run in parallel (different constants to same file, no conflicts)
- T005, T006, T007 should run sequentially (same code block)
- T008-T016 should run sequentially (building on each other in same file)
- T017-T021 should run sequentially (building on each other)
- US1 and US2 can run in parallel (different files entirely)

---

## Parallel Example: Setup Phase

```bash
# Launch both setup tasks together:
Task: "Verify TypeScript compilation with npm run compile"
Task: "Add SpecKit file type interfaces to src/features/steering/types.ts"
```

---

## Parallel Example: User Stories 1 and 2

```bash
# After Foundational phase, launch US1 and US2 in parallel:

# US1 (src/extension.ts):
Task: "Add workspace check condition to showInitSuggestion call"

# US2 (src/features/steering/steeringExplorerProvider.ts):
Task: "Import path module and add fs import"
Task: "Implement getSpecKitFiles() method"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (type definitions)
3. Complete Phase 3: User Story 1 (init message fix)
4. Complete Phase 4: User Story 2 (SpecKit files in steering view)
5. **STOP and VALIDATE**: Test both stories independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Init message fixed
3. Add User Story 2 → Test independently → SpecKit files visible
4. Add User Story 3 → Test independently → Categories organized with file watcher
5. Each story adds value without breaking previous stories

---

## File Summary

| File | User Stories | Tasks |
|------|--------------|-------|
| src/extension.ts | US1 | T005-T007 |
| src/features/steering/types.ts | Foundation | T002-T004 |
| src/features/steering/steeringExplorerProvider.ts | US2, US3 | T008-T018 |
| src/core/fileWatchers.ts | US3 | T019-T021 |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US1 and US2 are both P1 priority and can be worked in parallel
