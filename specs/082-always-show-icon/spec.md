# Feature Specification: Always Show SpecKit Icon in Activity Bar

**Feature Branch**: `082-always-show-icon`
**Created**: 2026-04-24
**Status**: Draft
**Input**: GitHub issue #112 — "Extension icon not shown until project is open"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Confirm extension is installed without opening a project (Priority: P1)

A user installs SpecKit Companion from the marketplace. They open VS Code with no folder or workspace yet, glance at the activity bar, and immediately see the SpecKit icon. Clicking it reveals a friendly empty state that explains they need to open a folder to start using SpecKit, with a one-click action to do so.

**Why this priority**: This is the entire bug. Today the icon is hidden until a workspace is open, so first-time users cannot tell whether the install succeeded. Fixing this removes the post-install "did it work?" confusion that prompted the issue.

**Independent Test**: Launch a fresh VS Code window with no folder open. Verify the SpecKit icon appears in the activity bar, that clicking it opens a sidebar panel with copy explaining why nothing is listed, and that the panel offers a clear path forward (e.g., "Open Folder").

**Acceptance Scenarios**:

1. **Given** the extension is installed and VS Code starts with no folder open, **When** the user looks at the activity bar, **Then** the SpecKit icon is visible in the same position it would appear when a workspace is open.
2. **Given** the SpecKit icon is visible with no workspace open, **When** the user clicks the icon, **Then** the SpecKit sidebar opens and shows an empty-state message explaining that a folder must be open to use SpecKit, plus an action to open one.
3. **Given** the empty-state panel is visible, **When** the user opens a folder via the empty-state action (or any other VS Code mechanism), **Then** the panel updates to show the normal Specs / Steering / Settings views without requiring the user to click the icon again.

---

### User Story 2 - Smooth handoff back to empty state when the workspace closes (Priority: P2)

A user has been working in a project with SpecKit, then uses File → Close Folder. The activity bar icon stays put and the sidebar reverts to the same empty-state guidance shown to first-time users, so the transition is symmetric and predictable.

**Why this priority**: Without this, the icon would behave inconsistently — present at startup but disappearing after the user closes a folder mid-session. Closing the loop avoids a second class of confusion and keeps the fix coherent.

**Independent Test**: Open a workspace, confirm normal SpecKit views appear, then close the folder and verify the icon remains and the empty-state copy returns.

**Acceptance Scenarios**:

1. **Given** a workspace with SpecKit views is currently open, **When** the user closes the folder, **Then** the SpecKit icon remains in the activity bar.
2. **Given** the user has just closed the folder, **When** they click the SpecKit icon, **Then** they see the same empty-state guidance shown to brand-new users.

---

### Edge Cases

- **Multi-root workspaces**: Behavior must match the single-folder case once at least one folder is present; the empty state only applies when there are zero workspace folders.
- **Workspace opened from the empty-state action**: The sidebar must transition to the normal views without leaving the user staring at stale empty-state copy.
- **Extension not yet activated at startup**: The icon must still appear at the moment a fresh VS Code window finishes loading, not only after some later trigger fires.
- **CLI not installed / SpecKit not initialized in the new workspace**: Once a folder is open, the existing welcome views (install CLI, initialize workspace, create first spec) take over — the new "open a folder" empty state must not override or duplicate them.
- **Panel collapsed by user**: If the user has previously dragged or hidden the SpecKit container, the fix must not force it back open; visibility of the icon is what's required, not auto-revealing the panel.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The SpecKit activity-bar icon MUST be visible whenever the extension is installed and enabled, regardless of whether a workspace folder is open.
- **FR-002**: When the user clicks the SpecKit icon with no workspace folder open, the sidebar MUST display an empty-state panel that clearly explains a folder is required to use SpecKit features.
- **FR-003**: The empty-state panel MUST offer at least one direct action that helps the user proceed (e.g., "Open Folder").
- **FR-004**: When a workspace folder becomes available (the user opens one), the sidebar MUST automatically replace the empty-state panel with the normal SpecKit views without requiring a manual refresh or re-click.
- **FR-005**: When the workspace folder is closed mid-session, the icon MUST remain visible and the sidebar MUST return to the same empty-state panel.
- **FR-006**: The empty-state panel MUST NOT suppress or conflict with the existing welcome flows that appear once a folder is open (install CLI, initialize workspace, create first spec).
- **FR-007**: The fix MUST NOT change the activity-bar position, label, or icon glyph that current users already recognize.
- **FR-008**: The empty-state copy MUST be written for non-technical users, in line with the existing welcome-view voice.

### Key Entities

- **SpecKit activity-bar container**: The user's primary entry point to the extension; its visibility is the subject of this feature.
- **Empty-state panel**: The sidebar content shown when the icon is clicked but no workspace folder is open; carries explanatory copy and the "Open Folder" action.
- **Workspace state**: Whether VS Code currently has zero folders open vs. one-or-more; drives which sidebar content is shown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of users who install the extension see the SpecKit icon in the activity bar within 5 seconds of VS Code finishing startup, with no folder open.
- **SC-002**: A user who installs the extension and opens VS Code with no folder can identify within 10 seconds (a) that SpecKit is installed and (b) what they need to do next, measured via informal usability check or self-report.
- **SC-003**: The number of post-install "is the extension working?" support questions or issue reports tied to icon visibility drops to zero in the first marketplace release that includes this fix.
- **SC-004**: Switching between "no folder open" and "folder open" states updates the sidebar content within 1 second, with no manual refresh required.

## Assumptions

- The existing icon, label, and activity-bar position are correct and should be preserved; the only change is when the container is visible and what it shows when no workspace is open.
- "Open Folder" is the most useful single action for the empty state. If product preference later favors "Open Recent" or a multi-action panel, that is an additive change, not a precondition.
- The existing welcome views (install CLI, init workspace, create first spec) already cover the "folder open but SpecKit not yet set up" path and remain the right surfaces for those states.
- Users have not configured VS Code to hide the SpecKit container manually; respecting their explicit hide preference still takes precedence over this feature.
