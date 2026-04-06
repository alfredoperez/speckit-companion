# Tasks: Fix SDD Auto Mode

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-05

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add getActiveWorkflowCommands helper — `src/features/workflows/workflowManager.ts` | R001, R003
  - **Do**: Add exported function `getWorkflowCommands(workflowName: string): WorkflowCommandConfig[]` that calls `getWorkflow(workflowName)` and returns `workflow.commands ?? []`
  - **Verify**: `npm run compile` passes; function is importable
  - **Leverage**: `getWorkflow()` at line 195 for pattern

- [x] **T002** Merge workflow commands into resolveEnhancementButtons — `src/features/spec-viewer/specViewerProvider.ts` | R001, R003, R004
  - **Do**: In `resolveEnhancementButtons()` (line 507), after building buttons from `customCommands`, call `getWorkflowCommands()` with the instance's workflow name, filter by `step === docType || step === 'all'`, convert each to `EnhancementButton`, and append. Deduplicate on `command` string to avoid duplicates (R004).
  - **Verify**: `npm run compile` passes; buttons from workflow commands appear in footer
  - **Leverage**: Existing `customCommands` loop at lines 514-531 for the same pattern

- [x] **T003** Extend handleClarify to match workflow commands — `src/features/spec-viewer/messageHandlers.ts` | R002
  - **Do**: In `handleClarify()` (line 286), after the `customCommands` loop fails to find a match, fall back to searching workflow commands via `getWorkflowCommands()`. Use the same execute-in-terminal logic with the matched command.
  - **Verify**: `npm run compile` passes; clicking a workflow command button executes the correct slash command
  - **Leverage**: Existing `customCommands` matching loop at lines 300-319

- [x] **T004** Add tests — `tests/` | R001–R005
  - **Do**: Add unit tests for `getWorkflowCommands()`, test that `resolveEnhancementButtons` returns merged buttons, and test that `handleClarify` resolves workflow commands. Cover edge cases: no commands array, `step: "all"`, deduplication.
  - **Verify**: `npm test` passes

---

## Progress

- Phase 1: T001–T004 [x]
