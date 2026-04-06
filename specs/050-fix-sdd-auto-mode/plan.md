# Plan: Fix SDD Auto Mode

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-05

## Approach

Wire workflow commands (`customWorkflows[].commands`) into the existing enhancement button pipeline so they render alongside `customCommands` buttons in the spec-viewer footer. The fix extends `resolveEnhancementButtons()` to also read the active workflow's `commands` array, convert each `WorkflowCommandConfig` to an `EnhancementButton`, and merge both sources. The same approach applies to `handleClarify()` so clicking a workflow command button executes the correct slash command.

## Technical Context

**Stack**: TypeScript 5.3+, VS Code Extension API
**Key Dependencies**: WorkflowManager (already loads and validates `customWorkflows`)
**Constraints**: Must not break existing `customCommands` behavior; workflow commands use the same `EnhancementButton` rendering path

## Files

### Create

_(none)_

### Modify

- `src/features/spec-viewer/specViewerProvider.ts` — extend `resolveEnhancementButtons()` to also read active workflow's `commands[]`, filter by step/all, and merge with customCommands buttons
- `src/features/spec-viewer/messageHandlers.ts` — extend `handleClarify()` to also search workflow commands when matching the clicked button's command string
- `src/features/workflows/workflowManager.ts` — add a public method `getActiveWorkflowCommands()` that returns the current workflow's `commands[]` array (or empty array)

## Testing Strategy

- **Unit**: Test `resolveEnhancementButtons()` returns buttons from both customCommands and workflow commands; test step filtering for workflow commands
- **Unit**: Test `handleClarify()` resolves workflow command buttons correctly
- **Edge cases**: Workflow with no commands array; both sources defining buttons for same step; `step: "all"` appears on every tab

## Risks

- **Duplicate buttons**: If a user configures the same command in both `customCommands` and `customWorkflows[].commands`, it could appear twice — mitigate by deduplicating on `command` string during merge
