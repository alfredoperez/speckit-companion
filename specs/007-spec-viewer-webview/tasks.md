# Tasks: Unified Spec Viewer Webview Panel

**Input**: Design documents from `/specs/007-spec-viewer-webview/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Not requested in feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: VS Code Extension with webview
- Extension-side: `src/features/spec-viewer/`
- Webview-side: `webview/src/spec-viewer/`
- Styles: `webview/styles/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create feature module directory structure for spec-viewer (`src/features/spec-viewer/` and `webview/src/spec-viewer/`)
- [X] T002 [P] Create type definitions in `src/features/spec-viewer/types.ts` (SpecViewerState, DocumentType, SpecDocument, message protocols)
- [X] T003 [P] Create webview-side type definitions in `webview/src/spec-viewer/types.ts` (ViewerWebviewState)
- [X] T004 Create module exports in `src/features/spec-viewer/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Implement document scanning utility function to discover available documents in spec directory in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T006 Implement HTML generation skeleton for WebviewPanel in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T007 Create base CSS styles for viewer container layout in `webview/styles/spec-viewer.css`
- [X] T008 Add webpack configuration entry point for spec-viewer bundle in `webpack.config.js`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Spec Document in Unified Panel (Priority: P1) 🎯 MVP

**Goal**: Developer can click on a spec document in the SpecKit Explorer and view it in a dedicated webview panel

**Independent Test**: Click any spec document (spec.md, plan.md, or tasks.md) in tree view and verify content appears in a dedicated panel. Panel should reuse same instance when clicking different documents.

### Implementation for User Story 1

- [X] T009 [US1] Implement SpecViewerProvider singleton class with `show()` method in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T010 [US1] Implement WebviewPanel creation with proper options (enableScripts, localResourceRoots) in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T011 [US1] Implement panel disposal handling to reset state in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T012 [US1] Implement `updateContent()` method to load document content from filesystem in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T013 [US1] Register `speckit.viewSpecDocument` command in `src/features/spec-viewer/specViewerCommands.ts`
- [X] T014 [US1] Create webview HTML template with content area placeholder in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T015 [US1] Update tree view command integration to route spec documents to viewer in `src/extension.ts`
- [X] T016 [US1] Set panel title to show spec name (e.g., "Spec: 007-spec-viewer-webview") in `src/features/spec-viewer/specViewerProvider.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional - clicking documents opens/reuses the viewer panel

---

## Phase 4: User Story 2 - Navigate Between Spec Documents (Priority: P1)

**Goal**: Developer can switch between spec/plan/tasks and related documents using in-panel navigation tabs

**Independent Test**: Open any spec document, verify tab bar appears with Spec/Plan/Tasks tabs, click different tabs and verify content switches without opening new panels.

### Implementation for User Story 2

- [X] T017 [US2] Add tab navigation bar HTML structure to webview template in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T018 [US2] Add tab button CSS styles with active state highlighting in `webview/styles/spec-viewer.css`
- [X] T019 [US2] Implement tab click handler in webview to post `switchDocument` message in `webview/src/spec-viewer/index.ts`
- [X] T020 [US2] Implement `switchDocument` message handler in extension to load new document in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T021 [US2] Implement dynamic tab generation for related documents (research.md, data-model.md, etc.) in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T022 [US2] Add empty state message for missing documents (e.g., "No tasks file found") in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T023 [US2] Update panel title to include current document name (e.g., "Spec: 007-spec-viewer-webview - Plan") in `src/features/spec-viewer/specViewerProvider.ts`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - panel opens and tab navigation switches documents

---

## Phase 5: User Story 3 - View Rendered Markdown Content (Priority: P2)

**Goal**: Developer sees properly formatted markdown (headers, lists, code blocks, tables) instead of raw text

**Independent Test**: Open a document containing markdown headers, lists, code blocks, and tables. Verify all elements render with proper formatting and syntax highlighting.

### Implementation for User Story 3

- [X] T024 [US3] Integrate existing markdown renderer from `webview/src/markdown/parser.ts` into spec-viewer in `webview/src/spec-viewer/index.ts`
- [X] T025 [US3] Add markdown content styles (headers, lists, blockquotes, tables) in `webview/styles/spec-viewer.css`
- [X] T026 [US3] Add highlight.js CDN script for code syntax highlighting in webview HTML template in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T027 [US3] Implement post-render highlight.js call for code blocks in `webview/src/spec-viewer/index.ts`
- [X] T028 [US3] Add code block CSS styles matching VS Code theme in `webview/styles/spec-viewer.css`
- [X] T029 [US3] Configure Content Security Policy to allow CDN scripts in `src/features/spec-viewer/specViewerProvider.ts`

