# Tasks: Disable Rendering in Diff View

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-27

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** Skip redirect for diff/non-file contexts — `src/features/workflow-editor/workflowEditorProvider.ts` | R001, R002, R004
  - **Do**: At the top of `resolveCustomTextEditor`, compute `isDiffContext = document.uri.scheme !== 'file' || vscode.window.tabGroups.activeTabGroup?.activeTab?.input instanceof vscode.TabInputTextDiff`. If `isDiffContext`, log to `outputChannel` (e.g. `[WorkflowEditor] Diff context detected, skipping redirect: <fileName>`), set `webviewPanel.webview.html` to a minimal HTML page that wraps `document.getText()` inside a `<pre>` (HTML-escape `&`, `<`, `>` to avoid injection), and `return` without calling `speckit.viewSpecDocument` or scheduling `webviewPanel.dispose()`. Otherwise keep the existing redirect path unchanged.
  - **Verify**: `npm run compile` succeeds. Manual smoke test in Extension Development Host: (1) clicking a spec.md from the explorer still opens the SpecViewer panel, (2) opening Source Control diff for a modified spec.md shows the text diff editor without the SpecViewer popping up, (3) the workflow editor tab does not appear blank if it ever lands on a diff side.
  - **Leverage**: existing `outputChannel.appendLine` pattern in the same file (line 42); HTML escape pattern can be a small inline helper since no shared util exists for this case.
