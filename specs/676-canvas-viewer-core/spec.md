# The canvas and the mod read the shared viewer core

**Source**: #1031

## User Scenarios & Testing

### User Story 1 - The canvas counts and labels from the shared code (Priority: P1)

A maintainer changes how tasks are counted or which statuses exist in the shared viewer package, and the Copilot canvas follows on its next build. Today the canvas keeps its own copies, which drift.

**Why this priority**: every drift so far was a copy that nobody updated.

**Independent Test**: the canvas build bundles one shared-core module, and the canvas's task counts and status order come from it with the board's tests still green.

**Acceptance Scenarios**:

1. **Given** the canvas build, **When** it runs, **Then** it writes one bundled shared-core module that the board imports.
2. **Given** a tasks file, **When** the board counts its tasks, **Then** the count comes from the shared code and matches today's.
3. **Given** the board's status order and pipeline steps, **When** they are read, **Then** they come from the shared contract.

### User Story 2 - The canvas Overview shows what the viewer shows (Priority: P1)

A developer opens a spec's Overview on the Copilot board and sees the same intent, approach, expectations, decisions, checks, concerns and requirements the VS Code viewer shows, because both read the record the same way. Concerns, which the board never showed, appear.

**Why this priority**: the board's Overview already lacks rows the viewer has.

**Independent Test**: render the board Overview for a record with concerns and see them.

**Acceptance Scenarios**:

1. **Given** a record with concerns, **When** the board renders its Overview, **Then** the concerns appear.
2. **Given** a requirement whose test file is gone, **When** the board renders coverage, **Then** it is marked missing the same way the viewer marks it.

### User Story 3 - The Claude Code pane shows the same proof rows (Priority: P2)

A developer using the Claude Code mod opens the pane's Overview and sees the same rows, from the same derivation.

**Why this priority**: the pane showed none of the proof rows (#983 V11).

**Independent Test**: the mod's Overview model for a record lists its concerns, checks and requirements from the shared derivation.

**Acceptance Scenarios**:

1. **Given** a record, **When** the mod builds its Overview, **Then** its rows come from the shared derivation and its tests pass.

### Edge Cases

- A record with no Overview data still renders the board's empty state.
- A task list with `[P]` markers keeps its parallel count (the board's own list stays).

## Requirements

### Functional Requirements

- **FR-001**: The canvas build MUST bundle one shared-core module from the viewer package's source, replacing the separate step-history bundle.
- **FR-002**: The canvas MUST take task counting, the status order, the pipeline steps and the step status tables from that module.
- **FR-003**: The canvas MUST keep its own step badges, status labels, task list and board-only rules.
- **FR-004**: The canvas Overview MUST read its rows from the shared derivation, including concerns and missing-test marks.
- **FR-005**: The mod MUST build against the viewer package's source and read its Overview rows from the shared derivation.
- **FR-006**: The bundles MUST be regenerated and committed, and the canvas and mod tests MUST pass.
- **FR-007**: The project rules MUST say the canvas and the mod bundle the viewer package at build time.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Zero hand-written copies of task counting or the status tables remain in the canvas.
- **SC-002**: The canvas and mod test suites pass, and CI finds no stale bundle.
- **SC-003**: A record with concerns shows them on the board and in the pane.

## Non-goals

- Rendering the board Overview with the viewer's own components (a later PR).
- The document tabs and Activity panel (the L slice).
- Changing the board's badges, labels or task list.

## Change-level rules

- No runtime dependency: everything is bundled into the folder the canvas ships.

## Verification plan

- `npm run test:canvas` and the mod tests.
- The canvas render test gains a concerns case.

## Assumptions

- The mod's failed-check flag follows the shared derivation's exit codes.
