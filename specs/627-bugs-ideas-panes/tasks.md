# Tasks: Bugs and Ideas panes

**Spec**: [bugs-ideas-panes.spec.md](./bugs-ideas-panes.spec.md) | **Plan**: [plan.md](./plan.md)

**Scale note**: About 18 files across the sidebar, the viewer's read-only path, the manifest and the docs. Watch two things: the Specs tree must behave the same once bugs leave it, and an idea must open through the path that today only knows bugs.

## Phase 1: Foundational

The shared reader, the extension probe, and the provider both panes use.

**Wave 1 — independent (different files):**

- [x] **T001** [P] Create the report-set reader: descriptor, read one folder and all folders, path helpers keyed on the set's directory, documents list; with tests on a real fixture · apps/vscode/src/features/reports/reportSet.ts, apps/vscode/src/features/reports/__tests__/reportSet.test.ts
- [x] **T002** [P] Create the process extension helpers: a present, absent or unknown probe for `.specify/extensions/<id>/`, and `runSpecifyExtensionAdd` for the ids `bug` and `assess` only; with tests · apps/vscode/src/speckit/processExtensions.ts, apps/vscode/src/speckit/__tests__/processExtensions.test.ts
- [x] **T003** [P] Add `Views.bugs`, `Views.ideas` and the three command ids · apps/vscode/src/core/constants.ts
- [x] **T004** [P] Contribute the two views after Specs, the three commands, the two Refresh title actions, and hide the install command from the palette · package.json

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T005** [P] Rebuild the bug reader on the report set, keeping its exports; add allow-listed verdict, severity, fix status and test result, and `bugState`; extend its tests for every state · apps/vscode/src/features/bugs/bugReports.ts, apps/vscode/src/features/bugs/__tests__/bugReports.test.ts
- [x] **T006** [P] Create the idea reader: the idea set, allow-listed verdict, latest stage, `ideaState`; with a fixture of three ideas and tests · apps/vscode/src/features/ideas/ideaReports.ts, apps/vscode/src/features/ideas/__tests__/ideaReports.test.ts, apps/vscode/tests/fixtures/idea-reports

**⟶ Wait for Wave 2 to finish, then:**

- [x] **T007** Create the pane provider: groups from a config, item rows, report child rows, one install or empty row, refresh; with tests · apps/vscode/src/features/processes/processPaneProvider.ts, apps/vscode/src/features/processes/__tests__/processPaneProvider.test.ts

## Phase 2: User Story 1 - Bugs have their own pane (P1)

Files: apps/vscode/src/features/bugs/bugsPane.ts, apps/vscode/src/features/bugs/__tests__/bugsPane.test.ts, apps/vscode/src/features/specs/specExplorerProvider.ts, apps/vscode/src/features/specs/__tests__/specExplorerBugs.test.ts, apps/vscode/src/features/specs/__tests__/specExplorerProvider.test.ts, apps/vscode/webview/src/spec-viewer/__stories__/SidebarCapture.stories.tsx

**Goal**: Bugs are grouped by state in their own pane and gone from Specs.

**Independent Test**: Bugs in each state land in the right group; the Specs tree lists none.

### Tests

- [x] **T008** [P] [US1] The bugs pane config puts each fixture bug in its group, shows severity and outcome, and opens a report with the viewer command · apps/vscode/src/features/bugs/__tests__/bugsPane.test.ts

### Implementation

**Wave 1 — independent (different files):**

- [x] **T009** [P] [US1] Create the bugs pane config: groups To fix, To test, Verified, Closed, the row text, the empty and install labels · apps/vscode/src/features/bugs/bugsPane.ts
- [x] **T010** [P] [US1] Remove the Bugs group, its rows and its filter and empty checks from the Specs tree; delete the bug tests there and keep the spec ones green · apps/vscode/src/features/specs/specExplorerProvider.ts, apps/vscode/src/features/specs/__tests__/specExplorerBugs.test.ts, apps/vscode/src/features/specs/__tests__/specExplorerProvider.test.ts
- [x] **T011** [P] [US1] Change the sidebar bug story to show the Bugs pane · apps/vscode/webview/src/spec-viewer/__stories__/SidebarCapture.stories.tsx

