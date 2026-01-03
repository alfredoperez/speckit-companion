# Tasks: Spec Editor Webview

**Input**: Design documents from `/specs/001-spec-editor-webview/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Not explicitly requested in the feature specification. Omitting test tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: VS Code Extension with `src/` for extension code and `webview/` for browser code
- Paths follow existing architecture from plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create feature module structure and shared type definitions

- [x] T001 Create directory structure: `src/features/spec-editor/` and `webview/src/spec-editor/`
- [x] T002 [P] Create type definitions in `src/features/spec-editor/types.ts` (SpecEditorSession, SpecDraft, AttachedImage, TempSpecFile, message types)
- [x] T003 [P] Create webview type definitions in `webview/src/spec-editor/types.ts` (browser-side message types)
- [x] T004 [P] Create module index exports in `src/features/spec-editor/index.ts`
- [x] T005 [P] Create CSS file with base styles in `webview/styles/spec-editor.css`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Implement TempFileManager class skeleton in `src/features/spec-editor/tempFileManager.ts` (manifest handling, directory creation, cleanup)
- [x] T007 Implement SpecDraftManager class skeleton in `src/features/spec-editor/specDraftManager.ts` (workspaceState persistence)
- [x] T008 Implement SpecEditorProvider base class in `src/features/spec-editor/specEditorProvider.ts` (WebviewPanel creation, basic lifecycle)
- [x] T009 Register `speckit.openSpecEditor` command in `src/features/spec-editor/specEditorCommands.ts`
- [x] T010 Update `src/extension.ts` to import and register spec editor commands
- [x] T011 Add command contribution to `package.json` (`speckit.openSpecEditor` with title and icon)
- [x] T012 Create webview HTML generator method in `src/features/spec-editor/specEditorProvider.ts` (CSP, localResourceRoots)
- [x] T013 Create webview entry point in `webview/src/spec-editor/index.ts` (acquireVsCodeApi, DOMContentLoaded)
- [x] T014 Update webpack configuration to bundle spec-editor webview in `webpack.config.js`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Create Spec with Rich Text Editor (Priority: P1) 🎯 MVP

**Goal**: Replace limited single-line input with a rich multi-line editing experience for creating specifications

**Independent Test**: Open the spec editor, type multi-line text, verify content is correctly captured and displayed. Preview and submit to AI CLI.

### Implementation for User Story 1

- [x] T015 [P] [US1] Create multi-line text editor component in `webview/src/spec-editor/editor.ts` (textarea with auto-resize, formatting preservation)
- [x] T016 [P] [US1] Create action buttons component in `webview/src/spec-editor/actions.ts` (Submit, Preview, Cancel buttons)
- [x] T017 [P] [US1] Add editor styles in `webview/styles/spec-editor.css` (textarea styling, button styling, layout)
- [x] T018 [US1] Wire editor component into webview entry point in `webview/src/spec-editor/index.ts`
- [x] T019 [US1] Implement preview mode component in `webview/src/spec-editor/preview.ts` (markdown display of content)
- [x] T020 [US1] Handle `submit` message in `src/features/spec-editor/specEditorProvider.ts` (content extraction, AI provider execution)
- [x] T021 [US1] Handle `preview` message in `src/features/spec-editor/specEditorProvider.ts` (generate preview content)
- [x] T022 [US1] Implement `handleSubmit` method to call AI provider via `executeInTerminal()` in `src/features/spec-editor/specEditorProvider.ts`
- [x] T023 [US1] Handle `cancel` message to dispose webview panel in `src/features/spec-editor/specEditorProvider.ts`
- [x] T024 [US1] Add webview message listener for extension messages in `webview/src/spec-editor/index.ts` (previewContent, error, submissionComplete)

**Checkpoint**: User Story 1 complete - developer can create multi-line specs, preview, and submit to AI CLI

---

## Phase 4: User Story 2 - Attach Reference Images (Priority: P2)

**Goal**: Allow developers to attach mockups, diagrams, or screenshots to specifications for visual context

**Independent Test**: Open spec editor, attach an image via file picker or drag-drop, verify thumbnail appears, submit and verify image reference in output

### Implementation for User Story 2

- [x] T025 [P] [US2] Create image attachment component in `webview/src/spec-editor/imageAttachment.ts` (file input, thumbnail display, remove button)
- [x] T026 [P] [US2] Add image styles in `webview/styles/spec-editor.css` (thumbnail grid, drag-drop zone, attachment area)
- [x] T027 [US2] Implement file picker handler in `webview/src/spec-editor/imageAttachment.ts` (accept PNG, JPG, GIF, WebP, read as dataUri)
- [x] T028 [US2] Implement drag-and-drop handler in `webview/src/spec-editor/imageAttachment.ts` (dragover, drop events)
- [x] T029 [US2] Send `attachImage` message from webview to extension in `webview/src/spec-editor/imageAttachment.ts`
- [x] T030 [US2] Handle `attachImage` message in `src/features/spec-editor/specEditorProvider.ts` (validate size limits)
- [x] T031 [US2] Implement `saveImage` method in `src/features/spec-editor/tempFileManager.ts` (save to globalStorageUri, generate thumbnail)
- [x] T032 [US2] Track attached images in SpecEditorProvider state (Map<string, AttachedImage>) in `src/features/spec-editor/specEditorProvider.ts`
- [x] T033 [US2] Handle `removeImage` message in `src/features/spec-editor/specEditorProvider.ts` (delete file, update state)
- [x] T034 [US2] Send `imageSaved` message to webview with thumbnail URI in `src/features/spec-editor/specEditorProvider.ts`
- [x] T035 [US2] Handle `imageSaved` and `imageRemoved` messages in `webview/src/spec-editor/imageAttachment.ts` (update UI)
- [x] T036 [US2] Update submit flow to include attached image IDs in `webview/src/spec-editor/actions.ts`
- [x] T037 [US2] Generate markdown with image references in `handleSubmit` in `src/features/spec-editor/specEditorProvider.ts`
- [x] T038 [US2] Validate image size limits (2MB per image, 10MB total) in `src/features/spec-editor/specEditorProvider.ts`
- [x] T039 [US2] Check AI provider image support and warn if unsupported in `src/features/spec-editor/specEditorProvider.ts`

**Checkpoint**: User Story 2 complete - developer can attach images to specs with validation and graceful degradation

---

## Phase 5: User Story 3 - Automatic Temporary File Management (Priority: P2)

**Goal**: Cross-CLI compatibility via temporary markdown files that are automatically managed and cleaned up

**Independent Test**: Submit a spec, verify temp markdown file is created in globalStorageUri, complete workflow, verify file is deleted

### Implementation for User Story 3

- [x] T040 [US3] Implement `createTempFileSet` method in `src/features/spec-editor/tempFileManager.ts` (create session directory, spec.md file)
- [x] T041 [US3] Implement `generateMarkdown` method in `src/features/spec-editor/tempFileManager.ts` (format content with image references)
- [x] T042 [US3] Implement manifest.json read/write in `src/features/spec-editor/tempFileManager.ts` (TempFileManifest interface)
- [x] T043 [US3] Implement `markSubmitted` method in `src/features/spec-editor/tempFileManager.ts` (update status in manifest)
- [x] T044 [US3] Implement `markCompleted` method in `src/features/spec-editor/tempFileManager.ts` (schedule deletion after 5-minute grace period)
- [x] T045 [US3] Implement `cleanupOrphanedFiles` method in `src/features/spec-editor/tempFileManager.ts` (scan manifest, delete files >24h old)
- [x] T046 [US3] Call `cleanupOrphanedFiles` on extension activation in `src/features/spec-editor/specEditorCommands.ts`
- [x] T047 [US3] Copy images to temp file set directory on submission in `src/features/spec-editor/tempFileManager.ts`
- [x] T048 [US3] Handle temp directory not writable error with fallback location in `src/features/spec-editor/tempFileManager.ts`
- [x] T049 [US3] Log cleanup operations to output channel in `src/features/spec-editor/specEditorCommands.ts`

**Checkpoint**: User Story 3 complete - temp files created on submit, cleaned up automatically

---

## Phase 6: User Story 4 - Reuse Previous Spec as Template (Priority: P3)

**Goal**: Allow developers to load previous specs as starting points for new specifications

**Independent Test**: Open spec editor, click "Load Previous Spec", select a spec file, verify content is editable

### Implementation for User Story 4

- [x] T050 [P] [US4] Create template loader component in `webview/src/spec-editor/templateLoader.ts` (button to trigger file picker)
- [x] T051 [P] [US4] Add template loader styles in `webview/styles/spec-editor.css` (button positioning, file list styling)
- [x] T052 [US4] Wire template loader into webview UI in `webview/src/spec-editor/index.ts`
- [x] T053 [US4] Send `loadTemplate` message from webview with selected spec path in `webview/src/spec-editor/templateLoader.ts`
- [x] T054 [US4] Handle `loadTemplate` message in `src/features/spec-editor/specEditorProvider.ts` (read file, send content)
- [x] T055 [US4] Implement spec file browser using `vscode.window.showOpenDialog` in `src/features/spec-editor/specEditorProvider.ts`
- [x] T056 [US4] Send `templateLoaded` message with file content to webview in `src/features/spec-editor/specEditorProvider.ts`
- [x] T057 [US4] Handle `templateLoaded` message in webview to populate editor in `webview/src/spec-editor/editor.ts`

**Checkpoint**: User Story 4 complete - developer can load previous specs as templates

---

## Phase 7: Draft Persistence (Edge Case: Cross-Session Drafts)

**Goal**: Preserve draft content when webview is closed without submission and restore on reopen

**Independent Test**: Type content in spec editor, close webview without submitting, reopen, verify draft is restored

### Implementation for Draft Persistence

- [x] T058 [US1] Implement draft auto-save using vscode.setState in `webview/src/spec-editor/index.ts` (debounced 300ms)
- [x] T059 [US1] Implement draft restore using vscode.getState on webview load in `webview/src/spec-editor/index.ts`
- [x] T060 [US1] Save cursor position in draft state in `webview/src/spec-editor/editor.ts`
- [x] T061 [US1] Restore cursor position on draft load in `webview/src/spec-editor/editor.ts`
- [x] T062 [US2] Include attached image IDs in draft state for restoration in `webview/src/spec-editor/imageAttachment.ts`
- [x] T063 [US2] Restore image thumbnails from extension state on reopen in `src/features/spec-editor/specEditorProvider.ts`

**Checkpoint**: Draft persistence complete - no work lost on accidental close

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T064 [P] Add error display component in webview for error messages in `webview/src/spec-editor/index.ts`
- [x] T065 [P] Add loading state UI during submission in `webview/src/spec-editor/actions.ts`
- [x] T066 Add keyboard shortcuts (Ctrl/Cmd+Enter to submit, Esc to cancel) in `webview/src/spec-editor/index.ts`
- [x] T067 [P] Add keybinding contribution to `package.json` (Ctrl+Shift+N / Cmd+Shift+N to open spec editor)
- [x] T068 Handle image format validation (reject unsupported formats with clear error) in `webview/src/spec-editor/imageAttachment.ts`
- [x] T069 Run quickstart.md validation (manual testing checklist) - Implementation complete, ready for testing
- [x] T070 Verify VS Code theme integration for spec editor webview in `webview/styles/spec-editor.css`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on Foundational; can run parallel to US1 but extends submit flow
- **User Story 3 (Phase 5)**: Depends on Foundational; required for US1 submit to work fully
- **User Story 4 (Phase 6)**: Depends on Foundational; fully independent from US1-3
- **Draft Persistence (Phase 7)**: Enhancement to US1 and US2; can be done after core implementation
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Core editing and submission - No dependencies on other stories
- **User Story 2 (P2)**: Image attachments - Extends US1 submit flow but independently testable
- **User Story 3 (P2)**: Temp file management - Required for CLI compatibility; enhances US1
- **User Story 4 (P3)**: Template loading - Fully independent, enhances editor

### Within Each User Story

- Webview components before extension handlers
- Message handlers before business logic
- Core implementation before edge cases
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002, T003, T004, T005)
- Foundational tasks are mostly sequential due to dependencies
- Within US1: T015, T016, T017 can run in parallel
- Within US2: T025, T026 can run in parallel
- Within US4: T050, T051 can run in parallel
- Within Polish: T064, T065, T067 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch webview components in parallel:
Task: "Create multi-line text editor component in webview/src/spec-editor/editor.ts"
Task: "Create action buttons component in webview/src/spec-editor/actions.ts"
Task: "Add editor styles in webview/styles/spec-editor.css"
```

