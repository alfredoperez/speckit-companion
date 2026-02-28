# Plan: Custom Workflow UX Improvements

**Spec**: [spec.md](./spec.md) | **Date**: 2026-02-27

## Approach

Replace all `showWarningMessage` popups in workflow validation/selection with `outputChannel.appendLine` calls so users aren't interrupted on activation. Add optional `sub-specify`, `sub-plan`, `sub-tasks` fields to `WorkflowConfig` and make the footer enhancement buttons conditional on whether the active workflow defines these sub-commands — if absent, the button is hidden entirely. Finally, add a "Workflow Commands" category to the Steering Explorer that resolves workflow step/sub-step command names to their `.claude/commands/` files and lists them as clickable tree items.

## Files

### Modify

| File | Change |
|------|--------|
| `src/features/workflows/types.ts` | Add `'sub-specify'?`, `'sub-plan'?`, `'sub-tasks'?` optional fields to `WorkflowConfig` interface |
| `src/features/workflows/workflowManager.ts` | Replace all `vscode.window.showWarningMessage` calls with output channel logging. Accept an optional `outputChannel` parameter in `validateWorkflowsOnActivation` and `getWorkflows`. In `getFeatureWorkflow` replace the popup with a silent return. Add a `resolveSubCommand` helper. |
| `src/features/workflows/workflowSelector.ts` | Replace `showWarningMessage` in `getOrSelectWorkflow` (line 160) with output channel log |
| `src/features/spec-viewer/types.ts` | Remove the hardcoded `PHASE_ENHANCEMENT_BUTTONS` constant. Add an `enhancementButton` optional field to `NavState` and `FooterState` so the generator can receive dynamic button config. |
| `src/features/spec-viewer/html/generator.ts` | Accept optional `EnhancementButton` param instead of looking up `PHASE_ENHANCEMENT_BUTTONS`. Only render the button when the param is provided. |
| `src/features/spec-viewer/specViewerProvider.ts` | Before calling `generateHtml`, resolve the active workflow's sub-command for the current phase. Pass the resolved `EnhancementButton` (or `null`) to the generator. |
| `src/features/spec-viewer/messageHandlers.ts` | In `handleClarify`, resolve the command from the active workflow's sub-command instead of the hardcoded `PHASE_ENHANCEMENT_BUTTONS` map. |
| `src/features/steering/steeringExplorerProvider.ts` | Add a "Workflow Commands" category that reads the active workflow config, collects step/sub-step command names, resolves them to file paths in `.claude/commands/`, and lists matching files as clickable tree items. |
| `src/extension.ts` | Pass `outputChannel` to `validateWorkflowsOnActivation()` call |

## Risks

- **Breaking existing `getWorkflows` callers**: Several callers don't pass `outputChannel`. Mitigation: make the param optional with a no-op fallback so existing callsites don't break.
