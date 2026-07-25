# Contract: effective default-workflow resolver

## `pickEffectiveDefaultWorkflow(inspected, companionInstalled)`

Pure. No vscode/fs access — the unit-tested core.

- **inspected**: `{ globalValue?: unknown; workspaceValue?: unknown; workspaceFolderValue?: unknown } | undefined` — the shape returned by `WorkspaceConfiguration.inspect('defaultWorkflow')`.
- **companionInstalled**: `boolean` — result of `isCompanionInstalled(root)`.
- **returns**: `string` — the effective default workflow name.

Rules:
1. `explicit = workspaceFolderValue ?? workspaceValue ?? globalValue`. If `explicit` is a non-empty string, return it verbatim.
2. Else return `companion` when `companionInstalled` is true.
3. Else return `speckit`.

## `resolveEffectiveDefaultWorkflow(root?)`

Thin vscode wrapper.

- **root**: `string | undefined` — workspace root.
- **returns**: `string` — `pickEffectiveDefaultWorkflow(config.inspect('defaultWorkflow'), !!root && isCompanionInstalled(root))`.

## Consumers

- `specEditorProvider.handleReady` — pre-select value sent to the Create-Spec webview.
- `workflowSelector.resolveDefaultWorkflow` — per-feature resolution when no per-feature workflow is already chosen.

## Non-consumers (keep raw configured value)

- `core/telemetry.ts` `buildBetaSnapshot` — reports the raw configured value.
- `workflowManager.ts` `defaultWorkflow` validation read — validates the configured value.
