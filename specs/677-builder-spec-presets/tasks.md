# Tasks: Spec Kit presets in the Workflow Builder

> **Scale note**: two story phases on disjoint files after one shared type; the host and the webview build side by side.

## Phase 1: Setup

None.

## Phase 2: Foundational

**Wave 1:**
- [x] **T001** `SpecPreset` and `SpecPresetItem` types, the `specPresets` extension→builder message, and `presetSearch{query}`, `presetAdd{id}`, `presetUpdate{id}`, `presetRemove{id}` builder→extension messages (FR-001, FR-004) · apps/vscode/src/protocol/pipeline.ts

## Phase 3: User Stories 1-3, host side (Priority: P1)

Files: apps/vscode/src/features/pipeline-builder/specPresets.ts, apps/vscode/src/features/pipeline-builder/stockWorkflow.ts, apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/src/speckit/processExtensions.ts, apps/vscode/src/features/pipeline-builder/__tests__/specPresets.test.ts, apps/vscode/src/features/pipeline-builder/__tests__/stockWorkflow.test.ts

### Tests
- [x] **T002** [US1] [US2] [US3] Reader reads manifest and registry fields and provided items, survives a broken manifest and a missing registry; clash rule flags a replaced Companion-hooked command and a replaced stock template and exempts companion-standard; handlers refuse a bad id and run the right `specify preset` line after confirm (FR-001, FR-003, FR-004, FR-005, FR-006) · specPresets.test.ts

### Implementation
- [x] **T003** [P] [US1] [US2] `readSpecPresets(root)` and `companionReliesOn(root)` · specPresets.ts
- [x] **T004** [P] [US1] Export the stock template names; `presets()` delegates to the reader · stockWorkflow.ts
- [x] **T005** [P] [US3] `runSpecifyPreset(root, verb, arg)` in a reused visible terminal · processExtensions.ts
- [x] **T006** [US1] [US3] Watch `.registry`, post `specPresets` after `stock` and `graph`, four handlers with id check and modal confirm (FR-005, FR-006, FR-007) · builderPanel.ts

## Phase 4: User Stories 1-3, webview side (Priority: P1)

Files: apps/vscode/webview/src/pipeline-builder/PresetsPanel.tsx, apps/vscode/webview/src/pipeline-builder/index.tsx, apps/vscode/webview/src/pipeline-builder/Header.tsx, apps/vscode/webview/src/pipeline-builder/StockBoard.tsx, apps/vscode/webview/src/pipeline-builder/__tests__/PresetsPanel.test.tsx, apps/vscode/webview/src/pipeline-builder/__tests__/StockBoard.test.tsx, apps/vscode/webview/src/pipeline-builder/__stories__/PipelineBuilder.stories.tsx, apps/vscode/webview/src/pipeline-builder/__stories__/fixtures.ts

### Tests
- [x] **T007** [US1] [US2] [US3] Panel lists presets with items and clash warnings, shows the empty state, and posts the four messages; stock board shows the panel (FR-002, FR-003) · PresetsPanel.test.tsx, StockBoard.test.tsx

### Implementation
- [x] **T008** [US1] [US2] [US3] `PresetsPanel`: list, items, clash warning, search box, add/update/remove buttons · PresetsPanel.tsx
- [x] **T009** [US1] Hold `specPresets`, add side pane `presets`, Header menu item "Spec Kit presets", stock board uses the panel · index.tsx, Header.tsx, StockBoard.tsx
- [x] **T010** [US1] Stories for both views with a clashing preset · PipelineBuilder.stories.tsx, fixtures.ts

## Phase 5: Polish

- [x] **T011** [P] A "Spec Kit presets" section on the Builder page (FR-008) · apps/website/src/content/docs/docs/customize/workflow-builder.mdx
- [x] **T012** [P] One `[Unreleased]` line · CHANGELOG.md
- [x] **T013** Validate: `npx tsc --noEmit -p ./`, related jest, webview build, changelog test, `clips:check` · apps/vscode

## Dependencies & Execution Order

- T001 blocks Phases 3 and 4, which own disjoint files and run side by side. Polish last.
