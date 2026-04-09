# Tasks: Transition Logging

**Input**: Design documents from `/specs/052-transition-logging/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add types and shared utilities needed by all user stories

- [X] T001 [P] Add `TransitionEntry` and `TransitionFrom` types to `src/features/workflows/types.ts` per data-model.md
- [X] T002 [P] Add `transitions?: TransitionEntry[]` field to `FeatureWorkflowContext` interface in `src/features/workflows/types.ts`
- [X] T003 [P] Add `transitions?: TransitionEntry[]` and `workflowStepOrder?: string[]` fields to `NavState` interface in `src/features/spec-viewer/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the transition logger module that US1 and US2 both depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `src/features/specs/transitionLogger.ts` with: `buildTransitionEntry(from, step, substep, by)` helper that returns a `TransitionEntry`, and `TransitionCache` class (Map keyed by spec directory path storing last-known `{ step, substep }`)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Extension logs transitions on context writes (Priority: P1) MVP

**Goal**: When the extension updates the workflow step/substep in `.spec-context.json`, a transition record is appended to the `transitions` array with `from`, `step`, `substep`, `by: "extension"`, and `at` timestamp.

**Independent Test**: Navigate a spec through multiple workflow steps (specify -> plan -> tasks) and verify `.spec-context.json` contains a `transitions` array with one entry per step change, each recording correct `from`, `step`, `substep`, `by`, and `at` fields.

### Implementation for User Story 1

- [X] T005 [US1] Modify `updateSpecContext()` in `src/features/specs/specContextManager.ts` to read current `currentStep` and `substep` BEFORE merging partial updates, compare with new values from the partial, and if either changed, call `buildTransitionEntry()` to create a transition entry and append it to the `transitions` array before writing the file
- [X] T006 [US1] Handle first-creation case in `updateSpecContext()` in `src/features/specs/specContextManager.ts`: when no `.spec-context.json` exists yet, set `from: null` in the transition entry
- [X] T007 [US1] Handle no-op case in `updateSpecContext()` in `src/features/specs/specContextManager.ts`: skip transition append when neither `currentStep` nor `substep` is present in the partial argument, or when both values are identical to existing values
- [X] T008 [US1] Ensure append-only semantics in `updateSpecContext()` in `src/features/specs/specContextManager.ts`: preserve all existing `transitions` entries (including those with `by: "sdd"`) during the merge-and-write cycle

**Checkpoint**: User Story 1 fully functional - extension writes produce transition entries in `.spec-context.json`

---

## Phase 4: User Story 2 - Detect and log external (SDD) transitions via file watcher (Priority: P2)

**Goal**: When an external tool modifies `.spec-context.json` and changes the step/substep, the extension detects this and logs a message to the output channel.

**Independent Test**: Manually edit `.spec-context.json` to change `currentStep` and add a transition entry with `by: "sdd"`. Verify the output channel shows: `[SpecKit] Transition detected: specify -> plan (by: sdd)`.

### Implementation for User Story 2

- [X] T009 [US2] Add cache initialization to `TransitionCache` in `src/features/specs/transitionLogger.ts`: on first watcher fire for a spec directory, cache the current `step`/`substep` without logging a transition
- [X] T010 [US2] Add external transition detection function to `src/features/specs/transitionLogger.ts`: given new file contents and cached state, determine if step/substep changed and if latest `transitions` entry has `by !== "extension"`, return detection result with formatted log message
- [X] T011 [US2] Modify the `.claude/**/*` file watcher handler in `src/core/fileWatchers.ts` to detect `.spec-context.json` changes, invoke the external transition detection function from `transitionLogger.ts`, and log to the SpecKit output channel when an external transition is detected
- [X] T012 [US2] Handle cache reset in `src/features/specs/transitionLogger.ts`: when `.spec-context.json` is deleted and recreated, reset the cached state for that spec directory

**Checkpoint**: User Story 2 fully functional - external transitions detected and logged to output channel

---

## Phase 5: User Story 3 - View workflow history timeline in spec viewer (Priority: P3)

