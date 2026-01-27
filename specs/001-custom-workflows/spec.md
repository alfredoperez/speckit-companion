# Feature Specification: Custom Workflows

**Feature Branch**: `001-custom-workflows`
**Created**: 2026-01-26
**Status**: Draft
**Input**: User description: "Add capability to create custom workflows with configurable steps instead of using default specify/plan/implement commands. Users can define workflow variants (e.g., 'light') with custom command mappings. Include lightweight workflow variants with commit and PR generation checkpoints."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Custom Workflow in Settings (Priority: P1)

As a developer, I want to define custom workflows in VS Code settings so that I can use alternative command sequences tailored to my project's needs.

**Why this priority**: This is the foundational capability that enables all other features. Without workflow configuration, users cannot access custom workflows.

**Independent Test**: Can be fully tested by adding a workflow configuration to settings.json and verifying it is recognized by the extension. Delivers value by allowing personalized workflow definitions.

**Acceptance Scenarios**:

1. **Given** VS Code is open with the extension installed, **When** I add a `speckit.customWorkflows` array to my settings.json with a valid workflow definition, **Then** the workflow is recognized and available for selection
2. **Given** I have configured a custom workflow named "light", **When** I view available workflows, **Then** "light" appears alongside the "default" workflow option
3. **Given** I have configured a custom workflow with invalid structure (missing required fields), **When** the extension loads, **Then** a warning is displayed and the invalid workflow is skipped

---

### User Story 2 - Select Workflow When Generating Specs (Priority: P1)

As a developer, I want to choose between default and custom workflows when starting a new feature so that I can use the appropriate workflow for each situation.

**Why this priority**: This enables users to actually use their configured custom workflows, making the configuration meaningful.

**Independent Test**: Can be fully tested by triggering spec generation and verifying a workflow selection prompt appears with all configured options.

**Acceptance Scenarios**:

1. **Given** I have both default and custom workflows configured, **When** I run the specify command, **Then** I am presented with a choice between "default" and my custom workflow(s)
2. **Given** I have only the default workflow (no custom workflows configured), **When** I run the specify command, **Then** the default workflow is used automatically without prompting
3. **Given** I select the "light" custom workflow, **When** the workflow proceeds, **Then** the steps defined in my "light" workflow configuration are used

---

### User Story 3 - Use Lightweight Workflow with Checkpoints (Priority: P2)

As a developer using a lightweight workflow, I want automatic checkpoints for committing and creating PRs so that I can streamline my development process without manual git operations.

**Why this priority**: This provides the key differentiator for lightweight workflows - reducing friction in the development process through integrated git operations.

**Independent Test**: Can be fully tested by running the implement step of a lightweight workflow and verifying commit/PR checkpoint prompts appear at the appropriate stages.

**Acceptance Scenarios**:

1. **Given** I am using the "light" workflow and reach the implementation phase, **When** implementation is complete, **Then** I am prompted with "Generate Commit" checkpoint
2. **Given** I am at the commit checkpoint, **When** I approve, **Then** a commit is generated without co-author attribution
3. **Given** I have approved the commit, **When** the commit succeeds, **Then** I am prompted with "Generate PR" checkpoint
4. **Given** I am at the PR checkpoint, **When** I approve, **Then** a pull request is created based on the feature branch

---

### User Story 4 - Custom Workflow Step Mapping (Priority: P2)

As a developer, I want to map each workflow step to custom command names so that I can organize my prompt templates according to my team's conventions.

**Why this priority**: Enables teams to use their own naming conventions and prompt organization while still leveraging the workflow structure.

**Independent Test**: Can be fully tested by configuring step mappings and verifying the correct commands are invoked at each workflow stage.

**Acceptance Scenarios**:

1. **Given** I have configured `"step-specify": "light-specify"` in my workflow, **When** the specify step runs, **Then** the "light-specify" command/template is used instead of the default
2. **Given** I have configured `"step-plan": "light-plan"` in my workflow, **When** the plan step runs, **Then** the "light-plan" command/template is used instead of the default
3. **Given** I have configured `"step-implement": "light-implement"` in my workflow, **When** the implement step runs, **Then** the "light-implement" command/template is used instead of the default

---

### Edge Cases

- What happens when a configured custom command/template does not exist? (Display error message and allow user to fix or skip step)
- How does the system handle workflows with partial step definitions? (Use default commands for undefined steps)
- What happens if the user cancels at a checkpoint? (Workflow pauses, user can resume or abort)
- How does the system behave when git operations fail at checkpoints? (Display error, allow retry or skip)
- What happens when a workflow is deleted from settings while a feature is using it? (Fall back to default workflow with warning)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a `speckit.customWorkflows` configuration array in VS Code settings
- **FR-002**: Each workflow definition MUST have a unique `name` property
- **FR-003**: Workflow definitions MUST support `step-specify`, `step-plan`, and `step-implement` properties for custom command mapping
- **FR-004**: System MUST always include a "default" workflow option that uses the standard speckit commands
- **FR-005**: System MUST present a workflow selection prompt when multiple workflows are available
- **FR-006**: System MUST skip workflow selection when only the default workflow exists
- **FR-007**: Workflow steps MUST be able to reference custom command/template names
- **FR-008**: System MUST validate workflow configurations on load and warn about invalid entries
- **FR-009**: Lightweight workflow variants MUST support checkpoint definitions for commit and PR generation
- **FR-010**: Commit generation at checkpoints MUST exclude co-author attribution when specified
- **FR-011**: PR generation at checkpoints MUST use the current feature branch
- **FR-012**: Checkpoints MUST prompt user for approval before executing git operations
- **FR-013**: System MUST store the selected workflow choice with the feature for subsequent steps
- **FR-014**: System MUST handle missing or invalid custom commands gracefully with appropriate error messages

### Key Entities

- **Workflow**: A named configuration defining the command mappings for each workflow step (specify, plan, implement) and optional checkpoint definitions
- **Checkpoint**: A pause point in the workflow that prompts for user approval before executing an action (commit, PR)
- **Step Mapping**: The association between a workflow step (specify, plan, implement) and a custom command name
- **Feature Context**: The persisted state of a feature including which workflow was selected

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create and configure custom workflows in under 2 minutes using settings.json
- **SC-002**: Workflow selection adds no more than 5 seconds to the spec generation process
- **SC-003**: 100% of configured valid workflows appear in the selection prompt
- **SC-004**: Checkpoint prompts allow users to approve or modify actions before execution
- **SC-005**: Commits generated via checkpoints complete successfully with correct commit message format
- **SC-006**: PRs created via checkpoints are properly linked to the feature branch
- **SC-007**: Invalid workflow configurations are identified and reported to users at load time

## Assumptions

- Users are responsible for creating the custom command templates that their workflows reference
- The naming convention for custom commands follows the existing speckit patterns (e.g., `light-specify`, `light-plan`)
- Checkpoint behavior (commit without attribution, PR creation) applies only to workflows that explicitly configure these features
- The "default" workflow cannot be modified or removed
- Workflow configuration is workspace-scoped (each project can have different workflows)
