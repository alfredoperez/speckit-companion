# Plan: Always-Visible Source File Button

**Spec**: specs/015-source-button-visibility/spec.md | **Date**: 2026-02-28

## Approach

Instead of hiding the entire footer with `display: none` on completed specs, hide individual buttons except "Edit Source". For the sidebar, register a new command and add an inline action on spec document tree items.

## Files to Change

- `webview/styles/spec-viewer/_footer.css` — Replace blanket footer hide with per-button hiding; keep "Edit Source" visible
- `src/features/specs/specExplorerProvider.ts` — Add `resourceUri` on spec-document items so the inline action can resolve the file path
- `package.json` — Register `speckit.openSpecSource` command and add inline action for `view/item/context` on spec-document items

## Phase 1 Tasks

| ID | Do | Verify |
|----|-----|--------|
| T001 | In `_footer.css`, replace `body[data-spec-status="spec-completed"] .actions { display: none; }` with rules that hide `.actions-left`, `#regenerate`, and `#approve` individually, keeping `#editSource` visible | Open a completed spec in the viewer — "Edit Source" button visible, other buttons hidden |
| T002 | In `package.json`, register `speckit.openSpecSource` command with `$(go-to-file)` icon; add `view/item/context` inline entry for `viewItem =~ /spec-document-/` | Command appears in VS Code command palette |
| T003 | In `specExplorerProvider.ts`, set `resourceUri` on spec-document `SpecItem` instances using the file path; register `speckit.openSpecSource` handler in extension activation that opens the file via `vscode.window.showTextDocument` | Hover over spec/plan/tasks in sidebar — inline icon appears; clicking opens the `.md` file |