**Checkpoint**: The bugs pane config lists every fixture bug once.

## Phase 3: User Story 2 - Ideas have their own pane (P2)

Files: apps/vscode/src/features/ideas/ideasPane.ts, apps/vscode/src/features/ideas/__tests__/ideasPane.test.ts, apps/vscode/src/protocol/viewer.ts, apps/vscode/src/features/spec-viewer/specViewerProvider.ts, apps/vscode/src/features/spec-viewer/specViewerCommands.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/src/features/spec-viewer/__tests__/ideaPanel.test.ts, apps/vscode/src/features/spec-viewer/__tests__/bugPanel.test.ts

**Goal**: Ideas are listed by state and each stage opens read-only.

**Independent Test**: An assessing idea shows its latest stage, a decided one its verdict, and a stage opens in a read-only panel titled for the idea.

### Tests

- [x] **T012** [P] [US2] The ideas pane config groups the fixture ideas and shows stage or verdict · apps/vscode/src/features/ideas/__tests__/ideasPane.test.ts
- [x] **T013** [P] [US2] An idea stage opens in a read-only report panel, lists five documents, and writes nothing; the bug panel tests stay green · apps/vscode/src/features/spec-viewer/__tests__/ideaPanel.test.ts, apps/vscode/src/features/spec-viewer/__tests__/bugPanel.test.ts

### Implementation

**Wave 1 — independent (different files):**

- [x] **T014** [P] [US2] Create the ideas pane config: groups Assessing and Decided, the row text, the empty and install labels · apps/vscode/src/features/ideas/ideasPane.ts
- [x] **T015** [P] [US2] Generalise the viewer's bug path to a report set: panel state names the set, and the title prefix, fallback badge, default kind and path checks come from it; the open option accepts a set · apps/vscode/src/protocol/viewer.ts, apps/vscode/src/features/spec-viewer/specViewerProvider.ts, apps/vscode/src/features/spec-viewer/specViewerCommands.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts

**Checkpoint**: Any stage of any fixture idea opens read-only.

## Phase 4: User Story 3 - A pane says how to get its process (P3)

Files: apps/vscode/src/features/processes/processCommands.ts, apps/vscode/src/features/processes/__tests__/processCommands.test.ts, apps/vscode/src/extension.ts

**Goal**: Both panes are registered, stay fresh, and offer the install.

**Independent Test**: With no extension and no items a pane shows the install row, and choosing it starts the install in the project folder.

### Implementation

- [x] **T016** [US3] Register the two refresh commands and the install command, with tests for the allow-list and the working directory · apps/vscode/src/features/processes/processCommands.ts, apps/vscode/src/features/processes/__tests__/processCommands.test.ts

**⟶ Wait for T016, then:**

- [x] **T017** [US3] Register both panes; watch each set's directory and the two extension folders; refresh both on a project folder change; refresh an open report panel when its files change · apps/vscode/src/extension.ts

**Checkpoint**: The panes appear, update and offer the install.

## Phase 5: Polish

- [x] **T018** [P] Update the docs: sidebar reference, fix a bug, assess an idea, README, changelog, and the release-qa surface map · apps/website/src/content/docs/docs/navigate/the-sidebar.mdx, apps/website/src/content/docs/docs/processes/fix-a-bug.mdx, apps/website/src/content/docs/docs/processes/assess-an-idea.mdx, README.md, CHANGELOG.md, .claude/skills/release-qa/surface-map.yml
- [x] **T019** Run `npm run compile`, the webview type-check, `npm test`, `npm run test:canvas` and `npm run package`, and check each Success Criterion

## Dependencies & Execution Order

Foundational → US1 and US2 (disjoint files, either order) → US3 (wires both) → Polish. Foundational: Wave 1 (T001 to T004) blocks Wave 2 (T005, T006), which blocks T007. US3: T016 blocks T017. T019 runs last.
