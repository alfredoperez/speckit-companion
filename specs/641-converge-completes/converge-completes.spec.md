# A clean converge completes the spec

**Source**: issue #928, item w45 (slice 3 of 3)

## User Scenarios & Testing

### User Story 1 - A clean converge marks the spec complete with no model call (Priority: P1)

On a plain spec-kit run, a developer finishes implement and runs converge to check nothing is left. Today the spec only reaches completed if the assistant reads and follows the mark-complete page, which writes one fixed status and needs no judgement, so it is easy to skip. After this change the after-converge hook does it: when converge added no tasks and every task is checked, the spec lands at completed, written by the extension.

**Why this priority**: completed is the state the viewer and the board key on, and a skipped page leaves finished work looking open.

**Independent Test**: take an implemented spec, run the converge start and finish hooks without touching the task list, and read the record.

**Acceptance Scenarios**:

1. **Given** an implemented spec with every task checked, **When** converge starts and finishes and the task list did not change in between, **Then** the spec is completed, written by the extension.
2. **Given** an implemented spec, **When** converge appends new tasks before it finishes, **Then** the spec stays implemented.
3. **Given** a spec that is still implementing, **When** converge finishes, **Then** the spec is not completed.

### User Story 2 - Marking a spec complete by hand stays one line (Priority: P2)

A developer can still mark a spec complete themselves. The command page shrinks to one sentence and the one call, like the other hook pages.

**Why this priority**: it is the manual fallback, so it should stay but cost nothing to read.

**Independent Test**: read the command page and run its command on an implemented spec.

**Acceptance Scenarios**:

1. **Given** the mark-complete page, **When** it is read, **Then** it is one sentence and one command.
2. **Given** an implemented spec, **When** the command runs, **Then** the spec is completed as today.

## Edge Cases

- Converge finishing on a spec already completed: nothing changes.
- A converge with no recorded start: the spec is not completed, since there is no window to judge.
- The task list missing: the spec is not completed.

## Requirements

### Functional Requirements

- **FR-001**: The converge finish hook MUST mark an implemented spec completed when every task is checked and the task list did not change after converge started.
- **FR-002**: A converge that changed the task list MUST leave the spec at implemented.
- **FR-003**: The completion MUST be written by the extension, through the one existing completion writer.
- **FR-004**: The mark-complete page MUST be one sentence and one command.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In tests, 100% of clean converges on an implemented spec end completed with zero model calls.
- **SC-002**: 0 of tested converges that added tasks complete the spec.

## Assumptions

- Converge adds work only by appending tasks to the task list, so an unchanged task list means converge found nothing.