**Checkpoint**: At this point, markdown content renders with proper formatting and syntax highlighting

---

## Phase 6: User Story 4 - Edit Document from Viewer (Priority: P2)

**Goal**: Developer can click an Edit button to open the current document in the standard VS Code text editor

**Independent Test**: While viewing a document, click Edit button and verify the file opens in a standard editor tab beside the viewer.

### Implementation for User Story 4

- [X] T030 [US4] Add Edit button to viewer header HTML in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T031 [US4] Add Edit button CSS styles in `webview/styles/spec-viewer.css`
- [X] T032 [US4] Implement Edit button click handler to post `editDocument` message in `webview/src/spec-viewer/index.ts`
- [X] T033 [US4] Implement `editDocument` message handler to open file in VS Code editor (ViewColumn.Beside) in `src/features/spec-viewer/specViewerProvider.ts`

**Checkpoint**: At this point, Edit button opens documents in standard editor for modification

---

## Phase 7: User Story 5 - Panel Persistence and Focus (Priority: P3)

**Goal**: Viewer panel behaves predictably with focus management and live updates when files change

**Independent Test**: Open viewer, click elsewhere, click another spec document - verify panel updates and comes to focus. Save changes in editor and verify viewer updates within 2 seconds.

### Implementation for User Story 5

- [X] T034 [US5] Implement `reveal()` call with focus when updating existing panel in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T035 [US5] Setup file watcher for spec markdown files with 500ms debounce in `src/core/fileWatchers.ts`
- [X] T036 [US5] Implement `refreshIfDisplaying()` method to update content when watched file changes in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T037 [US5] Implement `handleFileDeleted()` method to show "file not found" message in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T038 [US5] Register file watcher in extension activation in `src/extension.ts`

**Checkpoint**: At this point, panel focus and live updates work correctly

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T039 [P] Add VS Code theme variable mappings for light/dark/high-contrast modes in `webview/styles/spec-viewer.css`
- [X] T040 [P] Add loading indicator for large document rendering in `webview/styles/spec-viewer.css`
- [X] T041 Implement debounced rapid-click handling to prevent race conditions in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T042 Add error handling for file read failures with user-friendly messages in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T043 Add output channel logging for debugging in `src/features/spec-viewer/specViewerProvider.ts`
- [X] T044 Verify quickstart.md implementation steps are complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority but US2 depends on US1 panel infrastructure
  - US3 and US4 are both P2 priority and can proceed in parallel after US1/US2
  - US5 is P3 priority and can proceed after US1
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 - Needs panel infrastructure from US1
- **User Story 3 (P2)**: Can start after US1 - Independent markdown rendering
- **User Story 4 (P2)**: Can start after US1 - Independent edit functionality
- **User Story 5 (P3)**: Can start after US1 - Independent focus/watcher functionality

### Within Each User Story

- HTML template changes before webview JavaScript
- Extension-side handlers before webview message posting
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T002, T003 can run in parallel (different type definition files)
- T039, T040 can run in parallel (different CSS concerns)
- US3 and US4 can be worked on in parallel after US2 completes
- US5 can be started as soon as US1 completes (independent of US2-US4)

---

## Parallel Example: Setup Phase

```bash
# Launch all parallel tasks in Setup together:
Task: "Create type definitions in src/features/spec-viewer/types.ts"
Task: "Create webview-side type definitions in webview/src/spec-viewer/types.ts"
```

## Parallel Example: After US2 Completes

```bash
# US3 and US4 can proceed in parallel:
Developer A: User Story 3 (Markdown rendering)
Developer B: User Story 4 (Edit functionality)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (view document)
4. Complete Phase 4: User Story 2 (tab navigation)
5. **STOP and VALIDATE**: Test panel opens and navigation works
6. Deploy/demo if ready - users can view specs without tab clutter

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + 2 → Test → Deploy (MVP - panel with navigation!)
3. Add User Story 3 → Test → Deploy (Rendered markdown!)
4. Add User Story 4 → Test → Deploy (Edit button!)
5. Add User Story 5 → Test → Deploy (Live updates!)
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Performance goal: <500ms document switch (SC-002), <2s file change refresh (SC-005)
- Single panel instance requirement (SC-003) enforced by singleton pattern
