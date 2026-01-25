# Feature Specification: Plan Step Highlight and Sub-menu Ordering

**Feature Branch**: `006-plan-step-highlight`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "We need to make sure that when a sub-section of the plan is opened the plan step is highlighted. Also, we need to show in the sub-menu inside the plan step, the plan is the first menu option and then the other ones ordered alphabetically."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plan Step Visual Feedback When Viewing Sub-sections (Priority: P1)

As a user viewing any sub-section within a plan step (such as Research, Data Model, or Quickstart), I want the parent Plan step in the workflow progress bar to remain visually highlighted so that I always know which workflow step I'm currently within.

**Why this priority**: This is the core usability fix. Without clear visual indication of which workflow step is active, users lose context about where they are in the overall workflow, leading to confusion and navigation difficulties.

**Independent Test**: Can be fully tested by navigating to any plan sub-section and verifying the Plan step in the progress bar displays a highlighted/selected state (visual ring or indicator around it).

**Acceptance Scenarios**:

1. **Given** a user is on the workflow editor with the Plan step expanded, **When** they click on the "Research" sub-section, **Then** the Plan step circle in the progress bar displays a highlighted/selected visual indicator (e.g., ring around it).

2. **Given** a user is on the workflow editor with the Plan step expanded, **When** they click on the "Data Model" sub-section, **Then** the Plan step circle in the progress bar displays the same highlighted/selected visual indicator.

3. **Given** a user is on the workflow editor with the Plan step expanded, **When** they click on the "Quickstart" sub-section, **Then** the Plan step circle in the progress bar displays the highlighted/selected visual indicator.

4. **Given** a user is viewing a Plan sub-section with the Plan step highlighted, **When** they navigate away to a different workflow step (e.g., Spec or Tasks), **Then** the Plan step highlight is removed and the new step becomes highlighted.

---

### User Story 2 - Sub-menu Ordering with Plan First (Priority: P2)

As a user viewing the sub-menu within the Plan step, I want to see "Plan" as the first option followed by other options in alphabetical order, so that the primary document is always easy to find and the remaining options are predictably organized.

**Why this priority**: This improves discoverability and consistency. The Plan document is the primary artifact of the Plan step, so it should be prominently placed first. Alphabetical ordering for remaining items ensures predictable navigation.

**Independent Test**: Can be fully tested by expanding the Plan step and verifying the sub-menu displays "Plan" first, followed by remaining items (Data Model, Quickstart, Research) in alphabetical order.

**Acceptance Scenarios**:

1. **Given** a user is on the workflow editor, **When** the Plan step sub-menu is displayed, **Then** the "Plan" option appears as the first item in the list.

2. **Given** a user is on the workflow editor with the Plan step sub-menu visible, **When** they view the remaining sub-menu items after "Plan", **Then** the items are displayed in alphabetical order (e.g., Data Model, Quickstart, Research).

3. **Given** a user is on the workflow editor where a Plan step has only some sub-sections available, **When** they view the sub-menu, **Then** "Plan" is still first and available items are alphabetically sorted after it.

---

### Edge Cases

- What happens when the Plan step has no sub-sections? The Plan step should still be highlightable but no sub-menu is displayed.
- What happens when there are sub-sections with names that start with "P" (e.g., "Prerequisites")? They should appear after "Plan" in their correct alphabetical position.
- What happens when a user directly navigates to a Plan sub-section via URL or deep link? The Plan step should still be highlighted upon page load.
- What happens when the Plan sub-section name matches "Plan" exactly but is a different document? The first "Plan" item should refer to the primary plan.md document.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST visually highlight the Plan step in the workflow progress bar when any sub-section within the Plan step is active/selected.
- **FR-002**: System MUST maintain the Plan step highlight consistently across all Plan sub-sections (Research, Plan, Data Model, Quickstart, etc.).
- **FR-003**: System MUST display the "Plan" sub-menu item as the first option in the Plan step sub-menu.
- **FR-004**: System MUST sort all remaining sub-menu items (excluding "Plan") in alphabetical order after the "Plan" option.
- **FR-005**: System MUST update the highlight state when users navigate between different workflow steps.
- **FR-006**: System MUST preserve the correct highlight state on page refresh or direct navigation to a Plan sub-section.
- **FR-007**: The visual highlight indicator MUST be clearly distinguishable from non-highlighted states (using contrast, borders, or other visual cues).

### Key Entities

- **Workflow Step**: A major phase in the workflow (Spec, Plan, Tasks, Done). Contains visual state (completed, active, pending) and can be highlighted.
- **Sub-section**: A document or artifact within a workflow step. Has a name and determines parent step highlight state when active.
- **Sub-menu**: The list of sub-sections displayed when a workflow step is expanded. Has ordering rules based on priority items and alphabetical sorting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify which workflow step they are in within 1 second of viewing the interface when on any Plan sub-section.
- **SC-002**: 100% of Plan sub-sections cause the Plan step to display a highlighted state when active.
- **SC-003**: The "Plan" sub-menu item always appears first in the sub-menu when visible.
- **SC-004**: All non-"Plan" sub-menu items are displayed in correct alphabetical order (A-Z) 100% of the time.
- **SC-005**: Users can predictably locate the Plan document as the first item in the sub-menu on every access.

## Assumptions

- The workflow editor already has the visual infrastructure for highlighting steps (as shown in the attached image with the ring around the Plan step).
- Sub-sections are tied to their parent workflow step and this relationship is already defined in the system.
- The list of sub-sections within a plan is dynamic and may vary between projects.
- "Plan" refers to a specific sub-section that corresponds to the plan.md document.
