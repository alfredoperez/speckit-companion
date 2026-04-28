# Plan: Disable Rendering in Diff View

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-27

## Approach

In `WorkflowEditorProvider.resolveCustomTextEditor`, gate the existing redirect (`speckit.viewSpecDocument` + `webviewPanel.dispose`) on a "is this a normal file open?" check. Skip the redirect when the document URI scheme is not `file` or when the active tab is a `TabInputTextDiff`. When skipping, render the raw document text in the webview as a plain `<pre>` block so the panel is never blank.

## Files to Change

- `src/features/workflow-editor/workflowEditorProvider.ts` — add diff/non-file detection at the top of `resolveCustomTextEditor`. If detected, set the webview HTML to escape-rendered raw text and return early without dispatching `speckit.viewSpecDocument` or disposing the panel.
