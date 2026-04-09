# Feature Specification: Archive Button Left Alignment

**Feature Branch**: `054-archive-button-left`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "Archive button should be on the left side"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Archive Button Positioned on Left Side of Footer (Priority: P1)

When viewing a spec in the spec viewer, the user sees the footer action buttons. The Archive button should be visually separated from the primary action buttons (Regenerate, Approve/Plan/Tasks) by being placed on the left side of the footer. This creates a clear visual distinction between destructive/secondary actions (Archive) and forward-progress actions (Regenerate, Approve).

**Why this priority**: This is the core and only requirement of the feature. Moving the Archive button to the left side improves the footer layout by separating destructive actions from progression actions, reducing accidental clicks and following common UI patterns where destructive actions are distanced from primary actions.

**Independent Test**: Can be fully tested by opening any active spec in the spec viewer and verifying the Archive button appears on the left side, separated from the right-aligned action buttons.

**Acceptance Scenarios**:

1. **Given** a spec with status "active", **When** the user views the spec in the spec viewer, **Then** the Archive button appears on the left side of the footer and the Regenerate and Approve/Plan buttons remain on the right side.
2. **Given** a spec with status "tasks-done", **When** the user views the spec in the spec viewer, **Then** the Archive button appears on the left side and the Complete button remains on the right side.
3. **Given** a spec with status "completed", **When** the user views the spec in the spec viewer, **Then** the Archive button appears on the left side and the Reactivate button remains on the right side.

---

### User Story 2 - Consistent Left Placement Across All Spec States (Priority: P2)

The Archive button's left-side placement should be consistent across all spec states where it is visible (active, tasks-done, completed). The button should not appear when the spec is already archived.

**Why this priority**: Consistency across states ensures predictable UI behavior.

**Independent Test**: Can be tested by cycling through spec states and verifying Archive button position remains on the left side in each applicable state.

**Acceptance Scenarios**:

1. **Given** a spec in any non-archived state, **When** the footer renders, **Then** the Archive button is always on the left side of the footer.
2. **Given** a spec with status "archived", **When** the footer renders, **Then** the Archive button is not displayed at all.

---

### Edge Cases

- What happens when the footer has only the Archive button on the left and no right-side buttons? The layout should still render correctly without visual artifacts.
- What happens on narrow viewport widths? The left/right separation should remain clear or degrade gracefully.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Archive button MUST be rendered in the left section of the spec viewer footer instead of the right section.
- **FR-002**: The Archive button MUST maintain its current functionality (triggering the `archiveSpec` message) regardless of position change.
- **FR-003**: The Archive button MUST remain hidden when the spec status is "archived".
- **FR-004**: The right section of the footer MUST contain only forward-progress actions (Regenerate, Approve/Plan, Complete, Reactivate) depending on the current spec state.
- **FR-005**: The left section MUST accommodate the Archive button alongside the existing Edit Source button and toast notification.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Archive button is visually positioned on the left side of the footer in 100% of applicable spec states.
- **SC-002**: Users can distinguish between destructive actions (left) and progression actions (right) at a glance.
- **SC-003**: All existing Archive button functionality continues to work identically after repositioning.
- **SC-004**: The footer layout remains visually balanced and does not break across typical viewport widths used in VS Code panels.

## Assumptions

- The existing `.actions-left` CSS section in the footer can accommodate the Archive button without layout changes.
- The "Edit Source" button remains on the left side alongside the new Archive button placement.
- The visual styling (secondary variant) of the Archive button remains unchanged; only its position changes.