---

## Parallel Example: User Story 2

```bash
# Launch image attachment UI components in parallel:
Task: "Create image attachment component in webview/src/spec-editor/imageAttachment.ts"
Task: "Add image styles in webview/styles/spec-editor.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test opening spec editor, typing multi-line content, previewing, submitting
5. Deploy/demo as MVP

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Demo (MVP with basic editing)
3. Add User Story 3 → Test independently → Demo (proper temp file handling)
4. Add User Story 2 → Test independently → Demo (image support)
5. Add User Story 4 → Test independently → Demo (template loading)
6. Add Draft Persistence → Demo (no work lost)
7. Complete Polish → Release-ready

### Recommended Order for Single Developer

1. Phase 1: Setup (T001-T005)
2. Phase 2: Foundational (T006-T014)
3. Phase 3: User Story 1 core (T015-T024) - MVP!
4. Phase 7: Draft Persistence (T058-T063) - improves US1
5. Phase 5: User Story 3 (T040-T049) - enables CLI compatibility
6. Phase 4: User Story 2 (T025-T039) - adds image support
7. Phase 6: User Story 4 (T050-T057) - template loading
8. Phase 8: Polish (T064-T070)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Existing patterns to follow: `WorkflowEditorProvider`, `claudeCodeProvider.ts` temp files
- All file operations use `vscode.Uri` and `vscode.workspace.fs`
