# Plan: Flexible Workflow Steps

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-07

## Approach

Replace the hard-coded 4-step workflow model (`step-specify`, `step-plan`, `step-tasks`, `step-implement`) with a flexible `steps` array on `WorkflowConfig`. Each step declares its own name, label, command, output file, and optional sub-file config. The sidebar, spec viewer, document scanner, and phase calculation all become workflow-aware — reading step definitions from the active workflow instead of hard-coded constants. The built-in default workflow is migrated to the new schema while preserving identical behavior. A backward-compatibility layer in `workflowManager` transparently upgrades old-format configs (with `step-*` keys) to the new `steps` array format, so existing user settings continue to work without migration.

## Files

### Modify

| File | Change |
|------|--------|
| `src/features/workflows/types.ts` | Add `WorkflowStepConfig` interface with `name`, `label`, `command`, `file?`, `subFiles?`, `subDir?`. Change `WorkflowConfig` to use `steps: WorkflowStepConfig[]` instead of four `step-*` keys. Keep `WorkflowStep` type as a union but make it extensible (or replace with `string`). |
| `src/features/workflows/workflowManager.ts` | Update `DEFAULT_WORKFLOW` to use new `steps` array. Add `normalizeWorkflowConfig()` that converts old `step-*` format to `steps` array for backward compat. Update `getActiveWorkflow()` / `getWorkflows()` to normalize configs on read. Add `getStepFile(step)` helper to resolve a step's output file (uses `step.file` or falls back to `{stepName}.md`). |
| `src/features/specs/specExplorerProvider.ts` | Replace hard-coded `getSpecDocuments()` (which always returns spec/plan/tasks) with a dynamic method that reads the active workflow's `steps` array and builds tree items accordingly. Use `getStepFile()` to resolve which file to check for existence. Support `subFiles`/`subDir` for child items. |
| `src/features/specs/specCommands.ts` | Replace hard-coded `WORKFLOW_STEPS` array and phase definitions with dynamic step list from active workflow. Update `resolveStepCommand()` to use step's `command` field. |
| `src/features/spec-viewer/types.ts` | Keep `CORE_DOCUMENTS` and `CORE_DOCUMENT_FILES` for backward compat in the spec viewer, but add a `WorkflowDocumentType` that can represent any workflow step's document type (a string, not just the 3 core types). |
| `src/features/spec-viewer/documentScanner.ts` | Make `scanForDocuments()` workflow-aware: accept the active workflow's steps, use their `file` properties to identify core documents instead of the hard-coded `CORE_DOCUMENT_FILES` map. |
| `src/features/spec-viewer/utils.ts` | Update `getDocumentTypeFromPath()` to accept an optional workflow context so it can identify custom step files as core document types. |
| `src/features/spec-viewer/phaseCalculation.ts` | Replace hard-coded 4-phase logic with dynamic phase calculation based on the active workflow's step count. Phase N = step N's file exists. |
| `src/features/workflow-editor/workflow/specInfoParser.ts` | Replace hard-coded `spec.md`/`plan.md`/`tasks.md` detection with workflow-aware file discovery using the active workflow's steps. |
| `package.json` | Update `speckit.customWorkflows` JSON schema to support the new `steps` array format alongside the legacy `step-*` keys. Add `steps` array item schema with `name`, `label`, `command`, `file`, `subFiles`, `subDir` properties. |

## Risks

- **Backward compatibility**: Existing users have workflows with `step-specify` etc. in their settings. Mitigated by the `normalizeWorkflowConfig()` shim that auto-upgrades old format on read — no user migration needed.
- **Phase calculation**: Current phase logic is tightly coupled to 3 files. Dynamic phase count may surprise UI that expects exactly 4 phases. Mitigated by capping phase display at the workflow's actual step count.
