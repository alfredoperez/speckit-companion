# Plan: Disable Rendering in Diff View

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-27

## Approach

The first attempt tried to detect diff context inside `WorkflowEditorProvider.resolveCustomTextEditor` and skip the redirect. That fight against VS Code's editor-resolution timing turned out to be unwinnable. Instead, delete the custom editor entirely. The SpecKit sidebar already opens the SpecViewer directly via `speckit.viewSpecDocument`, so removing the auto-redirect doesn't lose any reachable functionality.

## Files to Change

- `src/features/workflow-editor/workflowEditorProvider.ts` — **delete** the file. No callers remain after the extension.ts edit below.
- `src/features/workflow-editor/index.ts` — drop the `workflowEditorProvider` re-export. Keep the `workflowEditorCommands` export.
- `src/extension.ts` — remove the `WorkflowEditorProvider` import and the `if (workflowEditor.enabled)` registration block. Leave `registerWorkflowEditorCommands` call alone (those commands may still be referenced elsewhere).
- `package.json` — remove the `customEditors` block under `contributes`, the `onCustomEditor:speckit.workflowEditor` entry from `activationEvents`, and the `speckit.workflowEditor.enabled` property from `contributes.configuration`.
