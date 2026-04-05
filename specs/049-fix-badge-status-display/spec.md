# Feature Specification: Fix Badge Status Display

**Feature Branch**: `049-fix-badge-status-display`  
**Created**: 2026-04-05  
**Status**: Draft  
**Input**: User description: "Rethink how we show the badge status because when tasks step finishes, it shows 'implement' in the badge instead of reflecting that the current step (tasks) is completed."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Badge reflects current step completion (Priority: P1)

A user completes the "tasks" step of the SDD workflow. The badge in the spec viewer should indicate that the tasks step is complete, not jump ahead to show "implement" as if that step is already active.

**Why this priority**: This is the core issue reported. The badge is the primary visual indicator of workflow progress, and showing incorrect state causes confusion about what has actually been accomplished.

**Independent Test**: Can be tested by completing any workflow step and verifying the badge text matches the actual state (completed current step vs. incorrectly showing next step).

**Acceptance Scenarios**:

1. **Given** a spec with `currentStep: "tasks"` and tasks step completed, **When** the spec viewer renders, **Then** the badge shows a completion indicator for the tasks step (e.g., "TASKS COMPLETE") rather than "IMPLEMENTING"
2. **Given** a spec with `currentStep: "specify"` and the specify step completed, **When** the spec viewer renders, **Then** the badge shows "SPECIFY COMPLETE" rather than "PLANNING"
3. **Given** a spec with `currentStep: "plan"` and the plan step completed, **When** the spec viewer renders, **Then** the badge shows "PLAN COMPLETE" rather than "CREATING TASKS"

---

### User Story 2 - Badge shows in-progress state accurately (Priority: P1)

While a user is actively working on a step (e.g., still creating tasks), the badge should reflect the active/in-progress state of that step, not the next step.

**Why this priority**: Equally important as completion display since users spend most of their time in active steps and need accurate feedback.

**Independent Test**: Can be tested by starting a workflow step and verifying the badge shows the correct in-progress state.

**Acceptance Scenarios**:

1. **Given** a spec with `currentStep: "tasks"` and `status: "active"`, **When** the step is still in progress, **Then** the badge shows "CREATING TASKS..." with an in-progress indicator
2. **Given** a spec with `currentStep: "implement"` and `status: "active"`, **When** implementation is in progress, **Then** the badge shows "IMPLEMENTING..." with an in-progress indicator

---

### User Story 3 - Badge state transitions are predictable (Priority: P2)

A user navigating through the SDD workflow steps expects the badge to follow a clear, predictable pattern: each step shows its own in-progress and completed states before the next step becomes active.

**Why this priority**: Predictability builds trust in the tool. If badge transitions are erratic, users lose confidence in the workflow state tracking.

**Independent Test**: Can be tested by walking through the full workflow (specify -> plan -> tasks -> implement) and verifying badge text at each transition point.

**Acceptance Scenarios**:

1. **Given** a user progressing through the workflow, **When** they complete the specify step, **Then** the badge transitions from "SPECIFYING..." to "SPECIFY COMPLETE" (not directly to "PLANNING")
2. **Given** a user who has completed a step, **When** they explicitly advance to the next step, **Then** the badge transitions to the new step's in-progress state
3. **Given** a user viewing a spec where no step is actively in progress, **When** the spec viewer renders, **Then** the badge shows the last completed step's completion state

---

### Edge Cases

- What happens when `stepHistory` has a `completedAt` for the current step but `status` is still "active"?
- How does the badge display when a user manually navigates back to a previously completed step?
- What should the badge show when `currentStep` is "implement" and all tasks are done (final step completion)?
- How does the badge behave when `.spec-context.json` has no `stepHistory` entries (legacy/migrated specs)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The badge MUST reflect the actual state of the `currentStep`, not auto-advance to show the next step
- **FR-002**: The badge MUST distinguish between "in-progress" and "completed" states for each workflow step
- **FR-003**: When a step's `stepHistory` entry has a `completedAt` timestamp and `currentStep` still points to that step, the badge MUST show a completion indicator for that step
- **FR-004**: When a step is actively being worked on (no `completedAt`, `progress` is set), the badge MUST show an in-progress indicator
- **FR-005**: The badge MUST handle all SDD workflow steps: specify, plan, tasks, implement
- **FR-006**: The badge MUST gracefully handle missing or incomplete `stepHistory` data by falling back to the current step's name

### Key Entities

- **Spec Context** (`spec-context.json`): Contains `currentStep`, `status`, `stepHistory`, `progress`, and `currentTask` fields that drive badge computation
- **Step History Entry**: Per-step record with `startedAt` and optional `completedAt` timestamps indicating step lifecycle
- **Badge Text**: The visible text rendered in the spec viewer header reflecting workflow state

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Badge text accurately reflects the current step's state (in-progress or completed) in 100% of workflow transitions
- **SC-002**: Users can determine which step they are on and whether it is complete by reading the badge alone, without checking other UI elements
- **SC-003**: Badge state transitions follow a predictable pattern: step name with in-progress indicator -> step name with completion indicator -> next step with in-progress indicator (only after explicit advance)
- **SC-004**: No badge text references a step that is not the `currentStep` in the spec context

## Assumptions

- The `stepHistory` field in `.spec-context.json` reliably tracks `completedAt` timestamps when steps finish
- Step advancement (changing `currentStep` to the next step) is an explicit user action, not automatic
- The existing badge rendering infrastructure (HTML generation, CSS styling) can accommodate the new text patterns without layout changes
- Legacy specs without `stepHistory` should degrade gracefully to current behavior (showing step name only)