**Goal**: A "History" section in the spec viewer displays the full transition timeline with color-coded entries and backtracking highlights.

**Independent Test**: Open a spec with multiple transitions (from both extension and SDD) in the spec viewer. Verify the History section renders each transition with correct step labels, timestamps, source tags (blue for "sdd", green for "extension"), and backward movement highlighted in orange.

### Implementation for User Story 3

- [ ] T013 [P] [US3] Create `webview/styles/spec-viewer/_history.css` with timeline styles: chronological layout, color-coded source tags (blue for `sdd`, green for `extension`), orange highlight for backtracking entries, empty state styling; use VS Code theme CSS variables
- [ ] T014 [P] [US3] Import `_history.css` in `webview/styles/spec-viewer/index.css`
- [ ] T015 [US3] Create `webview/src/spec-viewer/history/TransitionHistory.tsx` Preact component: accepts `transitions: TransitionEntry[]` and `workflowStepOrder: string[]` props, renders chronological timeline with `from step -> to step`, timestamp, source tag with color-coding, and orange backtracking highlight (compare step indices in `workflowStepOrder`); show empty state message when no transitions exist
- [ ] T016 [US3] Modify `src/features/spec-viewer/specViewerProvider.ts` to read `transitions` array from `.spec-context.json` and resolve `workflowStepOrder` via `resolveWorkflowSteps()`, passing both to the webview via NavState
- [ ] T017 [US3] Modify `generateHtml()` in `src/features/spec-viewer/html/generator.ts` to accept `transitions` and `workflowStepOrder` parameters and include them in the serialized `window.__INITIAL_NAV_STATE__` object
- [ ] T018 [US3] Render `<TransitionHistory>` component in `webview/src/spec-viewer/App.tsx` below existing content, passing `transitions` and `workflowStepOrder` from NavState

**Checkpoint**: All user stories functional - transitions logged, external changes detected, history displayed in viewer

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and validation

- [ ] T019 [P] Update `docs/viewer-states.md` to document the History section, its rendering rules, color-coding, and backtracking behavior
- [X] T020 [P] Update `README.md` to document the transition logging feature
- [ ] T021 Run quickstart.md validation: compile, launch Extension Development Host, navigate a spec through workflow steps, verify `.spec-context.json` transitions array, verify output channel logs for external changes, verify History section in spec viewer

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types must exist) - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion; can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on Phase 1 (NavState types); can start CSS/component work in parallel with US1/US2, but provider changes depend on US1 being complete (transitions must be written to read them)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1 (reads file watcher events, not extension writes)
- **User Story 3 (P3)**: CSS and component creation can start after Phase 1; provider integration depends on US1 (needs transitions data to flow through)

### Within Each User Story

- Core logic before integration
- Shared utilities before consumers
- Extension-side before webview-side (for US3)

### Parallel Opportunities

- T001, T002, T003 can all run in parallel (different type files)
- US1 and US2 can proceed in parallel after Phase 2
- T013, T014 (CSS) can run in parallel with T015 (component) within US3
- T019, T020 (docs) can run in parallel

---

## Parallel Example: User Story 1

```bash
# After Phase 2 is complete, US1 tasks are sequential (same file: specContextManager.ts)
# T005 -> T006 -> T007 -> T008 (all modify the same function)
```

## Parallel Example: User Story 3

```bash
# Launch CSS and component in parallel:
Task: "Create _history.css in webview/styles/spec-viewer/_history.css"
Task: "Import _history.css in webview/styles/spec-viewer/index.css"
Task: "Create TransitionHistory.tsx in webview/src/spec-viewer/history/TransitionHistory.tsx"

# Then sequential: provider -> generator -> App.tsx integration
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (transitionLogger module)
3. Complete Phase 3: User Story 1 (transition append in updateSpecContext)
4. **STOP and VALIDATE**: Navigate spec through steps, check `.spec-context.json` for transitions array
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational -> Types and utilities ready
2. Add User Story 1 -> Transitions recorded on extension writes (MVP!)
3. Add User Story 2 -> External transitions detected and logged
4. Add User Story 3 -> Visual history timeline in spec viewer
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
