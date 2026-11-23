# Check the requirements by default above small size

**Source**: #1028

## User Scenarios & Testing

### User Story 1 - Someone other than the builder checks the requirements (Priority: P1)

A developer runs implement on a change sized normal or oversized. Before the run records what it verified, a worker that never saw the plan or the task list reads the requirements and the diff, and says per requirement whether it is met, missing or at risk. A missing requirement is built, and an at-risk one gets a test.

**Why this priority**: the builder grading its own work is the review gap every source in the issue names; the check exists but nobody turns it on.

**Independent Test**: run implement on a normal-size spec and see one requirements verdict per requirement before the verified record.

**Acceptance Scenarios**:

1. **Given** a spec sized normal or oversized, **When** implement runs, **Then** the requirements check runs after the build and before the verified record.
2. **Given** a spec with no recorded size, **When** implement runs, **Then** the check runs, as for normal.
3. **Given** a spec sized simple, **When** implement runs, **Then** the check is skipped.
4. **Given** an auto run, **When** implement reaches the check, **Then** it runs without waiting for a person.

### User Story 2 - The brownfield workflow gets the same check (Priority: P2)

A developer on the shipped brownfield workflow gets the requirements check too, because that workflow lists its own implement steps.

**Why this priority**: otherwise the default silently skips the one shipped workflow that replaces implement's order.

**Independent Test**: build the brownfield workflow and see the check in implement between the build and the verified record.

**Acceptance Scenarios**:

1. **Given** the brownfield workflow, **When** its implement command is built, **Then** it includes the requirements check after the build.

### Edge Cases

- A project recipe that lists its own implement nodes keeps exactly what it lists.
- The manual click-through check stays opt-in and is not added anywhere.

## Requirements

### Functional Requirements

- **FR-001**: Implement's default order MUST run the requirements check after the build and before the verified record.
- **FR-002**: The check MUST skip itself when the recorded size is simple, and run when the size is normal, oversized or missing.
- **FR-003**: The check MUST NOT wait for a person, so auto runs it unchanged.
- **FR-004**: The brownfield workflow MUST include the check in its implement order.
- **FR-005**: The requirements check MUST no longer be listed as an optional extra for implement.
- **FR-006**: The shipped commands MUST match their sources, and the docs and changelog MUST describe the new default.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every normal or oversized implement run records a requirements verdict before its verified record.
- **SC-002**: Zero simple runs pay for the check.
- **SC-003**: The extension suite and the build drift check pass.

## Non-goals

- Turning on the manual click-through check by default.
- Recording a test that failed before the code was written.
- A second independent review on top of the risk-tier review.

## Change-level rules

- No change to what the check does once it runs, beyond the size gate and a fallback for a host that cannot dispatch a worker.

## Verification plan

- The extension tests assert the built implement and brownfield commands carry the check in the right place, with the size gate.
- One sandbox run on a normal-size change shows the verdicts.

## Assumptions

- A missing size reads as normal, the same rule plan and tasks use.
