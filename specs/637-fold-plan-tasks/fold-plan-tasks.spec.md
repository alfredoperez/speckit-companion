# Fold plan and tasks in one writer call

**Source**: issue #927, item w3 (slice 1 of 2)

## User Scenarios & Testing

### User Story 1 - A small spec always records plan and tasks as finished (Priority: P1)

A developer runs the Companion flow on a small change. Specify decides the change is small and folds plan and tasks into its own run. Today that fold is four separate writer calls the assistant types out, and in the lab one of two runs stopped after the first, leaving plan started and never finished. Because the record only grows, that cannot be repaired, and the viewer shows a step that never ended. With one call that writes all four boundaries together, the fold either lands whole or not at all.

**Why this priority**: a half-written fold is permanent and visible in the viewer. This is the whole slice.

**Independent Test**: run the fold call on a spec that has finished specify, then read its history.

**Acceptance Scenarios**:

1. **Given** a spec whose specify step is complete, **When** the fold call runs, **Then** history gains plan start, plan complete, tasks start and tasks complete, in that order, and the spec reads `tasks` / `ready-to-implement`.
2. **Given** a spec the fold already ran on, **When** the fold call runs again, **Then** the record is unchanged.
3. **Given** the specify step's instructions, **When** they reach the fold, **Then** they name one writer line, not four.

### User Story 2 - The folded steps still read as real steps in the viewer (Priority: P2)

The viewer and the capture check measure each step by its start and complete. The four stamps from one call must stay in order and each step must still span a moment of time, so the viewer recognizes the fold and the check does not flag a zero-length step.

**Why this priority**: a fold the viewer misreads is the same bug in a different place.

**Independent Test**: read the four stamps back and compare them.

**Acceptance Scenarios**:

1. **Given** a fresh fold, **When** its stamps are read, **Then** each is strictly later than the one before it.

## Edge Cases

- The spec has already moved past tasks (implementing, completed): the fold writes nothing and says so.
- A partial fold from an older run exists (plan start only): the fold fills in only what is missing, in order, and never duplicates a boundary.
- The feature directory cannot be found: the call writes nothing and exits 0, like every capture call.
- Two writers at once: the fold holds the record's write lock for all four boundaries.

## Requirements

### Functional Requirements

- **FR-001**: The writer MUST offer one call that records plan start, plan complete, tasks start and tasks complete, in that order, under one write lock.
- **FR-002**: The fold MUST leave the spec at step `tasks` with status `ready-to-implement`.
- **FR-003**: Running the fold on a spec it already folded MUST leave the record unchanged.
- **FR-004**: The fold MUST never move a spec's status backward.
- **FR-005**: Each of the four stamps MUST be strictly later than the one before it.
- **FR-006**: The specify step's fold instruction MUST be one writer line.
- **FR-007**: The fold MUST exit 0 when it cannot write, like every capture call.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In tests, 100% of folds record all four boundaries in order.
- **SC-002**: A second fold changes zero bytes of the record.
- **SC-003**: The assembled specify command holds exactly one fold line.

## Assumptions

- The fold stamps are written `by: extension` with no substep, the same as the four calls they replace.
- Only plan and tasks are ever folded, so the call names them rather than taking an arbitrary list.

## Verbatim Constraints

- `--fold plan,tasks`

## Approach

- `apps/speckit-extension/scripts/write-context.py`: a `--fold plan,tasks` flag. One function opens the record once (the write lock is already held for the whole process), refuses when the spec is past `tasks`, appends only the missing boundaries in order with stamps forced strictly increasing, sets `currentStep: tasks` and `status: ready-to-implement`, and publishes once. Any other value is a caller error (exit 2).
- `apps/speckit-extension/nodes/specify/finalize.md`: the four lines become the one `--fold plan,tasks` line; rebuild the assembled `commands/speckit.companion.specify.md` with `build.py`.
- `apps/speckit-extension/tests/`: tests for order, strictly increasing stamps, idempotence, partial-fold repair, no backward move, and the one-line instruction.
- `apps/speckit-extension/CHANGELOG.md`: one `[Unreleased]` line.
