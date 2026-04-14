# Spec: Fix Viewer Step State

**Slug**: 066-fix-viewer-step-state | **Date**: 2026-04-13

## Summary

When a user clicks a step tab in the spec viewer (e.g. Plan), the viewer swaps its content but keeps the spec-level header status badge and step-tab highlights derived from the workflow's *current* step — so viewing a completed Plan shows "CREATING TASKS..." and step tabs look inconsistent with the sidebar. This change makes the header status, step-tab highlights, and sidebar checkmarks reflect the *viewed* step's own state.

## Requirements

- **R001** (MUST): When the user clicks a step tab, the header status badge text reflects the state of the *viewed* step, not the spec's `currentStep`. E.g., viewing a completed Plan shows "PLAN COMPLETE"; viewing the in-progress Tasks shows "CREATING TASKS...".
- **R002** (MUST): Step-tab highlights (`completed` / green check) are driven by each step's actual completion state (from `stepHistory[step].completedAt` or file existence fallback), not by viewer highlights that bleed from the active workflow step.
- **R003** (MUST): A step tab whose corresponding document does not exist MUST NOT render a green check, even if `viewerState.highlights` contains that step name.
- **R004** (MUST): The sidebar step rows mark a step with a checkmark if and only if that step's document exists AND (its `completedAt` is set OR the workflow has advanced past it).
- **R005** (SHOULD): Footer action buttons (Mark Completed / Regenerate / Archive) reflect the viewed step's state, so reviewing an earlier completed step shows review-appropriate actions rather than those for the current workflow step.
- **R006** (MAY): A subtle indicator ("reviewing") distinguishes "viewing a non-current step" from "viewing the current step" so the user knows context has shifted.

## Scenarios

### Viewing a completed earlier step

**When** the spec's `currentStep` is `tasks` with `progress: in-progress`, and the user clicks the Plan tab
**Then** the header badge reads "PLAN COMPLETE", the Plan tab is marked `reviewing`/`viewing`, the Tasks tab retains its `working` state, and the footer shows review-style actions for Plan (not "Mark Completed" for Tasks).

### Viewing an uncreated later step

**When** `tasks.md` does not exist and the user clicks the Tasks tab
**Then** the Tasks tab does NOT render a green check, the header badge reflects the Tasks step's not-started state, and the sidebar Tasks row shows "not created" (no checkmark).

### Viewing the current in-progress step

**When** the user views the currently active step (e.g., Tasks with `progress: in-progress`)
**Then** the header badge, step-tab `working` state, and sidebar indicator all continue to show "CREATING TASKS..." / the active step marker, unchanged from today's behavior.

### Sidebar checkmark consistency with tab highlights

**When** the spec has `specify` completed, `plan` completed, `tasks` in-progress
**Then** sidebar and step tabs both show ✓ on Specification and Plan, an active/working indicator on Tasks, and nothing marked beyond Tasks.

## Non-Functional Requirements

- **NFR001** (MUST): No additional file I/O per tab click — state must be derivable from data already loaded for the viewer panel.
- **NFR002** (SHOULD): Badge text computation stays pure (no side-effects) so it is unit-testable via `computeBadgeText` or a sibling function.

## Out of Scope

- Changes to `.spec-context.json` schema or writer logic.
- Any modification to `.claude/**` or `.specify/**` (extension ships in isolation).
- Changes to how tab clicks load document content (content-swapping itself is already correct).
- Redesigning the step-tab visual language beyond correcting the checkmark/highlight bug.
