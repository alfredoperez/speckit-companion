# Spec: Lock Steps While Running

**Slug**: 067-lock-steps-while-running | **Date**: 2026-04-13

## Summary

While a workflow step is actively running (e.g. the planning agent is executing), the viewer currently lets the user click ahead into future step tabs (like "tasks") and press footer actions like "Regenerate". This spec locks those controls while a step is in-flight and adds tooltips to the step tabs and footer buttons so their purpose is discoverable.

## Requirements

- **R001** (MUST): While a step is running (viewerState reports `activeStep === phase` and that step has no `completedAt`), step tabs for phases that come AFTER the running step and whose document does not yet exist MUST be non-clickable and visually disabled.
- **R002** (MUST): While a step is running, the footer "Regenerate" button MUST be disabled (non-clickable, visually dimmed).
- **R003** (MUST): While a step is running, the footer primary action ("Approve" / "Complete" / "Reactivate") MUST be disabled.
- **R004** (MUST): Every footer action button (Edit Source, Archive, Regenerate, Approve/Complete/Reactivate, enhancement buttons) MUST have a `title` tooltip describing what it does.
- **R005** (MUST): Every step tab MUST have a `title` tooltip describing the step (e.g. "Specify — define requirements", "Plan — design approach", "Tasks — break into work items", "Implement — execute and ship"), including the running/disabled reason when applicable.
- **R006** (SHOULD): The currently-viewing step tab MUST remain clickable (to re-focus its document) even while it is the running step.
- **R007** (SHOULD): Disabled buttons during a running step SHOULD expose a tooltip explaining the reason (e.g. "Disabled while {step} is running").

## Scenarios

### Planning is running

**When** viewerState reports `activeStep: "plan"` with no `completedAt` and the user views the plan document
**Then** the "tasks" step tab is not clickable, the "Regenerate" footer button is disabled, and the primary approve/complete button is disabled. Hovering any of them shows a tooltip explaining why.

### Step completes

**When** the running step finishes (stepHistory[phase].completedAt is set)
**Then** all previously-locked tabs and footer buttons return to their normal enabled/disabled state based on existing logic.

### Hover discoverability

**When** the user hovers any step tab or footer action button
**Then** a native tooltip appears describing the control's purpose.

### Re-click current running step

**When** the running step is also the currently-viewed step
**Then** the user can still click its tab (it's the current view) — only FUTURE steps are locked.

## Non-Functional Requirements

- **NFR001** (MUST): Lock state must derive from existing viewerState / stepHistory signals — no new polling.
- **NFR002** (SHOULD): Tooltips must be plain `title` attributes (no custom tooltip infra) to keep the change minimal.

## Out of Scope

- Redesigning the footer action set or tab visuals beyond disabled styling.
- Blocking keyboard shortcuts or command-palette commands (only the viewer UI controls are in scope).
- Changing backend/agent behavior — this is viewer-UI only.
