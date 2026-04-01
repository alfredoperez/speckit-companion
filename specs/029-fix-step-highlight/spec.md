# Spec: Fix Step Highlight for Completed Steps

**Slug**: 029-fix-step-highlight | **Date**: 2026-04-01

## Summary

When viewing a step (e.g., Plan or Tasks) that is completed and is also the current workflow phase, the step tab shows a prominent purple "viewing" highlight border instead of reflecting its completed state. Completed steps being viewed should use a green-tinted "viewing" style rather than the purple accent, so users can immediately see the step is done.

## Requirements

- **R001** (MUST): A completed step that is being viewed must show a green-tinted highlight (using `--success` color) instead of the purple accent highlight
- **R002** (MUST): A non-completed step that is being viewed must continue to show the purple accent highlight (no change to current behavior)
- **R003** (MUST): The green checkmark icon inside the step-status indicator must remain visible when a completed step is being viewed

## Scenarios

### Viewing a completed workflow step

**When** the user clicks on a step that is both the current workflow phase and completed (has green checkmark)
**Then** the step tab shows a green-tinted highlight border (not purple) with the checkmark still visible

### Viewing an incomplete step

**When** the user clicks on a step that is not yet completed
**Then** the step tab shows the purple accent highlight border (existing behavior unchanged)

### Reviewing a completed step that is not the current workflow phase

**When** the user views a completed step that is not the current workflow phase
**Then** the existing "reviewing" style (amber/review color) is shown (existing behavior unchanged)

## Out of Scope

- Changes to the tasks-active or in-progress styling
- Changes to the completion badge behavior
