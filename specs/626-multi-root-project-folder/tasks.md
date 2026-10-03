# Tasks: Find the Spec Kit project in a multi-root workspace

**Spec**: [multi-root-project-folder.spec.md](./multi-root-project-folder.spec.md) | **Plan**: [plan.md](./plan.md)

**Scale note**: 36 source files across every feature area swap an inline first-folder read for one resolver. The swap is mechanical; watch the roots cached at start-up and the two sites that keep a spec's own folder. Each area task owns its files and their tests.

## Phase 1: Foundational

The resolver and the swap. No story work starts before this is done.

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add `ConfigKeys.projectFolder` · apps/vscode/src/core/constants.ts
- [x] **T002** [P] Add `onDidChangeWorkspaceFolders` and `onDidChangeConfiguration` to the VS Code mock, with `__fire…` helpers · apps/vscode/tests/__mocks__/vscode.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** Create the resolver: `getProjectRoot`, `getProjectRootUri`, `hasSpecKitMarker`, `watchProjectRoot`, `onDidChangeProjectRoot`, with tests for one folder, detection order, the setting by name and by path, an unknown folder, an ambiguous pick, probe errors and change events · apps/vscode/src/core/projectRoot.ts, apps/vscode/src/core/__tests__/projectRoot.test.ts

**⟶ Wait for T003, then:**

**Wave 3 — independent (different files):**

- [x] **T004** [P] Swap core utilities, the Spec Kit helpers and the providers to the resolver; `ConfigManager` stops caching the root · apps/vscode/src/core/utils/fileSystemUtils.ts, apps/vscode/src/core/utils/configManager.ts, apps/vscode/src/speckit/integrationProvider.ts, apps/vscode/src/speckit/specKitExtensionInstall.ts, apps/vscode/src/speckit/specKitExtensionInstallCommands.ts, apps/vscode/src/ai-providers/claudeCodeProvider.ts, apps/vscode/src/ai-providers/cliTerminalProvider.ts, apps/vscode/src/ai-providers/geminiCliProvider.ts, apps/vscode/src/ai-providers/wibeyCliProvider.ts, apps/vscode/src/ai-providers/codexCliProvider.ts, apps/vscode/src/ai-providers/claudePanelProvider.ts, apps/vscode/src/ai-providers/promptBuilder.ts, apps/vscode/src/ai-providers/initOptions.ts
- [x] **T005** [P] Swap the Specs sidebar, its commands and the viewer; drop the two non-null assertions; an active editor outside the project resolves to no spec · apps/vscode/src/features/specs/specCommands.ts, apps/vscode/src/features/specs/specExplorerProvider.ts, apps/vscode/src/features/specs/pipelineBuildCommands.ts, apps/vscode/src/features/specs/sampleSpec.ts, apps/vscode/src/features/specs/selectionContextKeys.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/src/features/spec-viewer/specViewerProvider.ts, apps/vscode/src/features/spec-viewer/utils.ts
- [x] **T006** [P] Swap steering and living specs; add `rebuildProjectWatchers()` to the steering view; the living-specs status bar uses the project root and claims nothing for a file outside it · apps/vscode/src/features/steering/steeringExplorerProvider.ts, apps/vscode/src/features/steering/steeringManager.ts, apps/vscode/src/features/living-specs/livingSpecsCommands.ts, apps/vscode/src/features/living-specs/livingSpecsExplorerProvider.ts, apps/vscode/src/features/living-specs/livingSpecsStatusBar.ts
- [x] **T007** [P] Swap workflows, the spec editor, the Pipeline Builder, agents and skills; cached roots become getters; the two spec-owner sites change only their fallback · apps/vscode/src/features/workflows/workflowSelector.ts, apps/vscode/src/features/workflows/pipelineResolution.ts, apps/vscode/src/features/workflows/workflowManager.ts, apps/vscode/src/features/workflows/checkpointHandler.ts, apps/vscode/src/features/spec-editor/specEditorProvider.ts, apps/vscode/src/features/spec-editor/tempFileManager.ts, apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/src/features/agents/agentManager.ts, apps/vscode/src/features/skills/skillManager.ts

## Phase 2: User Story 1 - Companion finds the Spec Kit folder wherever it sits (P1)

Files: apps/vscode/src/speckit/detector.ts, apps/vscode/src/speckit/__tests__/detector.test.ts, apps/vscode/tests/integration/projectRootUsage.test.ts

**Goal**: Detection and every surface agree on the same folder.

**Independent Test**: Two folders, Spec Kit in the second: the detector reports it initialized and no source file reads the first folder directly.

### Tests

- [x] **T008** [P] [US1] No source file outside the resolver and a short allow-list reads the first workspace folder directly · apps/vscode/tests/integration/projectRootUsage.test.ts

### Implementation

- [x] **T009** [US1] The detector probes the project root with `hasSpecKitMarker` and starts its init and upgrade terminals there; a two-folder test covers Spec Kit in the second folder · apps/vscode/src/speckit/detector.ts, apps/vscode/src/speckit/__tests__/detector.test.ts

**Checkpoint**: A workspace whose Spec Kit folder is second is detected and listed.

## Phase 3: User Story 2 - Pick the project folder by hand (P2)

Files: package.json, docs/configuration.md, apps/website/src/content/docs/docs/reference/configuration.mdx

**Goal**: The setting exists, is documented, and wins over detection.

**Independent Test**: The manifest declares `speckit.projectFolder` as a window-scoped string with an empty default, and both references describe it.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T010** [P] [US2] Declare `speckit.projectFolder` in the manifest: string, default empty, window scope, next free order · package.json
- [x] **T011** [P] [US2] Document the setting, how detection chooses, and the two limits · docs/configuration.md, apps/website/src/content/docs/docs/reference/configuration.mdx

**Checkpoint**: Setting the folder switches the project.

## Phase 4: User Story 3 - Follow the workspace as folders come and go (P3)

Files: apps/vscode/src/extension.ts

**Goal**: A setting or workspace-folder change takes effect without a reload.

**Independent Test**: Fire a workspace-folder change that moves the project; the views refresh and detection re-runs.

### Implementation

- [x] **T012** [US3] Start `watchProjectRoot`; on `onDidChangeProjectRoot` refresh the three tree views and open viewer panels, re-run detection, re-run `wireCompanionSurfaces` and rebuild the steering watchers; swap the file's own first-folder reads · apps/vscode/src/extension.ts

**Checkpoint**: Adding, removing or choosing a folder updates the window.

## Phase 5: Polish

- [x] **T013** [P] Note the resolver in the architecture doc and add the changelog entry · docs/architecture.md, CHANGELOG.md
- [x] **T014** Run `npm run compile`, the webview type-check, `npm test`, `npm run test:canvas` and `npm run package`, and check each Success Criterion

## Dependencies & Execution Order

Foundational → US1, US2 and US3 (disjoint files, any order) → Polish. Foundational: Wave 1 (T001, T002) blocks T003, which blocks Wave 3 (T004 to T007). US1: T008 and T009 are independent of each other but T008 passes only after Wave 3 and T012. T014 runs last.
