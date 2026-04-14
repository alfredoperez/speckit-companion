# Spec: Multi Select Specs

**Slug**: 065-multi-select-specs | **Date**: 2026-04-13

## Summary

Enable multi-selection in the Specs sidebar tree so users can change the status of several specs at once (mark complete, archive, reactivate). Context-menu labels must adapt to the current selection — e.g., when all selected specs are already under "Complete", the menu should not offer "Mark as Complete".

## Requirements

- **R001** (MUST): The Specs sidebar tree view supports multi-select (Ctrl/Cmd+click, Shift+click) by enabling `canSelectMany` on the tree view.
- **R002** (MUST): Bulk status commands (mark complete, archive, reactivate/move to active) operate on every selected spec, not just the right-clicked item.
- **R003** (MUST): Context-menu actions hide or relabel based on the selection's current statuses — e.g., "Mark as Complete" is not shown when all selected specs are already in the Complete group.
- **R004** (MUST): When the selection mixes statuses, only actions valid for every selected spec are offered (intersection semantics).
- **R005** (SHOULD): A single completion toast summarizes the bulk result (e.g., "3 specs marked as completed") instead of one toast per spec.
- **R006** (SHOULD): The tree view refreshes once after the bulk operation finishes, not once per item.

## Scenarios

### Multi-select and bulk mark complete

**When** the user Ctrl/Cmd-clicks three specs under the Active group and picks "Mark as Complete"
**Then** all three move to the Complete group, a single summary toast is shown, and the tree refreshes once.

### Selection already under Complete

**When** the user selects two specs that are already under the Complete group and right-clicks
**Then** the menu does not offer "Mark as Complete"; it offers "Archive" and "Move to Active" instead.

### Mixed-status selection

**When** the user selects one Active and one Completed spec
**Then** only actions valid for both (e.g., Archive) are shown; status-specific actions like "Mark as Complete" are hidden.

### Single-select fallback

**When** the user right-clicks a single spec without multi-selecting
**Then** behavior is unchanged from today — the action applies to that one spec.

## Out of Scope

- Bulk rename, bulk delete, or bulk workflow changes.
- Keyboard shortcut bindings for bulk actions.
- Drag-and-drop between status groups.
