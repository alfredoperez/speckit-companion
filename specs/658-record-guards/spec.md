# Feature Specification: The run record keeps its promises

**Source**: #963

## User Scenarios & Testing

### User Story 1 - A status never moves backward within a step (Priority: P1)

A late or repeated start for a step that already reached its finished status leaves the status where it is. Today `--step plan --status planned` followed by `--step plan --status planning` moves the spec back to planning.

**Why this priority**: The panel, resume and the doctor all read the status. A backward move makes a finished step look unfinished.

**Independent Test**: Write `planned`, then `planning`, for the same step, and read the status back.

**Acceptance Scenarios**:

1. **Given** a spec at plan / planned, **When** a write asks for plan / planning, **Then** the status stays planned and the run's output says the backward move was refused.
2. **Given** a spec at plan / planned, **When** a write asks for tasks / tasking, **Then** the status moves to tasking as before.

### User Story 2 - A damaged record is kept aside (Priority: P1)

When `.spec-context.json` cannot be read as a record (cut short, not JSON, or JSON that is not an object), the next write keeps a copy of the damaged file beside it and says so, before starting a fresh record. Today the damaged file is overwritten with nothing said.

**Why this priority**: A record's history is the run's evidence. Losing it silently is the one thing the record promises never to do.

**Independent Test**: Truncate a record, run any write, and check the copy exists and the output names it.

**Acceptance Scenarios**:

1. **Given** a truncated record, **When** a write runs, **Then** a copy named `.spec-context.damaged-<time>.json` holds the old bytes and the output names it.
2. **Given** a record whose content is `[]`, **When** a write runs, **Then** it is kept aside the same way.
3. **Given** a damaged record, **When** a read-only script (status, receipts) reads it, **Then** nothing is moved.

### User Story 3 - The writer's promises are tested as properties (Priority: P2)

Property tests drive the real writer with random sequences of writes and check its promises: history only grows, writes merge, status never moves backward, parallel writers lose nothing, damaged records are kept. They take about a minute and run in a slow lane.

**Why this priority**: The two bugs above were found this way. The tests keep them found.

**Independent Test**: Run the property file with Hypothesis installed.

**Acceptance Scenarios**:

1. **Given** Hypothesis is installed and the slow lane is on, **When** the property file runs, **Then** every property passes in about a minute.
2. **Given** Hypothesis is not installed, **When** the normal suite runs, **Then** the property file is skipped, not failed.

### Edge Cases

- A blank file holds nothing, so it is replaced without a copy.
- A write that the step guard already refuses writes nothing, so it keeps nothing aside.

## Requirements

### Functional Requirements

- **FR-001**: A same-step write MUST NOT move the status to an earlier one in the status order, and MUST say so on stderr.
- **FR-002**: A writer that finds a damaged record MUST copy it to `.spec-context.damaged-<time>.json` beside it before publishing, and MUST name the copy on stderr.
- **FR-003**: A read-only reader MUST NOT move or copy a damaged record.
- **FR-004**: Property tests MUST cover history only grows, writes merge, status never backward, parallel writers lose nothing, and damaged records kept.
- **FR-005**: The property tests MUST skip when Hypothesis is missing, and CI MUST run them in a separate step that installs it.

## Success Criteria

- **SC-001**: `planned` then `planning` on one step leaves `planned`.
- **SC-002**: A truncated record leaves a copy with the old bytes after the next write.
- **SC-003**: The property tests pass in CI in under two minutes.

## Assumptions

- Statuses outside the canonical order (a project's own step) are not ranked, as today.
