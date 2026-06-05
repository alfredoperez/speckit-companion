# Feature Specification: Fix Footer Button Visibility

**Feature Branch**: `124-fix-footer-button-visibility`
**Created**: 2026-06-05
**Status**: Draft
**Input**: GitHub issue [#193](https://github.com/alfredoperez/speckit-companion/issues/193) — "Spec viewer footer/step buttons appear or disappear after clicking other buttons"

## Problem

In the spec viewer, the footer action buttons (and to a lesser degree the step tabs) sometimes change unexpectedly after the user clicks an action: a button that is still relevant becomes hidden, or a button the user expects for the spec's current stage never appears. From the reporter's perspective this reads as a glitch rather than intentional progressive disclosure. Buttons should be a predictable reflection of the spec's true state, not an artifact of which controls happened to be clicked in what order.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Footer actions stay consistent with the spec's true state (Priority: P1)

A user reviewing a spec in the viewer sees a footer whose available actions always match the spec's actual workflow stage. No matter what they clicked earlier in the session, an action that is still valid for the spec's current state remains visible and usable — it never silently disappears because some other control was pressed.

**Why this priority**: This is the core defect. Until the footer is a deterministic function of the spec's true state, every other behavior built on top of it inherits the same flakiness, and users lose trust that the controls mean what they show.

**Independent Test**: Open a spec at a known stage, record the visible footer buttons, click each non-destructive action that does not change the stage, and confirm the still-valid buttons remain present after every click and after the panel refreshes. Re-open the same spec and confirm the identical button set appears.

**Acceptance Scenarios**:

1. **Given** a spec paused at a stage where a forward action and a "redo this step" action are both valid, **When** the user clicks the "redo this step" action (which does not change the stage), **Then** the forward action remains visible and clickable.
2. **Given** a spec viewed twice at the same true state, **When** the footer renders each time, **Then** the set of buttons shown is identical on both viewings.
3. **Given** the user switches between step tabs without changing the workflow stage, **When** they return to the footer, **Then** the footer still reflects the spec's true workflow stage (not the tab being viewed) and shows the same actions as before the tab switch.

---

### User Story 2 - The expected next action is always reachable at a pause point (Priority: P2)

When a spec reaches a point where it is waiting on the user — specification done, plan done, tasks created, or implementation done — the viewer always presents the appropriate forward or closure action. The user is never stranded at a pause with no visible way to advance or close the spec.

**Why this priority**: A missing forward/closure button blocks the workflow entirely from the viewer; the user has to fall back to the command palette or sidebar, defeating the viewer's purpose. It is a step down from P1 only because it is a narrower slice of the same determinism guarantee.

**Independent Test**: Drive a spec to each pause stage (`specified`, `planned`, `ready-to-implement`/tasks-created, `implemented`) and confirm the documented forward or closure control is present and enabled at each, with no extra reopen required.

**Acceptance Scenarios**:

1. **Given** a spec whose specification step just completed (`specified`), **When** the footer renders, **Then** the forward action labeled for the next step is present and clickable.
2. **Given** a spec whose tasks are complete (`ready-to-implement`), **When** the footer renders, **Then** the forward action to begin implementation is present and clickable.
3. **Given** a spec at the final approval gate (`implemented`), **When** the footer renders, **Then** the closure controls (mark-completed / archive) are present and the forward action is no longer shown.
4. **Given** a spec that is terminal (`completed` or `archived`), **When** the footer renders, **Then** the reactivate control is present and no forward action is shown.

---

### User Story 3 - Step tabs reflect true per-step state through actions (Priority: P3)

The step tabs (Specification, Plan, Tasks) show enabled/disabled, completed-checkmark, and active-step indicators that match the spec's true per-step state. Performing footer actions does not leave a tab's indicator out of sync with the spec.

**Why this priority**: Tabs are secondary to the footer for advancing the workflow, but a desynced tab (e.g., a checkmark on a step whose document doesn't exist, or a disabled tab whose document does) erodes the same trust the P1 fix is meant to restore.

**Independent Test**: At each workflow stage, compare every step tab's enabled/checkmark/active state against the spec's true per-step completion and document presence; then perform footer actions and re-check that the tabs stay in sync.

**Acceptance Scenarios**:

1. **Given** a spec where the plan document exists and the tasks document does not, **When** the tabs render, **Then** the Plan tab is enabled with its completion indicator and the Tasks tab reflects "not yet created" per the documented tab states.
2. **Given** a footer action that advances the workflow, **When** it completes, **Then** the affected step tab's indicator updates to match the new true state without requiring a reopen.

---

### Edge Cases

- **Generation in flight then ends**: While a step is generating, the footer shows the non-interactive "Generating…" status plus the manual "mark step complete" override. When generation ends (artifact detected) or the recovery timeout elapses, the footer MUST revert to the normal action buttons — it MUST NOT leave the action buttons hidden.
- **Generation that never produces an artifact**: After the recovery timeout, the footer reverts to enabled action buttons so the user is never stranded.
- **Viewing an earlier completed step (reviewing)**: Clicking an earlier step tab does not change the workflow stage; the footer continues to reflect the spec's true workflow stage, not the viewed tab.
- **External state change**: When the spec's persisted state changes on disk (another tool, a hook, or a sidebar action), the footer and tabs update to match within a short, bounded time without the user reopening the panel.
- **Missing or malformed spec state**: When the spec's persisted state is absent or unreadable, the viewer degrades gracefully (per existing fallback behavior) and still avoids showing a contradictory set of buttons.
- **Rapid successive clicks**: Clicking an action and then quickly clicking another does not leave the footer in a state that disagrees with the spec's true state once the dust settles.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The set of footer action buttons MUST be a deterministic function of the spec's true persisted workflow state (status, current step, and per-step completion). The same true state MUST always produce the same button set.
- **FR-002**: Clicking any footer or step-tab control MUST NOT hide or remove a different action that remains valid for the resulting state.
- **FR-003**: When an action legitimately changes the spec's state, the footer MUST update to reflect the new true state — including swapping the forward action's label to the next step and surfacing closure controls once the spec reaches the closure-eligible gate.
- **FR-004**: At every workflow pause point (`specified`, `planned`, `ready-to-implement`/tasks-created, `implemented`, `completed`, `archived`), the footer MUST present the documented forward or closure control for that stage, present and enabled.
- **FR-005**: While a step is generating, the footer MUST show the non-interactive generating status plus the manual override; once the step completes or the recovery timeout elapses, the footer MUST return to its normal action buttons and MUST NOT leave action buttons hidden.
- **FR-006**: Step tabs MUST reflect the spec's true per-step state (enabled/disabled, completion indicator, active/working, reviewing); footer actions MUST NOT leave a tab indicator out of sync with the spec's true state.
- **FR-007**: When the spec's persisted state changes outside the footer's own actions (on-disk update by another tool, hook, or sidebar action), the footer and step tabs MUST refresh to match within a short, bounded time, without the user reopening the viewer.
- **FR-008**: The viewer MUST NOT display a button set derived from an outdated or conflicting snapshot of the spec's state; when internal state sources could disagree, the displayed controls MUST reflect the spec's true current state.
- **FR-009**: The behavior in FR-001 through FR-008 MUST be consistent however the viewer renders the footer internally, so the user sees the same correct controls regardless of which rendering mode is in effect for a given spec.

### Key Entities

- **Spec workflow state**: The spec's true, persisted stage — its status, current step, and per-step start/completion markers. This is the single basis from which every footer button and step-tab indicator is derived.
- **Footer action**: A control in the viewer footer with a precondition (the workflow states in which it is valid) and a scope (whole spec vs. this step). Visibility is governed solely by whether its precondition holds for the current spec workflow state.
- **Step tab**: A per-step entry (Specification, Plan, Tasks) whose enabled/completion/active/reviewing indicators are derived from the spec's true per-step state and on-disk document presence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every state in the documented footer button matrix, viewing the spec repeatedly yields the identical footer button set every time (0 variance across repeated viewings).
- **SC-002**: Across the issue's reproduction flow — clicking through footer/step actions at each stage — no still-valid action disappears (0 occurrences).
- **SC-003**: At each of the pause stages, the documented forward or closure control is present and clickable 100% of the time, with no reopen required.
- **SC-004**: After an external change to the spec's persisted state, the footer and step tabs reflect the new state within 2 seconds without the user reopening the viewer.
- **SC-005**: The symptoms reported in issue #193 (buttons disappearing or failing to appear after clicks) do not recur when the documented reproduction steps are followed.

## Assumptions

- The intended footer button matrix and step-tab states are those already defined in `docs/viewer-states.md`. This fix makes the live viewer match that documented behavior deterministically; it does **not** change the documented matrix.
- Progressive disclosure is retained: actions that are genuinely not valid for the current stage may still be hidden. The defect being fixed is incorrect/stale disclosure (a *still-valid* action vanishing, or an *expected* action not appearing) — not the disclosure pattern itself. (Considered and rejected for this scope: replacing hiding with always-visible-but-disabled buttons; that is a larger UX change and out of scope here.)
- "Still-valid action" means an action whose documented precondition holds for the spec's current true workflow state.
- Scope is the spec viewer footer action buttons and step tabs. Sidebar per-row actions are out of scope except insofar as a sidebar action changes the spec's persisted state, which the footer/tabs must then reflect (FR-007).
- The generating-state footer, its manual override, and the 10-minute recovery timeout already documented in `docs/viewer-states.md` remain as designed; this fix only ensures the footer returns cleanly to its normal buttons afterward.
- Clicking a step tab does not change the spec's workflow stage (per the existing "viewed step" behavior); the footer always reflects the true workflow stage rather than the viewed tab.
