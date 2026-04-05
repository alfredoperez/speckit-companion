# Tasks: Centralize Magic Strings

**Input**: Design documents from `/specs/037-centralize-magic-strings/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No project initialization needed — existing codebase.

*(No tasks — project already set up)*

---

## Phase 2: Foundational (Define All Constant Groups)

**Purpose**: Add all new constant objects to `src/core/constants.ts`. MUST complete before any replacement work.

- [x] T001 Add `WorkflowSteps` constant object with SPECIFY, PLAN, TASKS, IMPLEMENT and CONFIG_SPECIFY, CONFIG_PLAN, CONFIG_TASKS, CONFIG_IMPLEMENT to `src/core/constants.ts`
- [x] T002 [P] Add `SpecStatuses` constant object with ACTIVE, TASKS_DONE, COMPLETED, ARCHIVED to `src/core/constants.ts`
- [x] T003 [P] Add `AIProviders` constant object with CLAUDE, GEMINI, COPILOT, CODEX, QWEN to `src/core/constants.ts`
- [x] T004 [P] Add `globalState` sub-object (skipVersion, lastUpdateCheck, initSuggestionDismissed) to `ConfigKeys` in `src/core/constants.ts`
- [x] T005 [P] Merge all values from `src/features/steering/treeContextValues.ts` into `TreeItemContext` in `src/core/constants.ts` using camelCase naming convention
- [x] T006 Derive `AIProviderType` from `AIProviders` constant in `src/ai-providers/aiProvider.ts` (import AIProviders, set `type AIProviderType = typeof AIProviders[keyof typeof AIProviders]`)

**Checkpoint**: All constant groups defined. Replacement work can begin.

---

## Phase 3: User Story 1 — Centralize Workflow Step Strings (Priority: P1) 🎯 MVP

**Goal**: Replace all raw workflow step strings ('specify', 'plan', 'tasks', 'implement', 'step-specify', etc.) with `WorkflowSteps.*` constants.

**Independent Test**: Grep `src/` for raw workflow step strings used as identifiers; zero matches outside constants.ts definition.

### Implementation for User Story 1

- [x] T007 [US1] Replace raw workflow step strings in `src/features/specs/specCommands.ts`
- [x] T008 [P] [US1] Replace raw workflow step strings in `src/features/specs/specContextManager.ts`
- [x] T009 [P] [US1] Replace raw workflow step strings in `src/features/spec-viewer/phaseCalculation.ts`
- [x] T010 [P] [US1] Replace raw workflow step strings in `src/features/workflows/workflowManager.ts`
- [x] T011 [P] [US1] Replace raw workflow step strings in `src/features/workflow-editor/workflow/specInfoParser.ts`
- [x] T012 [P] [US1] Replace raw workflow step strings in `src/features/workflow-editor/workflow/actionHandlers.ts`
- [x] T013 [P] [US1] Replace raw workflow step strings in `src/features/spec-editor/specEditorProvider.ts`
- [x] T014 [P] [US1] Replace raw workflow step strings in `src/features/spec-viewer/messageHandlers.ts`
- [x] T015 [P] [US1] Replace raw workflow step strings in `src/features/spec-viewer/specViewerProvider.ts`
- [x] T016 [P] [US1] Replace raw workflow step strings in `src/features/specs/specExplorerProvider.ts`
- [x] T017 [P] [US1] Replace raw workflow step strings in `src/core/types.ts`

**Checkpoint**: All workflow step raw strings replaced. `npm run compile` passes.

---

## Phase 4: User Story 2 — Centralize Spec Status Strings (Priority: P1)

**Goal**: Replace all raw spec status strings ('active', 'completed', 'archived', 'tasks-done') with `SpecStatuses.*` constants.

**Independent Test**: Grep `src/` for raw status strings used as SpecStatus identifiers; zero matches outside constants.ts and type definitions.

### Implementation for User Story 2

- [x] T018 [US2] Replace raw status strings in `src/features/spec-viewer/messageHandlers.ts`
- [x] T019 [P] [US2] Replace raw status strings in `src/features/spec-viewer/specViewerProvider.ts`
- [x] T020 [P] [US2] Replace raw status strings in `src/features/spec-viewer/phaseCalculation.ts`
- [x] T021 [P] [US2] Replace raw status strings in `src/features/spec-viewer/html/generator.ts`
- [x] T022 [P] [US2] Replace raw status strings in `src/features/spec-viewer/html/stepper.ts`
- [x] T023 [P] [US2] Replace raw status strings in `src/features/specs/specCommands.ts`
- [x] T024 [P] [US2] Replace raw status strings in `src/features/specs/specContextManager.ts`
- [x] T025 [P] [US2] Replace raw status strings in `src/features/specs/specExplorerProvider.ts`
- [x] T026 [P] [US2] Replace raw status strings in `src/features/spec-editor/tempFileManager.ts`
- [x] T027 [P] [US2] Replace raw status strings in `src/features/spec-editor/types.ts`
- [x] T028 [P] [US2] Replace raw status strings in `src/features/workflows/types.ts`
- [x] T029 [P] [US2] Replace raw status strings in `src/features/workflow-editor/workflow/htmlGenerator.ts`
- [x] T030 [US2] Update `isEditableStatus` function in `src/features/spec-viewer/types.ts` to use `SpecStatuses` constants

**Checkpoint**: All spec status raw strings replaced. `npm run compile` passes.

---

## Phase 5: User Story 3 — Centralize AI Provider Names (Priority: P2)

**Goal**: Replace all raw AI provider type strings ('claude', 'gemini', 'copilot', 'codex', 'qwen') with `AIProviders.*` constants.

**Independent Test**: Grep `src/` for raw provider type strings used as AIProviderType values; zero matches outside constants.ts and PROVIDER_PATHS definition.

### Implementation for User Story 3

- [x] T031 [US3] Replace raw provider strings in `src/ai-providers/aiProviderFactory.ts`
- [x] T032 [P] [US3] Replace raw provider strings in `src/ai-providers/claudeCodeProvider.ts`
- [x] T033 [P] [US3] Replace raw provider strings in `src/ai-providers/geminiCliProvider.ts`
- [x] T034 [P] [US3] Replace raw provider strings in `src/ai-providers/copilotCliProvider.ts`
- [x] T035 [P] [US3] Replace raw provider strings in `src/ai-providers/codexCliProvider.ts`
- [x] T036 [P] [US3] Replace raw provider strings in `src/ai-providers/qwenCliProvider.ts`
- [x] T037 [P] [US3] Replace raw provider strings in `src/features/agents/agentManager.ts`
- [x] T038 [P] [US3] Replace raw provider strings in `src/features/steering/steeringExplorerProvider.ts`
- [x] T039 [P] [US3] Replace raw provider strings in `src/features/spec-editor/specEditorProvider.ts`
- [x] T040 [US3] Update PROVIDER_PATHS keys in `src/ai-providers/aiProvider.ts` to use `AIProviders.*` constants
- [x] T041 [US3] Update `promptForProviderSelection` values in `src/ai-providers/aiProvider.ts` to use `AIProviders.*` constants

**Checkpoint**: All AI provider raw strings replaced. `npm run compile` passes.

---

## Phase 6: User Story 4 — Centralize Global State Keys (Priority: P2)

**Goal**: Replace all raw global state key strings with `ConfigKeys.globalState.*` constants.

**Independent Test**: Grep `src/` for raw 'speckit.skipVersion', 'speckit.lastUpdateCheck', 'speckit.initSuggestionDismissed'; zero matches outside constants.ts.

### Implementation for User Story 4

- [x] T042 [US4] Replace raw global state keys in `src/speckit/updateChecker.ts`
- [x] T043 [P] [US4] Replace raw global state keys in `src/extension.ts`

**Checkpoint**: All global state key raw strings replaced. `npm run compile` passes.

---

## Phase 7: User Story 5 — Consolidate Tree Context Values (Priority: P2)

**Goal**: Eliminate `treeContextValues.ts` as a separate definition site; all tree context values live in `TreeItemContext` in constants.ts.

**Independent Test**: Confirm `treeContextValues.ts` is deleted or is a re-export barrel; no direct references to `TreeContext` from the old file remain.

### Implementation for User Story 5

- [x] T044 [US5] Update imports in `src/features/steering/steeringExplorerProvider.ts` to use `TreeItemContext` from `src/core/constants.ts` instead of `TreeContext` from `treeContextValues.ts`
- [x] T045 [US5] Delete `src/features/steering/treeContextValues.ts` (or convert to re-export barrel if other files reference it)

**Checkpoint**: treeContextValues.ts eliminated. `npm run compile` passes.

---

## Phase 8: User Story 6 — Consistent CORE_DOCUMENTS Usage (Priority: P3)

**Goal**: Replace raw 'spec', 'plan', 'tasks' document type strings with imports from `CORE_DOCUMENTS` in `src/features/spec-viewer/types.ts`.

**Independent Test**: Grep `src/` for raw document type strings used as `CoreDocumentType` values; zero matches outside type definitions.

### Implementation for User Story 6

- [x] T046 [US6] Replace raw document type strings in `src/features/spec-viewer/specViewerProvider.ts`
- [x] T047 [P] [US6] Replace raw document type strings in `src/features/spec-viewer/messageHandlers.ts`
- [x] T048 [P] [US6] Replace raw document type strings in `src/features/spec-viewer/html/generator.ts`
- [x] T049 [P] [US6] Replace raw document type strings in `src/features/spec-viewer/html/navigation.ts`
- [x] T050 [P] [US6] Replace raw document type strings in `src/features/spec-viewer/html/stepper.ts`
- [x] T051 [P] [US6] Replace raw document type strings in `src/features/spec-viewer/phaseCalculation.ts`
- [x] T052 [P] [US6] Replace raw document type strings in `src/features/spec-viewer/documentScanner.ts`
- [x] T053 [P] [US6] Replace raw document type strings in `src/features/spec-viewer/utils.ts`
- [x] T054 [P] [US6] Replace raw document type strings in `src/features/workflow-editor/workflow/specInfoParser.ts`
- [x] T055 [P] [US6] Replace raw document type strings in `src/features/workflow-editor/workflow/actionHandlers.ts`
- [x] T056 [P] [US6] Replace raw document type strings in `src/features/specs/specExplorerProvider.ts`
- [x] T057 [P] [US6] Replace raw document type strings in `src/core/types.ts`

**Checkpoint**: All document type raw strings replaced. `npm run compile` passes.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup across all stories.

- [x] T058 Run `npm run compile` and fix any remaining type errors
- [x] T059 Run `npm test` and fix any test failures (update imports in test files as needed)
- [x] T060 [P] Grep verification: confirm zero raw magic strings remain in src/ outside constant definitions
- [x] T061 [P] Update test files under `tests/` to import constants instead of using raw strings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: No dependencies — can start immediately. BLOCKS all user stories.
- **Phases 3–8 (User Stories)**: All depend on Phase 2 completion. Can proceed in parallel with each other.
- **Phase 9 (Polish)**: Depends on all user story phases being complete.

### User Story Dependencies

- **US1 (Workflow Steps)**: Independent after Phase 2
- **US2 (Spec Statuses)**: Independent after Phase 2
- **US3 (AI Providers)**: Depends on T006 from Phase 2 (AIProviderType derivation)
- **US4 (Global State Keys)**: Independent after Phase 2
- **US5 (Tree Context)**: Depends on T005 from Phase 2 (merge into TreeItemContext)
- **US6 (Document Types)**: Independent after Phase 2

### Within Each User Story

- All replacement tasks within a story are parallelizable (different files)
- Files touched by multiple stories (e.g., `messageHandlers.ts` in US1 + US2 + US6) should be done sequentially across stories

### Parallel Opportunities

```bash
# After Phase 2, launch all stories in parallel:
# US1 tasks T007-T017 (all [P] within story)
# US2 tasks T018-T030 (all [P] within story)
# US3 tasks T031-T041 (all [P] within story)
# US4 tasks T042-T043 (all [P])
# US5 tasks T044-T045 (sequential)
# US6 tasks T046-T057 (all [P] within story)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 2: Define all constants
2. Complete Phase 3: WorkflowSteps replacements
3. Complete Phase 4: SpecStatuses replacements
4. **STOP and VALIDATE**: `npm run compile && npm test`
5. These two stories cover ~265 of ~300+ occurrences

### Incremental Delivery

1. Phase 2 → Constants defined
2. US1 + US2 → Highest-impact replacements done (~265 occurrences)
3. US3 → AI provider strings centralized (~37 occurrences)
4. US4 + US5 → Global state + tree context consolidated (~19 occurrences)
5. US6 → Document type consistency (~50 occurrences)
6. Phase 9 → Final compile + test verification

---

## Notes

- [P] tasks = different files, no dependencies
- Files appearing in multiple stories (e.g., `messageHandlers.ts`) must be updated sequentially per story to avoid merge conflicts
- Only replace strings that are clearly used as typed identifiers — not display text, paths, or unrelated matches
- Commit after each phase checkpoint
- `npm run compile` after each phase to catch issues early
