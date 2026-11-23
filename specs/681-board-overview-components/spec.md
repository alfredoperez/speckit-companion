# The board's Overview from the viewer's own components

**Source**: #1031

## User Scenarios & Testing

### User Story 1 - One Overview, two surfaces (Priority: P1)

A developer opens a spec's Overview on the Copilot board and sees the same sections, wording and order the VS Code viewer shows, because both render the viewer package's components. A change to the viewer's Overview reaches the board on its next build.

**Why this priority**: the board's hand-written copy drifted, and every viewer change had to be ported by hand.

**Independent Test**: render a full record on the board and compare its sections to the viewer's.

**Acceptance Scenarios**:

1. **Given** a record with intent, expectations, checks, decisions and coverage, **When** the board shows its Overview, **Then** each section comes from the viewer's components in the viewer's order.
2. **Given** a record with nothing worth a page, **When** the board shows its Overview, **Then** it stays empty as today.
3. **Given** a requirement whose test file is gone, **When** coverage renders, **Then** it is marked missing.

### Edge Cases

- Repository text in any section reaches the page as text.
- The board's content policy allows no inline style; the rendered sections carry none.

## Requirements

### Functional Requirements

- **FR-001**: The board MUST render the Overview sections with the viewer package's components, server side, from a bundle built at build time.
- **FR-002**: The board MUST keep its own timing note, missing-test marks from disk and run log.
- **FR-003**: The board MUST NOT need any runtime dependency, and the rendered HTML MUST carry no inline style.
- **FR-004**: Tests, bundles and the canvas changelog MUST be updated.

## Success Criteria

### Measurable Outcomes

- **SC-001**: No hand-written Overview section HTML remains in the canvas.
- **SC-002**: The canvas and mod suites and the stale-bundle check pass.

## Non-goals

- The document tabs and Activity panel (a follow-up after a design check).

## Change-level rules

- One new devDependency only, bundled at build time.

## Verification plan

- Render tests on a full record, an empty record, escaped text and a missing test file.

## Assumptions

- The dossier sections render without touching the DOM.
