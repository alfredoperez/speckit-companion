# Feature Specification: The Overview names the ticket

**Source**: #931 (w29)

## User Scenarios & Testing

### User Story 1 - See where the work came from (Priority: P1)

The Overview's Intent card shows the ticket a spec came from, and the earlier spec it extends or replaces. A ticket URL is a link; an id such as TODO-42 stays text.

**Why this priority**: The record already keeps the ticket; a reader of the spec should not have to open the JSON to find it.

**Independent Test**: Render the Intent section with a source and lineage.

**Acceptance Scenarios**:

1. **Given** `source: TODO-42`, **When** the Overview renders, **Then** a Source row reads TODO-42 as text.
2. **Given** a source URL, **When** the Overview renders, **Then** the Source row links to it; a script URL never links and markup stays text.
3. **Given** `extends` or `supersedes`, **When** the Overview renders, **Then** Extends or Replaces rows name the folder.

### User Story 2 - Find a spec by its ticket (Priority: P2)

Filtering the Specs view by a ticket id finds the spec that came from it.

**Independent Test**: Filter by TODO-42 with one spec carrying that source.

**Acceptance Scenarios**:

1. **Given** a spec with `source: TODO-42`, **When** the filter is TODO-42, **Then** only that spec shows.

## Requirements

- **FR-001**: The viewer state MUST carry `source`, `extends` and `supersedes` from the record.
- **FR-002**: The Intent card MUST show Source, Extends and Replaces rows when present; Source links only an http(s) URL that passes `safeUrl`.
- **FR-003**: The specs filter MUST match the source ticket on its own, not joined to the name.

## Success Criteria

- **SC-001**: A spec with `source: TODO-42` shows a Source row and is found by filtering for TODO-42.

## Assumptions

- Lineage folders show as text, not links: opening another spec from the dossier is a separate change.
