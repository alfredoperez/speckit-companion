# Tasks: Fix File Explorer Spec Rendering

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-26

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Convert WorkflowEditorProvider to redirect shim — `src/features/workflow-editor/workflowEditorProvider.ts`
  - **Do**: Replace the body of `resolveCustomTextEditor` with: (1) set `webviewPanel.webview.html` to minimal empty HTML, (2) execute `speckit.viewSpecDocument` command passing `document.fileName`, (3) call `webviewPanel.dispose()` to close the custom editor tab. Remove unused imports (`parseSpecInfo`, `generateWebviewHtml`, `WorkflowActionHandlers`, etc.) and the `getErrorHtml` method.
  - **Verify**: `npm run compile` passes. Opening a spec `.md` from file explorer triggers the SpecViewerProvider panel instead of the old workflow editor.

- [x] **T002** Change custom editor priority to option — `package.json`
  - **Do**: In `contributes.customEditors[0]`, change `"priority": "default"` to `"priority": "option"`. This allows right-click → "Open With" → default text editor while still intercepting normal clicks.
  - **Verify**: `npm run compile` passes. Right-clicking a spec file in explorer shows "Open With" options including the default text editor.

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T002 | [x] |
