# Tasks: Disable Rendering in Diff View

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-27

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** ~~Skip redirect for diff/non-file contexts~~ — superseded by T002. The detection-based fix did not catch all diff entry points; replaced with full removal.

- [x] **T002** Delete the custom editor and its package.json contributions — `src/features/workflow-editor/workflowEditorProvider.ts`, `src/features/workflow-editor/index.ts`, `src/extension.ts`, `package.json` | R001, R002, R003, R004, R005
  - **Do**: Delete `workflowEditorProvider.ts`. Drop the `workflowEditorProvider` re-export from `workflow-editor/index.ts`. In `extension.ts`, remove the `WorkflowEditorProvider` import and the registration block guarded by `speckit.workflowEditor.enabled`. In `package.json`, remove the `contributes.customEditors` block, the `onCustomEditor:speckit.workflowEditor` activation event, and the `speckit.workflowEditor.enabled` configuration property.
  - **Verify**: `npm run compile` passes. Manual: (1) Source Control click on a modified spec.md opens text diff editor — no SpecViewer popup. (2) File Explorer click on spec.md opens raw markdown. (3) SpecKit sidebar click on a spec still opens the SpecViewer.
  - **Leverage**: The `speckit.viewSpecDocument` command path used by `specExplorerProvider.ts:420,556` is the only entry point we need for the SpecViewer.
