# Converge finishes a Companion spec

**Source**: issue #926, items w2 and w8 (slice 2 of 3; the viewer's converge step is slice 3)

## User Scenarios & Testing

### User Story 1 - A Companion spec is done only after a clean converge (Priority: P1)

A developer runs the Companion pipeline. Today implement marks the spec completed in the same breath as the last task, while spec-kit says a spec is done when a converge pass finds nothing left. After this change implement leaves the spec at implemented and hands off to converge. A converge pass that adds no task marks the spec completed. One that adds tasks sends the work back to implement.

**Why this priority**: completed should mean the spec was checked against what it promised, not only that the boxes were ticked.

**Independent Test**: run implement and then converge on a small spec, and read the record after each.

**Acceptance Scenarios**:

1. **Given** a spec whose tasks are all checked, **When** implement ends, **Then** the spec is implemented, not completed, and the next step named is converge.
2. **Given** an implemented spec, **When** converge runs and appends nothing, **Then** the spec is completed and the record shows a converge step before it.
3. **Given** an implemented spec, **When** converge appends tasks, **Then** the spec stays implemented and implement runs again.

### User Story 2 - Auto loops implement and converge, with a cap (Priority: P1)

Auto runs the whole pipeline unattended. After this change it runs converge after implement and repeats implement and converge until a pass adds nothing. After three passes it stops and records a concern instead of looping forever.

**Why this priority**: an unattended run has to end on its own, and on the same rule a person follows.

**Independent Test**: read the assembled auto command.

**Acceptance Scenarios**:

1. **Given** auto on a normal spec, **When** converge finds nothing on the first pass, **Then** the run ends completed.
2. **Given** a converge that keeps adding tasks, **When** the third pass still adds tasks, **Then** auto stops at implemented and records a concern naming the open tasks.

### User Story 3 - Converge on a completed spec is recorded, not refused (Priority: P2)

A developer runs converge again on a spec that is already completed. Today the record refuses the write, so the run leaves no trace. After this change the converge run is recorded, the spec stays completed, and if converge appended tasks a concern names how many are open.

**Why this priority**: a finding on finished work should be visible, but the owner chose not to reopen the spec.

**Independent Test**: run the converge hooks on a completed spec with and without new tasks.

**Acceptance Scenarios**:

1. **Given** a completed spec, **When** converge runs and appends a task, **Then** the spec stays completed and a concern names the open task count.
2. **Given** a completed spec, **When** converge runs and appends nothing, **Then** only the converge record changes.
3. **Given** a completed spec, **When** any other step writes, **Then** it is still refused.

## Edge Cases

- A converge that stops before assessing leaves no after-converge record, so it never counts as clean.
- A stock run keeps working as merged in #940: the after-converge hook completes a clean spec.
- The workflow engine ends on converge instead of mark-complete.

## Requirements

### Functional Requirements

- **FR-001**: Companion implement MUST end with the spec at implemented and name converge as the next step.
- **FR-002**: A converge pass that appends no task MUST mark the spec completed, the same way for manual, auto and stock runs.
- **FR-003**: A converge pass that appends tasks MUST leave the spec implemented.
- **FR-004**: Auto MUST repeat implement and converge until a pass appends nothing, stopping after three passes with a concern.
- **FR-005**: A converge on a completed spec MUST be recorded, keep the spec completed, and add a concern naming the open task count when it appended tasks.
- **FR-006**: Every other write on a completed spec MUST stay refused.
- **FR-007**: Every surface that says implement writes completed MUST say converge does.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In tests, 0 specs reach completed straight from implement.
- **SC-002**: 100% of tested clean converges complete the spec; 0 of converges that added tasks do.
- **SC-003**: A converge on a completed spec leaves a recorded trace in 100% of tested cases.

## Assumptions

- Converge is spec-kit's own command; Companion does not ship a converge command of its own.
- The doctor and the status command stop treating implemented as the end of the pipeline.
