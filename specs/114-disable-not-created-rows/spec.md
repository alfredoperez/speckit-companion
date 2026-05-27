# Spec: Disable Not Created Rows

**Slug**: 114-disable-not-created-rows | **Date**: 2026-05-27

## Summary

In the SPECS sidebar, step rows whose underlying document does not exist yet (labelled "not created") are currently clickable and open the spec viewer in an empty state. Make these rows non-activatable so clicking does nothing, while keeping the row visible, informative, and available for right-click actions that could help create the step.

## Requirements

- **R001** (MUST): Sidebar step rows whose document status is `empty` ("not created") MUST NOT dispatch the open-step command on activation (click / Enter).
- **R002** (MUST): The row MUST remain visible with its existing label and "not created" description — this is a disabled / informational state, not a hidden one.
- **R003** (MUST): Right-click / context-menu actions on the row MUST remain available (the row's `contextValue` is unchanged), so any "create this step" affordances continue to work.
- **R004** (MUST): Behavior MUST apply to every lifecycle step that can be in the `not created` state (Plan, Tasks, and any other step file surfaced by the workflow), not just one step type.

## Scenarios

### Clicking a not-created step row

**When** the user clicks the "Plan not created" or "Tasks not created" row under a spec in the SPECS sidebar
**Then** nothing happens — no spec viewer opens, no editor is focused, no command runs

### Clicking a created step row

**When** the user clicks a step row whose document exists (status is `partial` or `complete`)
**Then** the spec viewer opens for that step (existing behavior is preserved)

### Right-clicking a not-created step row

**When** the user right-clicks a "not created" step row
**Then** the context menu still appears with any actions registered against the row's `contextValue`

## Out of Scope

- Introducing a "create this step now" CTA on the row itself.
- Changing how a step transitions out of the `not created` state.
- Sidebar styling unrelated to this state (icons for other statuses, tree-row spacing, etc.).
- Custom pointer-cursor or hover affordances — VS Code's TreeView controls the cursor; removing the command is the available lever.
