# Feature Specification: Footer "Generating…" as status, "Mark step complete" as secondary

**Feature Branch**: `115-footer-generating-status`
**Created**: 2026-05-27
**Status**: Draft
**Input**: User description: "While a step is in flight, the spec viewer footer renders two button-shaped elements side by side — a disabled 'Generating <Step>…' pill and a primary-looking 'Mark step complete' button. Demote 'Mark step complete' to a secondary affordance on the left, and render 'Generating…' as a status indicator (not a button) so the row honestly communicates 'one thing is happening, one thing is a fallback override.'"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - In-flight footer reads as one live action, not two competing buttons (Priority: P1)

While a step (specify / plan / tasks / implement) is generating, the spec viewer footer shows a clear visual hierarchy: the live "Generating <Step>…" affordance is rendered as a non-clickable status chip, and the "Mark step complete" manual override sits on the **left** styled as a quiet secondary action. The user immediately understands that work is in progress and that "Mark step complete" is a fallback override rather than the recommended action.

**Why this priority**: This is the entire feature — the visual hierarchy fix. Without it, the footer continues to mis-cue users into clicking the manual override instead of waiting for the live process to finish. There is no smaller MVP slice; the whole footer restructure for the in-flight state ships together.

**Independent Test**: Trigger any step that produces a "Generating…" footer (e.g., dispatch `/speckit.plan` from the viewer and watch the in-flight state). Confirm: (a) "Generating <Step>…" is no longer a button shape and does not invite a click; (b) "Mark step complete" appears on the left side of the footer with a visibly lighter / secondary style; (c) "Mark step complete" remains usable the entire time generation is happening; (d) once generation finishes, the footer flips back to the normal post-completion next-step CTA on the right with no leftover in-flight chrome.

**Acceptance Scenarios**:

1. **Given** a spec is mid-generation for any pipeline step (specify, plan, tasks, implement), **When** the user opens the spec viewer, **Then** the footer renders "Generating <Step>…" as a non-button status indicator (chip / pill / inline label with spinner) that does not look or behave like a clickable button.
2. **Given** a spec is mid-generation, **When** the user views the footer, **Then** "Mark step complete" appears on the **left** side of the footer in a secondary / tertiary visual weight, clearly subordinate to the live status indicator.
3. **Given** a spec is mid-generation, **When** the user clicks "Mark step complete", **Then** the manual-override behavior still fires exactly as it does today (no behavioral regression — the change is purely visual hierarchy).
4. **Given** a step finishes generating, **When** the footer rerenders, **Then** the in-flight status chip and the secondary "Mark step complete" both disappear and the footer reverts to its normal post-completion next-step CTA on the right.

---

### Edge Cases

- **Rapid step transitions**: A step completes and the next step immediately starts generating. The footer should never display two in-flight status chips simultaneously, and the "Mark step complete" override should reset its association to the newly-active step.
- **Implement step running long**: For implement runs that take many minutes, the secondary "Mark step complete" must remain reachable and clickable the whole time — no auto-hide, no disabled state.
- **Approve / inline-comment footers**: When the footer is in Approve or inline-comment mode (not the generating mode), the new in-flight styling does not apply. Those modes are explicitly out of scope.
- **Status-detection failure**: If the underlying state never reports "completed" (the original bug that justifies "Mark step complete" existing), the secondary override remains the user's escape hatch — the chip stays "Generating…" indefinitely until the user clicks the override.
- **Narrow viewer widths**: When the viewer panel is dragged narrow, the left-aligned secondary action and the right-aligned status chip must not collide or overlap; one wraps or compresses gracefully.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: While any pipeline step (specify, plan, tasks, implement) is in the in-progress lifecycle status, the spec viewer footer MUST render the "Generating <Step>…" affordance as a non-button status element (e.g., chip, pill, or inline label with spinner) that does not visually invite a click and does not respond to clicks.
- **FR-002**: While any pipeline step is in the in-progress lifecycle status, the spec viewer footer MUST render the "Mark step complete" action on the **left** side of the footer, visually styled as a secondary / tertiary affordance with lighter weight than a primary button.
- **FR-003**: The "Mark step complete" action MUST remain enabled and clickable for the entire duration the step is in the in-progress lifecycle status (no auto-disable, no auto-hide while generating).
- **FR-004**: When a step transitions out of the in-progress lifecycle status (to its completed form), the footer MUST remove both the in-flight status indicator and the secondary "Mark step complete" affordance, and revert to the post-completion next-step CTA on the right as it does today.
- **FR-005**: Clicking "Mark step complete" while in the in-flight state MUST trigger the same manual-override behavior it triggers today (functional parity — this change is visual only).
- **FR-006**: The new in-flight footer styling MUST apply uniformly to every step that can surface this combination — specify, plan, tasks, and implement — without per-step variation.
- **FR-007**: The change MUST NOT alter the Approve flow footer, the inline-comment composer footer, or any other footer mode that is not the in-flight "Generating…" state.

### Key Entities

- **Footer state — In-flight**: The spec viewer footer mode displayed while the current pipeline step is in an in-progress lifecycle status (specifying, planning, tasking, implementing). After this change, it contains: a non-button status indicator on the right ("Generating <Step>…") and a secondary action on the left ("Mark step complete").
- **Footer state — Post-completion**: The spec viewer footer mode displayed after the current step reaches its completed lifecycle form. Unchanged by this feature; continues to show the normal next-step CTA on the right.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every screenshot of an in-flight spec viewer footer, a non-technical reviewer can identify within 5 seconds which element is the live action and which is the manual override, with 100% accuracy across the four pipeline steps (specify, plan, tasks, implement).
- **SC-002**: Zero clicks land on the "Generating <Step>…" element during in-flight states (the element does not respond to clicks and does not look clickable), measured by absence of click events on that element in manual testing across the four pipeline steps.
- **SC-003**: "Mark step complete" remains successfully clickable across the full duration of an in-flight step in 100% of manual test runs, including long-running implement steps.
- **SC-004**: When a step transitions from in-progress to completed, the footer reverts to the post-completion next-step CTA within the same viewer render cycle in 100% of manual test runs — no leftover in-flight chrome.

## Assumptions

- "Mark step complete" remains a needed manual override because the underlying status-detection reliability problem is still open (per the source brief). This spec does not attempt to remove or replace it — only to demote it visually.
- The footer's existing distinction between modes (in-flight vs. post-completion vs. approve vs. inline-comment) is correct and continues to be the right way to gate which controls are visible.
- "Secondary / tertiary action" styling is interpreted as a button visually lighter than a primary CTA (e.g., text-button or ghost/outline style) — the exact token / class used is an implementation decision for the plan phase.
- The status indicator's spinner / pill rendering follows whatever the viewer already uses for non-clickable status chips elsewhere, rather than introducing a new pattern.
