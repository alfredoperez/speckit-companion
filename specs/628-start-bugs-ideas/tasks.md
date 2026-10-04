# Tasks: Start and continue a bug or an idea from Companion

**Spec**: [start-bugs-ideas.spec.md](./start-bugs-ideas.spec.md) | **Plan**: [plan.md](./plan.md)

**Scale note**: About 20 files in three groups with no shared file: the create screen, the report footer, and the Create Spec prefill. The create screen serves both bugs and ideas, so the New Idea action is built with New Bug.

## Phase 1: Foundational

**Wave 1 — independent (different files):**

- [x] **T001** [P] Create the create-screen protocol: message types, `slugFromText`, `normaliseSlug`; with tests for unsafe and long input · apps/vscode/src/protocol/processCreate.ts, apps/vscode/src/protocol/__tests__/processCreate.test.ts
- [x] **T002** [P] Create the button rules: `bugActions`, `ideaActions` and the action-to-command map, with a test for every row of the plan's table · apps/vscode/src/features/processes/processActions.ts, apps/vscode/src/features/processes/__tests__/processActions.test.ts
- [x] **T003** [P] Add the two create commands: ids, manifest entries, and a + title action on each pane · apps/vscode/src/core/constants.ts, package.json, apps/vscode/src/features/specs/__tests__/manifest.test.ts

## Phase 2: User Story 1 - Start a bug from Companion (P1)

Files: apps/vscode/src/features/process-create/processCreateProvider.ts, apps/vscode/src/features/process-create/processCreateCommands.ts, apps/vscode/src/features/process-create/__tests__/processCreateProvider.test.ts, apps/vscode/src/features/process-create/__tests__/processCreateCommands.test.ts, apps/vscode/webview/src/process-create/index.ts, apps/vscode/webview/src/process-create/ProcessCreateMock.tsx, apps/vscode/webview/src/process-create/__stories__/ProcessCreate.stories.tsx, webpack.config.js, apps/vscode/src/extension.ts

**Goal**: New Bug and New Idea open from their panes and send the assess command.

**Independent Test**: Submit a symptom and a slug; the assistant gets the assess command with the slug and the path of a file holding the symptom.

### Tests

- [x] **T004** [P] [US1] The provider writes the text to a file, sends the prompt with a re-normalised slug, refuses an empty or existing slug, keeps the screen open on failure; the command offers the install when the extension is missing · apps/vscode/src/features/process-create/__tests__/processCreateProvider.test.ts, apps/vscode/src/features/process-create/__tests__/processCreateCommands.test.ts

### Implementation

**Wave 1 — independent (different files):**

- [x] **T005** [P] [US1] Build the provider for both kinds and the two commands, including the missing-extension check · apps/vscode/src/features/process-create/processCreateProvider.ts, apps/vscode/src/features/process-create/processCreateCommands.ts
- [x] **T006** [P] [US1] Build the screen: fields, slug that follows the first field until edited, the exists message, submit gate, loading and error states; a story mock for both kinds; the bundle entry · apps/vscode/webview/src/process-create/index.ts, apps/vscode/webview/src/process-create/ProcessCreateMock.tsx, apps/vscode/webview/src/process-create/__stories__/ProcessCreate.stories.tsx, webpack.config.js

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T007** [US1] Register the create commands at activation · apps/vscode/src/extension.ts

**Checkpoint**: + on either pane opens its screen and a submit reaches the assistant.

## Phase 3: User Story 2 - Fix and test a bug from its page (P1)

Files: apps/vscode/src/protocol/viewer.ts, apps/vscode/src/features/spec-viewer/html/generator.ts, apps/vscode/src/features/spec-viewer/specViewerProvider.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/src/features/spec-viewer/__tests__/bugPanel.test.ts, apps/vscode/src/features/spec-viewer/__tests__/ideaPanel.test.ts, apps/vscode/src/features/spec-viewer/__tests__/messageHandlers.test.ts, apps/vscode/webview/src/spec-viewer/components/footer/ReportFooter.tsx, apps/vscode/webview/src/spec-viewer/components/FooterActions.tsx, apps/vscode/webview/src/spec-viewer/components/__tests__/FooterActions.test.tsx, apps/vscode/webview/src/spec-viewer/__stories__/BugReport.stories.tsx

