# Tasks: Sidebar Spec Status Indicators

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-01

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add types and rename constant — `src/features/workflows/types.ts` | R001
  - **Do**: Rename `FEATURE_CONTEXT_FILE` from `'.speckit.json'` to `'.spec-context.json'`. Add `SpecStatus` type (`"active" | "completed" | "archived"`), `StepHistoryEntry` interface (`startedAt: string, completedAt: string | null`). Extend `FeatureWorkflowContext` with optional `status?: SpecStatus`, `stepHistory?: Record<string, StepHistoryEntry>`. Add optional SDD fields: `step?, substep?, task?, next?, updated?, approach?, last_action?, task_summaries?, step_summaries?, files_modified?`
  - **Verify**: `npm run compile` passes

- [x] **T002** Create specContextManager *(depends on T001)* — `src/features/specs/specContextManager.ts` | R002, R003
  - **Do**: Create module with: `readSpecContext(specDir)` — reads `.spec-context.json`, falls back to `.speckit.json` for migration; `updateSpecContext(specDir, partial)` — read-then-merge write; `updateStepProgress(specDir, stepName, workflowSteps)` — sets `currentStep`, adds `stepHistory[step].startedAt`, sets `completedAt` on previous step; `setSpecStatus(specDir, status)` — sets `status` field
  - **Verify**: `npm run compile` passes
  - **Leverage**: `src/features/workflows/workflowManager.ts` (`saveFeatureWorkflow` for read-then-merge pattern)

- [x] **T003** Update workflowManager for legacy fallback *(depends on T001)* — `src/features/workflows/workflowManager.ts` | R001, R005
  - **Do**: In `getFeatureWorkflow()`, after trying `.spec-context.json`, also try `.speckit.json` as fallback. Update JSDoc comments referencing `.speckit.json`
  - **Verify**: `npm run compile` passes

- [x] **T004** Update specInfoParser *(depends on T001)* — `src/features/workflow-editor/workflow/specInfoParser.ts` | R001
  - **Do**: Replace hardcoded `'.speckit.json'` with import of `FEATURE_CONTEXT_FILE` constant. Add legacy `.speckit.json` fallback check
  - **Verify**: `npm run compile` passes

- [x] **T005** Update specViewerProvider *(depends on T001)* — `src/features/spec-viewer/specViewerProvider.ts` | R001
  - **Do**: Update comments referencing `.speckit.json` to `.spec-context.json`. No logic changes needed — already uses `getFeatureWorkflow()` which follows the constant
  - **Verify**: `npm run compile` passes

- [x] **T006** Wire step progress into specCommands *(depends on T002)* — `src/features/specs/specCommands.ts` | R002, R003
  - **Do**: Import `updateStepProgress` and `setSpecStatus`. In `registerPhaseCommands`, after `specExplorer.setActiveSpec(specName)`, call `updateStepProgress(targetDir, cmd.name, workflowSteps)` for workflow steps. Register two new commands: `speckit.markCompleted` (calls `setSpecStatus(dir, 'completed')`) and `speckit.archive` (calls `setSpecStatus(dir, 'archived')`)
  - **Verify**: `npm run compile` passes
  - **Leverage**: Existing `setActiveSpec` call at line 135

- [x] **T007** Replace mtime grouping with status grouping *(depends on T002)* — `src/features/specs/specExplorerProvider.ts` | R004, R005, R012
  - **Do**: Remove `getSpecMaxMtime()` and `isToday()` methods. In `getChildren()`, read `.spec-context.json` for each spec via `readSpecContext()`. Partition into three groups by `status`: Active (default when no file or `status === "active"`), Completed (`"completed"`), Archived (`"archived"`). Active expanded, Completed collapsed, Archived collapsed. Use `'check'` icon for Completed group, `'archive'` icon for Archived group, keep `'pulse'` for Active
  - **Verify**: Extension loads, sidebar shows three groups correctly

- [x] **T008** Add colored icons for specs and steps *(depends on T007)* — `src/features/specs/specExplorerProvider.ts` | R006, R007, R008, R009, R011
  - **Do**: In `SpecItem` constructor: for `contextValue === 'spec'`, use `new ThemeIcon('beaker', new ThemeColor('testing.iconPassed'))` (green) when `status === 'completed'`, `new ThemeIcon('beaker', new ThemeColor('debugIcon.startForeground'))` (blue) when `currentStep` exists and active, keep `sync~spin` only for `isActive`. For `contextValue === 'spec-document'`, use green `ThemeIcon('pass')` when `stepHistory[step].completedAt` is set, blue `ThemeIcon('circle-filled', ...)` when step matches `currentStep`
  - **Verify**: Extension loads, icons show correct colors per step state

- [x] **T009** Register commands and context menus in package.json *(depends on T006)* — `package.json` | R010
  - **Do**: Add `speckit.markCompleted` command (title: "Mark as Completed", icon: `check`). Add `speckit.archive` command (title: "Archive Spec", icon: `archive`). Add context menu entries under `view/item/context` for `viewItem == spec` in group `7_modification`
  - **Verify**: Commands appear in context menu when right-clicking a spec

---

## Phase 2: Quality (Parallel — launch agents in single message)

> The name in backticks after `—` is the **agent identifier** that `/sdd:implement` uses to spawn the subagent.

- [x] **T010** [P][A] Unit tests — `test-expert` | R004, R005, R006, R007, R008, R009
  - **Files**: `src/features/specs/__tests__/specExplorerProvider.test.ts`, `src/features/specs/__tests__/specContextManager.test.ts`
  - **Pattern**: Jest with `ts-jest`, BDD `describe`/`it` blocks, VS Code mock from `tests/__mocks__/vscode.ts`
  - **Reference**: `src/features/specs/__tests__/specExplorerProvider.test.ts` (existing tests to update/replace mtime tests)

- [x] **T011** [P][A] Update docs — `docs-expert`
  - **Files**: `README.md`
  - **Do**: Update "Sidebar at a Glance" section: replace Active/Earlier description with Active/Completed/Archived groups; document color indicators (green=completed, blue=current step); document "Mark as Completed" and "Archive" context menu actions
  - **Verify**: README accurately reflects new behavior

---

## Progress

- Phase 1: T001–T009 [ ]
- Phase 2: T010–T011 [ ]
