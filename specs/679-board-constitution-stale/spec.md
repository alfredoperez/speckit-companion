# Constitution card and stale documents on the Copilot board

**Source**: #1033

## User Scenarios & Testing

### User Story 1 - See the constitution at a glance (Priority: P1)

A developer opens the Copilot board and sees whether the project has a constitution, whether it is still the template, and when it last changed. When it is missing or a template, the card offers to run constitution.

**Why this priority**: every spec is checked against the constitution, and the board never showed it.

**Independent Test**: open the board in a project without a constitution; the card says so and offers the action.

**Acceptance Scenarios**:

1. **Given** a filled-in constitution, **When** the board opens, **Then** the card says it is in place and when it last changed.
2. **Given** a template or missing constitution, **When** the board opens, **Then** the card says so and offers "Run constitution".

### User Story 2 - Know when a document is behind (Priority: P1)

On a spec whose plan is older than its spec, or whose tasks are older than its plan, the board marks the spec stale and says which document is behind.

**Why this priority**: building from a plan written before the spec changed builds the wrong thing.

**Independent Test**: touch spec.md after plan.md and open the spec; the board says the plan is older than the spec.

**Acceptance Scenarios**:

1. **Given** plan.md older than spec.md, **When** the spec detail opens, **Then** it shows a stale mark naming the plan.
2. **Given** documents written in order, **When** the spec detail opens, **Then** no stale mark shows.

### Edge Cases

- Documents written within the same second count as the same generation, as in VS Code.
- A missing document is never stale.

## Requirements

### Functional Requirements

- **FR-001**: The staleness rule MUST live once in the shared viewer core as a pure function, used by VS Code (unchanged behaviour) and bundled into the board.
- **FR-002**: The board MUST show a constitution card with presence, template or filled, last change, and a run action when missing or a template.
- **FR-003**: The board MUST mark a stale spec and name the document that is behind.
- **FR-004**: Bundles, changeset, changelog and docs MUST be updated.

## Success Criteria

### Measurable Outcomes

- **SC-001**: VS Code's staleness tests pass unchanged.
- **SC-002**: The board's constitution card and stale mark match the files on disk.
- **SC-003**: All suites and the stale-bundle check pass.

## Non-goals

- A constitution card in VS Code (the health view covers it).
- Changing the staleness rule.

## Change-level rules

- The canvas imports nothing at runtime.

## Verification plan

- Core staleness tests; board tests for the constitution state and the stale mark; VS Code staleness tests unchanged.

## Assumptions

- The placeholder test is the one VS Code's detector uses.
