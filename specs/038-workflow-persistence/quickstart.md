# Quickstart: Workflow Persistence

## What This Feature Does

Ensures that the workflow a user selects when creating a spec is remembered and used throughout the spec's lifecycle. If no workflow is selected, the configured default is applied automatically.

## Key Files to Modify

1. **`src/features/spec-editor/specEditorProvider.ts`** — Add filesystem watcher in `handleSubmit()` to persist workflow when new spec directory is created
2. **`src/features/workflows/workflowManager.ts`** — No changes (verify `saveFeatureWorkflow()` works correctly)
3. **`src/features/workflows/workflowSelector.ts`** — No changes (verify `getOrSelectWorkflow()` fallback chain)
4. **`src/features/spec-viewer/specViewerProvider.ts`** — No changes (already reads persisted workflow)

## Implementation Steps

1. In `handleSubmit()`, after `executeInTerminal()`, create a `FileSystemWatcher` for `**/specs/*/spec.md`
2. On watcher `onDidCreate`, call `saveFeatureWorkflow(parentDir, workflowName)`
3. Dispose watcher after first match or 5-minute timeout
4. Add tests verifying workflow is persisted on spec creation

## How to Verify

1. Configure a custom workflow in VS Code settings
2. Open spec editor, select the custom workflow, submit
3. Wait for AI to create the spec
4. Open the spec in the viewer — verify custom workflow steps appear
5. Click a step tab — verify the custom workflow's command is used
