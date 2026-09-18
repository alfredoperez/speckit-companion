# Feature Specification: Requirement Coverage Badges

**Feature Branch**: `614-requirement-coverage-badges`
**Created**: 2026-09-18
**Status**: Draft
**Input**: GitHub issue #750, "Per-requirement coverage badges never appear in the viewer"

A living spec's requirement cards can show how many tests cover each requirement. The card knows how to draw that label, and Storybook shows it, but the running extension never sends the numbers. So every card in production is blank where the label belongs, and a blank reads as "this requirement has no tests".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See test coverage on each requirement card (Priority: P1)

A developer opens a capability's living spec in the viewer. Each requirement that has tests mapped to it in the coverage file shows that count on its card, beside the state pill. The developer can tell at a glance which requirements are tested without opening the coverage table.

**Why this priority**: This is the whole defect. The header already says how much of the capability is covered. The cards are where a reader finds out which requirements those are.

**Independent Test**: Open a capability whose coverage file maps tests to some requirements and not others. The mapped cards show a count and the unmapped cards show nothing.

**Acceptance Scenarios**:

1. **Given** a capability whose coverage file maps tests to a requirement, **When** its living spec opens in the running extension, **Then** that requirement's card shows its coverage label.
2. **Given** a requirement with no mapped tests in the same capability, **When** the living spec opens, **Then** its card shows no coverage label.
3. **Given** a requirement that names several tests of which only some exist, **When** the living spec opens, **Then** its label says how many were found out of how many were named.
4. **Given** a card that shows a coverage label, **When** the reader looks at the document outline, **Then** that requirement's outline row says its coverage in its accessible name.

---

### User Story 2 - Capabilities without coverage look the same as today (Priority: P2)

A developer opens a capability that has no coverage file, or one whose coverage cannot be read. Nothing about the viewer changes: no labels, no zeros, no error, no delay before the document appears.

**Why this priority**: Most capabilities have no coverage file yet. The fix must not change what those readers see.

**Independent Test**: Open a capability with no coverage file and compare it with the current release. The cards, header and footer are identical.

**Acceptance Scenarios**:

1. **Given** a capability with no coverage file, **When** its living spec opens, **Then** no card shows a coverage label.
2. **Given** a coverage file that cannot be read, **When** the living spec opens, **Then** the document renders with no coverage labels and no error.

---

### Edge Cases

- Two requirements share the same heading text. Both cards take the same label, as drifted and new marks already do.
- A requirement heading collides with a built-in name such as `toString`. It gets a label only when the coverage file maps tests to it.
- The coverage file changes while the panel is open. The labels update on the next refresh of the capability's health, the same moment the header count updates.
- The per-requirement numbers arrive after the first paint. The cards redraw once to show them, and do not redraw when nothing changed.
- The reader switches to another capability. Labels from the previous capability do not carry over.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST compute, for each requirement of a capability, how many tests the coverage file maps to it, using the same rule that produces the header's covered count.
- **FR-002**: The extension MUST send the per-requirement coverage to the viewer together with the capability's other health facts, after the first paint.
- **FR-003**: The viewer MUST show the coverage label on the card of each requirement that has mapped tests.
- **FR-004**: The viewer MUST show no coverage label, and never a zero, on a requirement with no mapped tests.
- **FR-005**: When a requirement names several tests, its label MUST say how many were found out of how many were named.
- **FR-006**: A capability with no coverage file, or an unreadable one, MUST render exactly as it does today, with no labels and no error.
- **FR-007**: The cards MUST redraw when per-requirement coverage arrives or changes, and MUST NOT redraw when it is unchanged.
- **FR-008**: Coverage labels MUST be cleared when the panel shows a different capability.
- **FR-009**: An automated test MUST cover the path that supplies the values to the cards, from the computed health to the rendered label, not only the card renderer.

### Key Entities

- **Requirement coverage**: for one capability, a label per requirement heading. The heading text is the key, verbatim, the same key drift and new marks use. A requirement with no mapped tests has no entry.
- **Capability health**: the facts the extension resolves after first paint. Today it holds the covered count, drift and new requirements. Requirement coverage joins it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the running extension, 100% of requirements with mapped tests show a coverage label on their card.
- **SC-002**: 0 cards show a zero or an empty label.
- **SC-003**: The number of cards with a label equals the covered figure in the header for the same capability.
- **SC-004**: A capability with no coverage file shows no visible difference from the previous release.
- **SC-005**: The test suite fails if the viewer stops receiving or applying per-requirement coverage.

## Assumptions

- The label wording follows the existing Storybook stories, for example `3/4 tests`. No new copy is designed here.
- "Mapped" means what the header count already means: a coverage line that names a test and the requirement. The per-requirement figure and the header count come from one derivation so they cannot disagree.
- Coverage stays best-effort. Any failure leaves the labels absent, as the living-spec rule "facts are omitted, never rendered as zeros" requires.
- The card's appearance, the coverage table and the header are out of scope. Only the missing supply of values is fixed.
- The Storybook stories and generated docs images already show the label, so they need no regeneration unless the card's markup changes.

## ADDED Requirements
<!-- capability: spec-viewer-living -->

### Each requirement card says how many of its tests exist

The extension SHALL send, with the capability's other health facts after first paint, a coverage label per requirement, and the card SHALL show it beside the state pill. The label counts the test files the requirement's coverage line names and says how many exist when some do not. A requirement whose line names no test SHALL have no label, never a zero. The cards SHALL redraw only when the labels changed, and labels SHALL NOT survive onto another capability's cards.

#### Scenario: a requirement's coverage line names a test that exists
- **WHEN** the capability's health resolves
- **THEN** that requirement's card shows its label

#### Scenario: another capability opens and resolves no health facts
- **WHEN** its cards render
- **THEN** none of them carries the previous capability's label

## ADDED Requirements
<!-- capability: specs-living-model -->

### Per-requirement coverage joins on the requirement key and checks the named files

The extension SHALL read a capability's coverage file into a label per requirement, joining a coverage line to a requirement by its key or by an id its heading carries, and giving a line that names several headings to the longest. A line counts only when it names a test file, and each named path SHALL be confirmed to exist inside the workspace, a path outside it counting as not found. The label SHALL be built from the two counts alone, never from file text, and the whole map SHALL be absent when no line names a test or the file cannot be read.

#### Scenario: a line names two tests and one is missing
- **WHEN** the coverage file is read
- **THEN** the requirement's label reads `1/2 tests`

#### Scenario: a named test path escapes the workspace
- **WHEN** the coverage file is read
- **THEN** that path counts as not found
