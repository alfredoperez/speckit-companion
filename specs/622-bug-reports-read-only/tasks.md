# Tasks: Bug reports in the sidebar and viewer (read-only)

**Input**: [bug-reports-read-only.spec.md](./bug-reports-read-only.spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md)

Real report fixtures are already in place at `apps/vscode/tests/fixtures/bug-reports/.specify/bugs/` (`cart-total-skips-first` with all three reports, `slug-keeps-spaces` with an assessment only). Tests read them with the real `fs`.

## Phase 1: Foundational

Files: `apps/vscode/src/features/bugs/bugReports.ts`, `apps/vscode/src/features/bugs/__tests__/bugReports.test.ts`, `apps/vscode/src/protocol/viewer.ts`, `apps/vscode/src/extension.ts`

**Wave 1 — independent (different files):**

- [x] **T001** [P] Write the bug report reader: `readBugReports(workspaceRoot)` scans `.specify/bugs/*/`, skips folders that resolve outside the bugs root (by real path, so a linked folder cannot escape) or hold none of `assessment.md`, `fix.md`, `test.md`, parses the title heading and the `**Verdict**`, `**Severity**`, `**Status**`, `**Result**` header bullets from the leading block, derives `stages` and `outcome`, sorts by slug; plus `bugReportDocuments(bugDir)` returning the three `SpecDocument`s and `bugDirectoryOf(filePath)` · `apps/vscode/src/features/bugs/bugReports.ts`
- [x] **T002** [P] Add `bug?: boolean` to `SpecViewerState` (the panel key is already the bug folder) · `apps/vscode/src/protocol/viewer.ts`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T003** [P] BDD tests for the reader against the real fixtures: two bugs found, stages and outcomes (`verified`, `valid`), severity, titles, absent folder and empty folder return nothing, a folder with only other files is skipped, a missing label is absent, a body `**Status**` is not read as the fix status, a traversal name is ignored · `apps/vscode/src/features/bugs/__tests__/bugReports.test.ts`
- [x] **T004** [P] Register a debounced watcher on `.specify/bugs/**` next to the living-specs watcher: refresh the Specs tree on create, change and delete; call `specViewer.refreshIfDisplaying` on create and change; call `specViewer.handleSpecDirectoryGone` for a deleted bug folder · `apps/vscode/src/extension.ts`

## Phase 2: User Story 1 - See which bugs have reports (P1)

Files: `apps/vscode/src/features/specs/specExplorerProvider.ts`, `apps/vscode/src/features/specs/__tests__/specExplorerBugs.test.ts`

**Goal**: the Specs view lists bugs in their own group with stages and outcome. **Independent Test**: with the fixtures as the workspace, the root shows `Bugs (2)` and two entries reading `assess · fix · test · verified` and `assess · valid`.

### Tests

- [x] **T005** [US1] BDD tests: Bugs group after the lifecycle groups, `Bugs (2)` collapsed with id `bug-group`; bug rows with `bug:<slug>` ids, `bug-report` context value, stage and outcome description, click args `[<first report>, { bug: true }]`; report rows with `not created` and no command when missing; no Bugs group without bugs and the root unchanged; bugs alone when there are no specs; filter narrows bugs and an unmatched filter leaves the root empty; no bug context value starts with `spec-` · `apps/vscode/src/features/specs/__tests__/specExplorerBugs.test.ts`

### Implementation

- [x] **T006** [US1] Add the Bugs group, bug rows and report rows to `getChildren` using `readBugReports`, including the bugs-only root and the filter, with stable ids and ThemeIcon icons · `apps/vscode/src/features/specs/specExplorerProvider.ts`

**Checkpoint**: the sidebar lists bugs and opens nothing new yet beyond the existing command.

## Phase 3: User Story 2 - Read a bug's reports in the viewer (P1)

Files: `apps/vscode/src/features/spec-viewer/specViewerCommands.ts`, `apps/vscode/src/features/spec-viewer/specViewerProvider.ts`, `apps/vscode/src/features/spec-viewer/messageHandlers.ts`, `apps/vscode/src/features/spec-viewer/html/generator.ts`, `apps/vscode/webview/src/spec-viewer/editor/readOnly.ts`, `apps/vscode/webview/src/spec-viewer/actions.ts`, `apps/vscode/webview/styles/spec-viewer/_line-actions.css`, `apps/vscode/src/features/spec-viewer/__tests__/bugPanel.test.ts`

**Goal**: a bug opens read-only in the viewer with Assessment, Fix, Test on the rail. **Independent Test**: open `cart-total-skips-first` and switch tabs; open `slug-keeps-spaces` and see Fix and Test disabled; nothing is written.

### Tests

