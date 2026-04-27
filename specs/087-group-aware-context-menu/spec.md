# Spec: Group-aware Context Menu

**Slug**: 087-group-aware-context-menu | **Date**: 2026-04-27

## Summary

Sidebar right-click options today rely on selection-aware context keys that
race with VS Code's selection update on right-click and surface no-op or
nonsensical actions (e.g. "Mark as completed" on an already-completed spec,
"Reactivate" on an active spec). Encode the spec's lifecycle group directly
into each tree item's `viewItem` so menu visibility is a pure per-item
decision, eliminating the timing race and removing confusing actions.

## Requirements

- **R001** (MUST): A spec tree item's `contextValue` reflects its lifecycle status: `spec-active`, `spec-tasks-done`, `spec-completed`, or `spec-archived`. Items with missing/unknown status fall back to `spec-active`.
- **R002** (MUST): The "Mark as Completed" menu item is visible only on items whose `viewItem` is `spec-active` or `spec-tasks-done`.
- **R003** (MUST): The "Archive" menu item is visible on items whose `viewItem` is `spec-active`, `spec-tasks-done`, or `spec-completed` — i.e., anything except `spec-archived`.
- **R004** (MUST): The "Reactivate" menu item is visible only on items whose `viewItem` is `spec-completed` or `spec-archived`.
- **R005** (MUST): The inline "Delete" action and the `7_modification`-group "Delete" entry remain visible on every spec item regardless of lifecycle group.
- **R006** (MUST): The `speckit.specs.reveal` and `speckit.specs.revealInExplorer` entries remain visible on every spec item regardless of lifecycle group.
- **R007** (MUST): Bulk operations triggered from a multi-selection continue to receive the full selection. The right-clicked item's `viewItem` controls menu visibility; the command handler filters out items whose current status would make the operation a no-op (e.g. marking an already-completed spec as completed) before applying the change.
- **R008** (SHOULD): The deprecated `speckit.specs.selection.allActive`, `speckit.specs.selection.allCompleted`, and `speckit.specs.selection.allArchived` context keys are no longer required for menu visibility. They may be removed once no `when` clause references them.

## Scenarios

### Right-click on an active spec

**When** the user right-clicks a spec whose status is `active` (or `tasks-done`)
**Then** the menu shows: Mark as Completed, Archive, Delete, Reveal in Sidebar, Reveal in OS — but NOT Reactivate.

### Right-click on a completed spec

**When** the user right-clicks a spec whose status is `completed`
**Then** the menu shows: Reactivate, Archive, Delete, Reveal in Sidebar, Reveal in OS — but NOT Mark as Completed.

### Right-click on an archived spec

**When** the user right-clicks a spec whose status is `archived`
**Then** the menu shows: Reactivate, Delete, Reveal in Sidebar, Reveal in OS — but NOT Mark as Completed and NOT Archive.

### Right-click on previously unselected item

**When** nothing is selected (or a different group is selected) and the user right-clicks a completed spec
**Then** the menu reflects the right-clicked item's status (Reactivate visible, Mark as Completed hidden), with no dependency on prior selection state.

### Multi-select with mixed statuses

**When** the user multi-selects an active spec and a completed spec, then right-clicks on the completed spec and chooses "Reactivate"
**Then** both selected specs are passed to the handler; the handler reactivates only the completed one and skips the already-active one without raising an error.

## Non-Functional Requirements

- **NFR001** (MUST): No additional `.spec-context.json` reads beyond what the provider already performs when constructing each tree item — status is derived from the existing `specContext` already loaded per item.

## Out of Scope

- Changing the visible labels, icons, or ordering of any context-menu item.
- Adding new menu actions or new lifecycle statuses.
- Changing the spec-document or spec-related-doc child item menus.
- Changing keyboard-driven invocation paths (command palette).
