# Feature Specification: SpecKit Views Enhancement

**Feature Branch**: `005-speckit-views-enhancement`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "The message 'SpecKit CLI detected! Initialize this workspace to start building with specs.' should not show if a project is not selected. Also in steering we need to show the files created by speckit like scripts, constitution md etc."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Contextual Initialization Message (Priority: P1)

As a user opening the SpecKit Companion extension, I want the initialization message to only appear when I have a project/workspace selected, so that I'm not prompted with irrelevant actions when there's no valid context for initialization.

**Why this priority**: The initialization message appearing without a project context is confusing and misleading. Users cannot initialize a workspace when none is selected, making the message both unhelpful and potentially frustrating. This directly impacts first-use experience.

**Independent Test**: Can be fully tested by opening VS Code without a workspace/project and verifying no initialization prompt appears, then opening with a valid workspace and confirming the message appears appropriately.

**Acceptance Scenarios**:

1. **Given** no workspace/project is open in VS Code, **When** the SpecKit Companion extension loads, **Then** the "SpecKit CLI detected! Initialize this workspace..." message should NOT be displayed
2. **Given** a workspace/project is open in VS Code but SpecKit is not initialized, **When** the SpecKit Companion extension loads, **Then** the initialization message SHOULD be displayed
3. **Given** a workspace/project is open and SpecKit is already initialized, **When** the SpecKit Companion extension loads, **Then** the initialization message should NOT be displayed (already initialized)

---

### User Story 2 - SpecKit Files in Steering View (Priority: P1)

As a user working with SpecKit, I want to see all SpecKit-created files (constitution.md, scripts, templates, etc.) in the steering view, so that I can easily access and manage all my SpecKit configuration files from a single location.

**Why this priority**: Users need visibility into their SpecKit configuration files to understand and modify their project setup. Currently, these files may be hidden or require manual navigation, reducing discoverability and workflow efficiency.

**Independent Test**: Can be fully tested by initializing a SpecKit project and verifying that all SpecKit-generated files appear in the steering view panel.

**Acceptance Scenarios**:

1. **Given** a SpecKit-initialized workspace with a constitution.md file, **When** viewing the steering panel, **Then** the constitution.md file should be visible and accessible
2. **Given** a SpecKit-initialized workspace with scripts in the .specify/scripts directory, **When** viewing the steering panel, **Then** the scripts should be listed and accessible
3. **Given** a SpecKit-initialized workspace with custom templates, **When** viewing the steering panel, **Then** the templates should be visible in the steering view

---

### User Story 3 - Organized SpecKit File Categories (Priority: P2)

As a user with multiple SpecKit configuration files, I want the steering view to organize these files by category (constitution, scripts, templates), so that I can quickly find specific configuration files.

**Why this priority**: As SpecKit projects grow, having a flat list of files becomes unwieldy. Categorization improves navigation efficiency but is secondary to basic visibility of files.

**Independent Test**: Can be fully tested by creating a SpecKit project with multiple file types and verifying they appear under logical groupings in the steering view.

**Acceptance Scenarios**:

1. **Given** a SpecKit workspace with constitution.md and scripts, **When** viewing the steering panel, **Then** files should be grouped by type (e.g., "Constitution", "Scripts", "Templates")
2. **Given** a SpecKit workspace, **When** a new script is added to .specify/scripts, **Then** the steering view should update to show the new script under the appropriate category

---

### Edge Cases

- What happens when the .specify directory exists but is empty?
- How does the system handle corrupted or malformed SpecKit configuration files?
- What happens when a user has custom steering files alongside SpecKit-generated files?
- How does the view behave when SpecKit files are deleted externally while VS Code is open?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect whether a workspace/project is currently open in VS Code before displaying initialization messages
- **FR-002**: System MUST NOT display the "SpecKit CLI detected! Initialize this workspace..." message when no workspace is open
- **FR-003**: System MUST display the initialization message only when: (a) a workspace is open, (b) SpecKit CLI is detected, and (c) the workspace is not already initialized
- **FR-004**: System MUST display SpecKit-generated files in the steering view panel
- **FR-005**: System MUST detect and display the constitution.md file from the .specify directory
- **FR-006**: System MUST detect and display script files from the .specify/scripts directory
- **FR-007**: System MUST detect and display template files from the .specify/templates directory
- **FR-008**: System MUST refresh the steering view when SpecKit files are added, modified, or removed
- **FR-009**: System MUST allow users to open/edit SpecKit files directly from the steering view
- **FR-010**: System MUST visually distinguish between SpecKit-generated files and user-created steering documents

### Key Entities

- **Workspace**: The currently open VS Code workspace or folder that provides context for SpecKit operations
- **SpecKit Configuration**: The `.specify` directory containing constitution, scripts, templates, and other SpecKit-managed files
- **SpecKit File**: Any file generated or managed by SpecKit within the `.specify` directory, including:
  - `constitution.md` - Project principles and guidelines
  - `scripts/` - Automation scripts (bash, powershell)
  - `templates/` - Spec and plan templates
  - Other configuration files

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users opening VS Code without a workspace see zero SpecKit initialization prompts
- **SC-002**: Users with initialized SpecKit workspaces can view 100% of SpecKit-generated files in the steering view
- **SC-003**: Users can access any SpecKit configuration file within 2 clicks from the steering panel
- **SC-004**: The steering view updates within 2 seconds when SpecKit files are added or removed
- **SC-005**: Users can distinguish between SpecKit-generated files and custom steering documents at a glance
