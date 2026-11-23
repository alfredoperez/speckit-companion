# Open questions and a Clarify action on a spec

**Source**: #1033

## User Scenarios & Testing

### User Story 1 - See how many questions a spec leaves open (Priority: P1)

A developer opens a spec in the VS Code viewer or on the Copilot board and sees "3 open questions" when its spec.md still carries open-question markers.

**Why this priority**: a marker buried in the text is easy to miss, and plan then guesses.

**Independent Test**: open a spec with two markers; the header or board shows "2 open questions".

**Acceptance Scenarios**:

1. **Given** a spec.md with N markers, **When** the viewer opens it, **Then** the header shows "N open questions" ("1 open question" for one).
2. **Given** a spec.md with no markers, **When** the viewer opens it, **Then** no count shows.
3. **Given** the same spec on the Copilot board, **When** the board lists it, **Then** it carries the same count.

### User Story 2 - Run clarify from there (Priority: P1)

Pressing the count in VS Code, or the Clarify chip on the board, runs clarify for that spec.

**Why this priority**: the count is only useful with a way to answer it.

**Independent Test**: press the count; clarify runs for this spec.

**Acceptance Scenarios**:

1. **Given** the count in the VS Code header, **When** it is pressed, **Then** the viewer sends its clarify action.
2. **Given** a spec with open questions on the board, **When** the Clarify chip is pressed, **Then** the board sends clarify for that spec, using the project's stock clarify command.
3. **Given** a spec without open questions, **When** the board shows its actions, **Then** no Clarify chip shows.

### Edge Cases

- Markers inside code fences do not count (the shared counter already skips them).
- A spec with no spec.md shows no count.

## Requirements

### Functional Requirements

- **FR-001**: The viewer state MUST carry the count of open-question markers in spec.md, from the shared counter.
- **FR-002**: The VS Code spec header MUST show "N open question(s)" when the count is above zero, and pressing it MUST send the clarify action.
- **FR-003**: The board MUST carry the same count per spec, from the shared counter bundled into the canvas.
- **FR-004**: The board MUST offer a Clarify chip with the count when it is above zero, sending the stock clarify command for that spec.
- **FR-005**: Bundles, changeset, changelogs and docs MUST be updated.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The count matches the markers in spec.md on both surfaces.
- **SC-002**: Clarify can be started in one press from both surfaces.
- **SC-003**: All suites and the stale-bundle check pass.

## Non-goals

- Blocking plan on open questions (specify already settles them since #1029).
- A Companion-specific clarify command.

## Change-level rules

- No new dependency; the canvas imports nothing at runtime.

## Verification plan

- Derivation and header tests in VS Code; a board test for the count and the chip; a prompts test for the clarify command line.

## Assumptions

- The board's clarify uses the stock `speckit.clarify` in both command sets, since Companion has none.
