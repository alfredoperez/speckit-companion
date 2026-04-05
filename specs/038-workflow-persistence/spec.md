# Feature Specification: Workflow Persistence Across Spec Lifecycle

**Feature Branch**: `038-workflow-persistence`  
**Created**: 2026-04-05  
**Status**: Draft  
**Input**: User description: "speckit companion doesn't keep going with the workflows selected at the beginning. If there is none we should use default"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Workflow Selection Persists After Spec Creation (Priority: P1)

A user creates a new spec using the spec editor and selects a custom workflow (e.g., "quick" or a user-defined workflow). After the spec is created and they open it in the spec viewer, the viewer should show the steps from the workflow they originally selected — not revert to the default workflow.

**Why this priority**: This is the core bug. Users lose their workflow selection immediately after spec creation, which breaks the entire workflow-driven experience and forces them to re-select or work with the wrong steps.

**Independent Test**: Create a spec with a non-default workflow selected in the editor, then open the spec in the viewer and verify the correct workflow steps are displayed.

**Acceptance Scenarios**:

1. **Given** a user selects a custom workflow in the spec editor, **When** they submit the spec, **Then** the selected workflow name is saved to the spec's context file
2. **Given** a spec was created with a custom workflow, **When** the user opens the spec viewer, **Then** the viewer displays the steps from the originally-selected workflow
3. **Given** a spec was created with a custom workflow, **When** the user clicks a step tab in the viewer, **Then** the correct command from the originally-selected workflow is executed

---

### User Story 2 - Default Workflow Applied When None Selected (Priority: P1)

When a user creates a spec without explicitly selecting a workflow (or when no workflow context exists for a spec), the system should automatically apply the default workflow and persist that selection so subsequent operations are consistent.

**Why this priority**: Equally critical — specs without an explicit workflow selection currently have undefined behavior on subsequent operations, leading to inconsistent step resolution.

**Independent Test**: Create a spec without selecting any workflow, then verify the default workflow is automatically applied and persisted for all subsequent operations.

**Acceptance Scenarios**:

1. **Given** no workflow is selected during spec creation, **When** the spec is submitted, **Then** the system uses the user's configured default workflow setting or the built-in default
2. **Given** a spec has no context file, **When** any workflow step is triggered, **Then** the system resolves to the default workflow and persists that choice
3. **Given** the user has configured a custom default workflow in settings, **When** a spec is created without explicit selection, **Then** that configured default is used instead of the built-in default

---

### User Story 3 - Workflow Consistency Across All Operations (Priority: P2)

Once a workflow is selected (either explicitly or via default), every subsequent operation on that spec — viewing steps, clicking step tabs, running phase commands — should consistently use the same workflow without re-prompting or silently switching.

**Why this priority**: Even if selection and defaulting work correctly, the workflow must remain stable across the entire spec lifecycle to prevent confusion.

**Independent Test**: Create a spec with a workflow, then perform multiple operations (open viewer, click steps, run commands) and verify the same workflow is used throughout.

**Acceptance Scenarios**:

1. **Given** a spec has a persisted workflow, **When** the user opens the spec viewer multiple times, **Then** the same workflow steps are shown every time
2. **Given** a spec has a persisted workflow, **When** the user triggers a phase command from the viewer, **Then** the command from the persisted workflow is used
3. **Given** a spec has a persisted workflow, **When** the user triggers a phase command from the command palette, **Then** the persisted workflow is respected

---

### Edge Cases

- What happens when a persisted workflow name references a workflow that has been removed from settings? The system should fall back to the built-in default workflow and warn the user.
- What happens when a spec has a legacy context file without a workflow field? The system should apply the default workflow during migration.
- What happens when the user changes their default workflow setting after specs have already been created? Existing specs keep their persisted workflow; only new specs use the updated default.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST save the selected workflow name to the spec's context file when a spec is created via the spec editor
- **FR-002**: System MUST apply the configured default workflow setting when no workflow is explicitly selected during spec creation
- **FR-003**: System MUST fall back to the built-in default workflow when no default workflow setting is configured
- **FR-004**: System MUST read the persisted workflow from the spec's context file when opening the spec viewer
- **FR-005**: System MUST read the persisted workflow from the spec's context file when executing any phase command
- **FR-006**: System MUST fall back to the default workflow when the persisted workflow name references a workflow that no longer exists in settings
- **FR-007**: System MUST NOT re-prompt the user for workflow selection if a valid workflow is already persisted for the spec

### Key Entities

- **Spec Context**: Per-spec metadata that stores the selected workflow name alongside other spec state. This is the single source of truth for which workflow a spec uses.
- **Workflow**: A named sequence of steps (specify, plan, tasks, implement, etc.) that defines the development process for a spec. Can be built-in default or user-configured custom.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of specs created via the spec editor have a workflow persisted in their context file immediately after creation
- **SC-002**: Users never encounter a workflow mismatch between what they selected at creation and what they see in the viewer
- **SC-003**: Users are never re-prompted for workflow selection when a valid workflow is already persisted
- **SC-004**: Specs created without explicit workflow selection behave identically to specs created with the default workflow explicitly selected

## Assumptions

- The spec context file is the appropriate place to persist workflow selection (consistent with existing context storage patterns)
- The default workflow VS Code setting is the authoritative source for the user's preferred default workflow
- Existing specs without a workflow field in their context file should be treated as using the default workflow (no retroactive migration needed)
