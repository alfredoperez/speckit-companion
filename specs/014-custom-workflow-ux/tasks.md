# Tasks: Custom Workflow UX Improvements

**Plan**: [plan.md](./plan.md) | **Date**: 2026-02-27

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add sub-command fields to WorkflowConfig — `src/features/workflows/types.ts`
  - **Do**: Add `'sub-specify'?: string`, `'sub-plan'?: string`, `'sub-tasks'?: string` optional fields to the `WorkflowConfig` interface (after line 44). These hold the per-step enhancement command names (e.g., `"sdd.clarify"`).
  - **Verify**: `npm run compile` passes with no type errors

- [x] **T002** Replace popup warnings with output channel logging *(depends on T001)* — `src/features/workflows/workflowManager.ts`
  - **Do**: (1) Add an optional `outputChannel?: vscode.OutputChannel` parameter to `validateWorkflowsOnActivation()` and `getWorkflows()`. (2) Replace every `vscode.window.showWarningMessage(...)` call in both functions with `outputChannel?.appendLine(...)` (6 callsites total: lines 118, 128, 262, 273, 280, 286, 295). (3) In `getFeatureWorkflow()` (line 164), remove the `showWarningMessage` and just return `undefined` silently. (4) Add a `resolveSubCommand(workflow: WorkflowConfig, step: WorkflowStep): string | undefined` helper that reads `sub-${step}` from the workflow config and returns it (or `undefined` if not set).
  - **Verify**: `npm run compile` passes; no `showWarningMessage` remains in `workflowManager.ts`

- [x] **T003** Replace popup in workflowSelector *(depends on T002)* — `src/features/workflows/workflowSelector.ts`
  - **Do**: In `getOrSelectWorkflow()`, add an optional `outputChannel?: vscode.OutputChannel` parameter. Replace the `showWarningMessage` at line 160 with `outputChannel?.appendLine(...)`. Pass `outputChannel` through to the `getWorkflows()` call.
  - **Verify**: `npm run compile` passes; no `showWarningMessage` remains in `workflowSelector.ts`

- [x] **T004** Pass outputChannel to activation call *(depends on T002)* — `src/extension.ts`
  - **Do**: Find the `validateWorkflowsOnActivation()` call and pass the existing `outputChannel` variable as an argument.
  - **Verify**: `npm run compile` passes

- [x] **T005** Make enhancement buttons dynamic in spec-viewer types *(depends on T001)* — `src/features/spec-viewer/types.ts`
  - **Do**: (1) Remove the `PHASE_ENHANCEMENT_BUTTONS` constant (lines 121-140). (2) Keep the `EnhancementButton` interface as-is. (3) Add `enhancementButton?: EnhancementButton | null` field to the `FooterState` interface. (4) Add `enhancementButton?: EnhancementButton | null` field to `NavState`.
  - **Verify**: `npm run compile` — expect errors in files that reference `PHASE_ENHANCEMENT_BUTTONS` (will be fixed in T006/T007)

- [x] **T006** Update HTML generator to accept dynamic enhancement button *(depends on T005)* — `src/features/spec-viewer/html/generator.ts`
  - **Do**: (1) Remove the `PHASE_ENHANCEMENT_BUTTONS` import. (2) Add an `enhancementButton: EnhancementButton | null` parameter to `generateHtml()` (after `specStatus`). (3) Remove the local `enhancementButton` lookup logic (lines 56-59) — just use the parameter directly.
  - **Verify**: `npm run compile` — expect error in `specViewerProvider.ts` (will be fixed in T007)

- [x] **T007** Wire workflow sub-commands into spec viewer provider *(depends on T002, T006)* — `src/features/spec-viewer/specViewerProvider.ts`
  - **Do**: (1) Import `getFeatureWorkflow`, `getWorkflow`, `resolveSubCommand` from `../../features/workflows/workflowManager`. (2) Import `EnhancementButton` from `./types`. (3) In `updateContent()`, before the `generateHtml()` call: resolve the active workflow for the spec directory, call `resolveSubCommand(workflow, currentDocStep)` to get the sub-command name. If a sub-command exists, build an `EnhancementButton` object with label/icon/command from the sub-command name; otherwise pass `null`. (4) Pass the resolved button to `generateHtml()` as the new param. (5) Also update the `sendContentUpdateMessage` path to include `enhancementButton` in the `NavState`.
  - **Verify**: `npm run compile` passes; opening the spec viewer with the default workflow shows no enhancement button; a workflow with `sub-specify` shows the Clarify button

- [x] **T008** Update message handler to use dynamic sub-commands *(depends on T005)* — `src/features/spec-viewer/messageHandlers.ts`
  - **Do**: (1) Remove the `PHASE_ENHANCEMENT_BUTTONS` import. (2) In `handleClarify()`, instead of looking up the hardcoded map, resolve the active workflow for the spec directory using `getFeatureWorkflow`/`getWorkflow`/`resolveSubCommand`. Execute the resolved command, or do nothing if no sub-command is configured.
  - **Verify**: `npm run compile` passes; clicking the enhancement button in the footer executes the workflow-configured command

- [x] **T009** Add Workflow Commands category to Steering Explorer *(depends on T001)* — `src/features/steering/steeringExplorerProvider.ts`
  - **Do**: (1) Import `getWorkflows`, `getWorkflow` from `../../features/workflows/workflowManager` and `WorkflowConfig` from `../../features/workflows/types`. (2) In `getChildren()` at root level, after the SpecKit Files section: read the active workflow config (use the configured `defaultWorkflow` setting or fall back to `'default'`). Collect all non-default step and sub-step command names from the workflow. For each command name, check if a matching file exists at `.claude/commands/{commandName}.md`. If any files are found, add a "Workflow Commands" expandable `SteeringItem` with `contextValue: 'workflow-commands-header'`. (3) Handle `workflow-commands-header` in the `getChildren` else-if chain: return one `SteeringItem` per resolved command file with `contextValue: 'workflow-command'`, icon `terminal`, and a click-to-open action. (4) Add icon/tooltip handling for `workflow-commands-header` and `workflow-command` in the `SteeringItem` constructor.
  - **Verify**: `npm run compile` passes; when a custom workflow references `sdd.specify`, the Steering panel shows "Workflow Commands" with `sdd.specify.md` listed and clickable

---

## Phase 2: Quality (Parallel — launch agents in single message)

- [ ] **T010** [P][A] Verify full compilation and manual smoke test — `test-expert`
  - **Files**: entire project
  - **Pattern**: `npm run compile` clean, then launch Extension Development Host (F5) and verify: (1) no popup on activation with a non-existent defaultWorkflow, (2) enhancement buttons hidden with default workflow, shown with custom sub-commands, (3) Steering tree shows Workflow Commands category
  - **Reference**: existing compile/test workflow

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T009 | [ ] |
| Phase 2 | T010 | [ ] |