- [x] **T007** [US2] BDD tests: `show(path, { bug: true })` opens one panel keyed by the bug folder titled `Bug: <title>`, renders with three documents and the right `exists`, passes no phases, no activity panel, read-only, never calls the spec-context writer and never creates `.spec-context.json`; a second open reuses the panel; a write message (`toggleCheckbox`, `addComment`, `editLine`) from a bug panel is dropped while `switchDocument` is handled · `apps/vscode/src/features/spec-viewer/__tests__/bugPanel.test.ts`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T008** [P] [US2] Accept `{ bug?: boolean }` on `speckit.viewSpecDocument` and pass it to `show` · `apps/vscode/src/features/spec-viewer/specViewerCommands.ts`
- [x] **T009** [P] [US2] Add a trailing `readOnly` parameter that writes `data-read-only` on `<body>` · `apps/vscode/src/features/spec-viewer/html/generator.ts`
- [x] **T010** [P] [US2] Drop every message except ready, switchDocument, stepperClick, refreshContent, openFile, editSource and webviewError when the panel is a bug panel, with one log line · `apps/vscode/src/features/spec-viewer/messageHandlers.ts`
- [x] **T011** [P] [US2] `isReadOnly()` also returns true for `data-read-only` · `apps/vscode/webview/src/spec-viewer/editor/readOnly.ts`
- [x] **T012** [P] [US2] The checkbox toggle does nothing when `isReadOnly()` · `apps/vscode/webview/src/spec-viewer/actions.ts`
- [x] **T013** [P] [US2] Hide line and row add buttons and the hover tint under `body[data-read-only]` · `apps/vscode/webview/styles/spec-viewer/_line-actions.css`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T014** [US2] Add `showBug` and `updateBugContent` beside the living path, route `bug` panels in `updateContent`, `sendContentUpdateMessage`, `refreshIfDisplaying`, `refreshContextIfDisplaying`, `refreshOpenPanels`, `refreshPanelTitle` and `markSpecMoved`, with the parsed title as header and the outcome (or `BUG`) as badge · `apps/vscode/src/features/spec-viewer/specViewerProvider.ts`

**Checkpoint**: clicking a bug in the sidebar opens it read-only with three tabs.

## Phase 4: User Story 3 - Documented and in Storybook (P2)

Files: `apps/vscode/webview/src/spec-viewer/__stories__/BugReport.stories.tsx`, `apps/vscode/webview/src/spec-viewer/__stories__/SidebarCapture.stories.tsx`, `capabilities/sidebar/browse-specs.spec.md`, `capabilities/spec-viewer/read-a-spec.spec.md`, `apps/website/src/content/docs/docs/anatomy/the-sidebar.mdx`, `apps/website/src/content/docs/docs/anatomy/anatomy-of-the-spec-viewer.mdx`, `CHANGELOG.md`

**Wave 1 — independent (different files):**

- [x] **T015** [P] [US3] Viewer stories `All reports` and `Assessment only` under `VS Code Extension/Spec Viewer/Bug report`, mounting the real App with the fixture text imported `?raw`, `data-read-only` set and reset on unmount · `apps/vscode/webview/src/spec-viewer/__stories__/BugReport.stories.tsx`
- [x] **T016** [P] [US3] Sidebar story `B6 · Bug reports` showing the Bugs group under the spec groups, without changing the existing B1-B5 frames · `apps/vscode/webview/src/spec-viewer/__stories__/SidebarCapture.stories.tsx`
- [x] **T017** [P] [US3] Requirement "Bug reports sit in their own group" with scenarios and `touches:` markers · `capabilities/sidebar/browse-specs.spec.md`
- [x] **T018** [P] [US3] Requirement "A bug report opens read-only with its reports as tabs" with scenarios and `touches:` markers · `capabilities/spec-viewer/read-a-spec.spec.md`
- [x] **T019** [P] [US3] Short "Bug reports" section · `apps/website/src/content/docs/docs/anatomy/the-sidebar.mdx`
- [x] **T020** [P] [US3] Short "Bug reports" section · `apps/website/src/content/docs/docs/anatomy/anatomy-of-the-spec-viewer.mdx`
- [x] **T021** [P] [US3] One user-facing line under `### Added` of `## [Unreleased]` · `CHANGELOG.md`

**Checkpoint**: docs, living specs and stories describe the feature.

## Phase 5: Polish

- [x] **T022** Validate against the Success Criteria: full `npx jest`, `npm run compile`, `npx tsc -p tsconfig.webview.json --noEmit`, `python3 apps/speckit-extension/scripts/living_validate.py`, `python3 apps/speckit-extension/scripts/drift.py --since main --working`; fix what they flag

## Dependencies & Execution Order

- Phase 1 blocks everything: Wave 1 (T001, T002) then Wave 2 (T003, T004).
- Phase 2 (US1) and Phase 3 (US2) own disjoint files and can run side by side once Phase 1 is done. In US1, T005 and T006 share a feature and run in order. In US2, Wave 1 (T008 to T013) runs before T014, and T007 is written alongside and must pass after T014.
- Phase 4 (US3) can start once Phases 2 and 3 are done, since the living specs and docs describe what they built. Its seven tasks are one wave.
- Phase 5 runs last.
