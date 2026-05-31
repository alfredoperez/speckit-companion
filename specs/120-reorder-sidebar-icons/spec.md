# Feature Specification: Sidebar Icon Adjustments

**Feature Branch**: `[120-reorder-sidebar-icons]`  
**Created**: 2026-05-28  
**Status**: Draft  
**Input**: User description: "Quiero hacer unos ajustes en los iconos en el side-bar. El boton de refresh se puede quitar. El boton para crear una spec debe ser el primero del lado derecho"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a spec faster (Priority: P1)

As a user working from the sidebar, I want the create-spec action to be the first action on the right side so I can start a new spec without scanning past secondary actions.

**Why this priority**: Starting a spec is the primary sidebar action, so its placement has the biggest effect on speed and discoverability.

**Independent Test**: Open the sidebar in its normal workspace state and confirm the first visible right-side action starts spec creation.

**Acceptance Scenarios**:

1. **Given** the sidebar is visible in a workspace with SpecKit enabled, **When** the user looks at the right-side actions, **Then** the create-spec action is the first visible action.
2. **Given** the user selects the first visible right-side action, **When** the action runs, **Then** the spec creation flow starts without requiring any extra navigation.

---

### User Story 2 - Reduce visual clutter (Priority: P2)

As a user reviewing specs from the sidebar, I want the refresh action removed so the action area focuses on high-value tasks instead of redundant controls.

**Why this priority**: Removing a low-value action simplifies the toolbar, but users still get value from the sidebar even if this change ships after the create-action reordering.

**Independent Test**: Open the sidebar and confirm the manual refresh action is no longer shown while the spec list remains usable.

**Acceptance Scenarios**:

1. **Given** the sidebar is rendered, **When** the user inspects the available actions, **Then** no manual refresh action is displayed.
2. **Given** the sidebar content changes through normal workflow activity, **When** the list updates, **Then** users can continue working without needing a dedicated refresh action.

---

### User Story 3 - Keep the toolbar predictable across states (Priority: P3)

As a user moving between empty, populated, or filtered sidebar states, I want the remaining actions to stay aligned and predictable so the toolbar does not feel unstable.

**Why this priority**: Consistent behavior prevents confusion, but the core value still exists if this polish arrives after the primary action and clutter changes.

**Independent Test**: View the sidebar in multiple common states and verify the right-side action order stays stable and usable.

**Acceptance Scenarios**:

1. **Given** the sidebar switches between empty and populated states, **When** the action area re-renders, **Then** the create-spec action keeps the leading right-side position.
2. **Given** the sidebar is narrow or filtered, **When** the toolbar is displayed, **Then** the visible actions remain aligned, clickable, and free of overlap.

### Edge Cases

- What happens when the sidebar is shown in a context where spec creation is temporarily unavailable? The remaining actions must still render in a stable order without leaving a broken or misleading gap.
- How does the system handle narrow sidebar widths or high zoom levels? The remaining actions must stay visible and interactive without overlapping each other.
- What happens when specs are added, removed, or updated after the refresh action is removed? The sidebar must continue reflecting normal workflow updates through existing automatic update behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The sidebar action area MUST no longer display a manual refresh action.
- **FR-002**: The create-spec action MUST appear as the first visible action on the right side of the sidebar action area.
- **FR-003**: Selecting the first visible right-side action MUST start the existing spec creation flow.
- **FR-004**: Removing the refresh action MUST NOT reduce the sidebar's ability to reflect normal spec-list updates during standard workflow activity.
- **FR-005**: The right-side action order MUST remain consistent across common sidebar states, including empty, populated, and filtered views.
- **FR-006**: When the create-spec action is not available in the current context, the remaining actions MUST render in a stable and visually coherent order.
- **FR-007**: The adjusted action layout MUST remain usable at supported sidebar widths without clipped hit targets or overlapping controls.

## Assumptions

- The request applies to the main SpecKit sidebar action area, not to unrelated viewer or webview toolbars.
- Existing automatic refresh behavior elsewhere in the extension is sufficient to keep the sidebar current after the manual refresh action is removed.
- The create-spec action keeps its existing behavior and permissions; only its placement changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In each standard sidebar state reviewed for this feature, the create-spec action is the first visible right-side action.
- **SC-002**: Users can start spec creation from the sidebar with a single action selection and without scanning past other right-side actions.
- **SC-003**: The sidebar presents one fewer visible action while still reflecting routine spec-list changes during normal workflow use.
- **SC-004**: At supported sidebar widths, the remaining actions stay fully visible, clickable, and free from overlap.
