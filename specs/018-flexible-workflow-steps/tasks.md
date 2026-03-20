# Tasks: Flexible Workflow Steps

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-07

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Define `WorkflowStepConfig` type and update `WorkflowConfig` — `src/features/workflows/types.ts`
  - **Do**: Add `WorkflowStepConfig` interface with `name: string`, `label?: string`, `command: string`, `file?: string`, `subFiles?: string[]`, `subDir?: string`. Add `steps?: WorkflowStepConfig[]` to `WorkflowConfig` (keep legacy `step-*` keys for compat). Change `WorkflowStep` from a union literal to `string` so custom step names are allowed.
  - **Verify**: `npm run compile` passes; no downstream type errors yet (consumers still use old keys).

- [x] **T002** Add `normalizeWorkflowConfig()` and `getStepFile()` helpers *(depends on T001)* — `src/features/workflows/workflowManager.ts`
  - **Do**: Add `normalizeWorkflowConfig(config: WorkflowConfig): WorkflowConfig` that converts legacy `step-*` keys into a `steps` array (e.g., `step-specify: "speckit.specify"` → `{ name: "specify", label: "Specify", command: "speckit.specify", file: "spec.md" }`). Add `getStepFile(step: WorkflowStepConfig): string` that returns `step.file ?? step.name + '.md'`. Update `DEFAULT_WORKFLOW` to use the new `steps` array format with explicit `file` values (`spec.md`, `plan.md`, `tasks.md`). Update `getActiveWorkflow()` and `getWorkflows()` to call `normalizeWorkflowConfig()` on every config before returning.
  - **Verify**: `npm run compile` passes; `DEFAULT_WORKFLOW.steps` has 4 entries with correct files.

- [x] **T003** Update sidebar to render dynamic steps *(depends on T002)* — `src/features/specs/specExplorerProvider.ts`
  - **Do**: In `getSpecDocuments()`, replace the hard-coded 3-item (spec/plan/tasks) logic with a loop over `activeWorkflow.steps`. For each step, use `getStepFile(step)` to resolve the filename, check file existence for status icon. Support `subFiles` (explicit list) and `subDir` (scan directory for `.md` files) to create child tree items under the step. Keep existing `collapsibleState` and icon logic but make it dynamic.
  - **Verify**: `npm run compile` passes; default workflow still shows Spec, Plan, Tasks in sidebar; a workflow with 2 steps shows only those 2.

- [x] **T004** Update spec commands to use dynamic steps *(depends on T002)* — `src/features/specs/specCommands.ts`
  - **Do**: Replace hard-coded `WORKFLOW_STEPS` array and `getPhaseDefinitions()` with a dynamic list from the active workflow's `steps`. Update `resolveStepCommand()` to look up the step's `command` field from the workflow config instead of building a command name from the step string.
  - **Verify**: `npm run compile` passes; running a workflow step command dispatches the correct command for both default and custom workflows.

- [x] **T005** Add `WorkflowDocumentType` to spec-viewer types *(depends on T001)* — `src/features/spec-viewer/types.ts`
  - **Do**: Add `type WorkflowDocumentType = string` alongside existing `CoreDocumentType`. Update `DocumentType` to be `CoreDocumentType | WorkflowDocumentType`. Keep `CORE_DOCUMENTS`, `CORE_DOCUMENT_FILES`, and `CORE_DOCUMENT_DISPLAY_NAMES` unchanged for backward compat.
  - **Verify**: `npm run compile` passes; existing `DocumentType` usages remain valid.

- [x] **T006** Make document scanner workflow-aware *(depends on T002, T005)* — `src/features/spec-viewer/documentScanner.ts`
  - **Do**: Update `scanForDocuments()` to accept an optional `steps: WorkflowStepConfig[]` parameter. When provided, use steps' `file` properties to identify core documents instead of the hard-coded `CORE_DOCUMENT_FILES` map. When not provided (backward compat), fall back to `CORE_DOCUMENT_FILES`. Update sort order to follow step declaration order.
  - **Verify**: `npm run compile` passes; spec viewer still correctly identifies spec/plan/tasks for default workflow.

- [x] **T007** Update `getDocumentTypeFromPath()` for workflow context *(depends on T005)* — `src/features/spec-viewer/utils.ts`
  - **Do**: Add optional `steps?: WorkflowStepConfig[]` parameter to `getDocumentTypeFromPath()`. When steps are provided, match the file path against each step's resolved file to determine the document type (using the step name as the type). Fall back to existing `CORE_DOCUMENT_FILES` lookup when steps are not provided.
  - **Verify**: `npm run compile` passes.

- [x] **T008** Make phase calculation dynamic *(depends on T002)* — `src/features/spec-viewer/phaseCalculation.ts`
  - **Do**: Update `calculatePhase()` and `getPhaseNumber()` to accept the active workflow's step count. Phase N corresponds to step N's file existing. Replace the hard-coded 4-phase switch with a loop over the workflow steps. Default to 4 phases when no workflow context is provided.
  - **Verify**: `npm run compile` passes; default workflow still calculates phases 1–4 correctly.

- [x] **T009** Update specInfoParser for workflow-aware file detection *(depends on T002)* — `src/features/workflow-editor/workflow/specInfoParser.ts`
  - **Do**: Replace hard-coded `spec.md`/`plan.md`/`tasks.md` detection and `mainDocs` filter with logic that reads the active workflow's steps and uses `getStepFile()` for each. Update completion/phase detection to use step count dynamically.
  - **Verify**: `npm run compile` passes; workflow editor still shows correct spec info for default workflow.

- [x] **T010** Update `package.json` workflow schema *(no code dependencies)* — `package.json`
  - **Do**: In the `speckit.customWorkflows` schema, add a `steps` property (type: array) to the workflow item schema. Each item in `steps` has: `name` (string, required), `label` (string, optional), `command` (string, required), `file` (string, optional), `subFiles` (array of strings, optional), `subDir` (string, optional). Keep the legacy `step-*` properties for backward compat.
  - **Verify**: VS Code validates the schema without errors; old and new format configs both pass validation.

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T010 | [x] |
