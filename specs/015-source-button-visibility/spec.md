# Spec: Always-Visible Source File Button

**Branch**: 015-source-button-visibility | **Date**: 2026-02-28

## Summary

The "Edit Source" button in the spec viewer footer is currently hidden when the spec status is "spec-completed" (the entire footer gets `display: none`). This makes it impossible to open the raw markdown file for completed specs. The button should always be visible regardless of completion status. Additionally, an "Open Source" inline action should be added to spec document items in the sidebar tree view for quick access.

## Requirements

- **R001** (MUST): The "Edit Source" button in the spec viewer footer must remain visible and functional when spec status is "spec-completed"
- **R002** (MUST): Other footer actions (Regenerate, Enhance, Approve/Generate) must still be hidden when spec is completed — only "Edit Source" stays
- **R003** (SHOULD): Each spec document item (spec, plan, tasks) in the sidebar tree view should have an inline "Open Source" action that opens the raw markdown file in the editor

## Scenarios

### Viewing a completed spec in the viewer

**When** a user opens a spec with status "spec-completed" in the spec viewer
**Then** the "Edit Source" button is visible and clickable in the footer; other action buttons (Regenerate, Enhance, primary CTA) are hidden

### Opening source from sidebar

**When** a user hovers over a spec document item (spec/plan/tasks) in the sidebar explorer tree
**Then** an inline "Open Source" icon button appears that opens the raw `.md` file in the VS Code editor

## Out of Scope

- Changing the "Edit Source" button label or behavior (it already works via `editSource` message)
- Modifying the sidebar context menu (right-click) — only adding an inline hover action