**Goal**: A bug or idea page offers its next step and sends it.

**Independent Test**: A bug with only an assessment shows Fix bug; choosing it sends the fix command with the folder's slug; a forged id is dropped.

### Tests

- [x] **T008** [P] [US2] Report panels carry the right actions per state, a `reportAction` dispatches the matching command with the folder's slug, an id the state does not offer is dropped, and every other write is still dropped · apps/vscode/src/features/spec-viewer/__tests__/bugPanel.test.ts, apps/vscode/src/features/spec-viewer/__tests__/ideaPanel.test.ts, apps/vscode/src/features/spec-viewer/__tests__/messageHandlers.test.ts
- [x] **T009** [P] [US2] The report footer renders a main and secondary buttons and posts the id · apps/vscode/webview/src/spec-viewer/components/__tests__/FooterActions.test.tsx

### Implementation

**Wave 1 — independent (different files):**

- [x] **T010** [P] [US2] Send each report panel's actions in its nav state and handle `reportAction`: re-read the item, check the id, dispatch the command, or open Create Spec for a go idea · apps/vscode/src/protocol/viewer.ts, apps/vscode/src/features/spec-viewer/html/generator.ts, apps/vscode/src/features/spec-viewer/specViewerProvider.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts
- [x] **T011** [P] [US2] Render the report footer and add its stories · apps/vscode/webview/src/spec-viewer/components/footer/ReportFooter.tsx, apps/vscode/webview/src/spec-viewer/components/FooterActions.tsx, apps/vscode/webview/src/spec-viewer/__stories__/BugReport.stories.tsx

**Checkpoint**: Every state in the plan's table shows its buttons, and they follow the files.

## Phase 4: User Story 3 - Start and continue an idea (P2)

Files: apps/vscode/src/protocol/spec-editor.ts, apps/vscode/src/features/spec-editor/specEditorProvider.ts, apps/vscode/src/features/spec-editor/specEditorCommands.ts, apps/vscode/src/features/spec-editor/__tests__/specEditorProvider.prefill.test.ts, apps/vscode/webview/src/spec-editor/index.ts

**Goal**: A go idea opens Create Spec with its description filled in.

**Independent Test**: Run the open command with a description; an empty editor shows it, and an editor with text asks before replacing it.

### Implementation

- [x] **T012** [US3] Let Create Spec open with a description: the command and `show` take an optional string, `init` carries it, an open panel receives it, and text already typed is not replaced without asking; with tests · apps/vscode/src/protocol/spec-editor.ts, apps/vscode/src/features/spec-editor/specEditorProvider.ts, apps/vscode/src/features/spec-editor/specEditorCommands.ts, apps/vscode/src/features/spec-editor/__tests__/specEditorProvider.prefill.test.ts, apps/vscode/webview/src/spec-editor/index.ts

**Checkpoint**: Create spec from this idea lands on a filled Create Spec screen.

## Phase 5: Polish

- [x] **T013** [P] Document starting a bug and an idea and the page buttons · apps/website/src/content/docs/docs/navigate/the-sidebar.mdx, apps/website/src/content/docs/docs/processes/fix-a-bug.mdx, apps/website/src/content/docs/docs/processes/assess-an-idea.mdx, README.md, CHANGELOG.md
- [x] **T014** Run `npm run compile`, the webview type-check, `npm test`, `npm run test:canvas`, the site build and `npm run package`, and check each Success Criterion

## Dependencies & Execution Order

Foundational → US1, US2 and US3 (disjoint files, any order) → Polish. US1: T005 and T006 block T007. US2 calls the open command US3 extends, by its id only. T014 runs last.
