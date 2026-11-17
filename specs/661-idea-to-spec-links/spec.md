# Feature Specification: A spec made from an idea keeps it

**Source**: #931 (w39)

## User Scenarios & Testing

### User Story 1 - Create spec sends the whole handoff (Priority: P1)

Create spec from a go idea fills Create Spec with the title, the rationale, every handoff field the decision wrote (problem, chosen approach, scope, success metrics, open questions) and a `Source:` line naming the idea folder.

**Independent Test**: Build the description for a go decision with five handoff fields.

**Acceptance Scenarios**:

1. **Given** a go decision with a handoff, **When** Create spec runs, **Then** the description carries every field and `Source: <idea folder>`.
2. **Given** that description, **When** specify drafts the spec, **Then** it writes a `**Source**:` line with the folder, and its record keeps it as `source`.

### User Story 2 - The idea and its spec link to each other (Priority: P1)

The idea page lists the specs made from it, and each opens in the viewer. The spec's Overview Source row opens the idea page.

**Independent Test**: Render the idea page with a linked spec, and the Overview with an idea-folder source.

**Acceptance Scenarios**:

1. **Given** a spec whose record names the idea folder, **When** the idea page opens, **Then** "Specs made from this idea" lists it and a click opens it.
2. **Given** a spec whose source is an idea folder, **When** its Source row is clicked, **Then** the idea page opens at its latest report.
3. **Given** a folder that is not an idea, or one outside the project, **When** it is clicked, **Then** nothing opens and the user is told.

## Requirements

- **FR-001**: Create spec MUST send the title, rationale, every handoff field and a `Source:` line with the idea folder.
- **FR-002**: Specify MUST turn a `Source:` assessment folder into the spec's `**Source**:` line, so the record keeps it.
- **FR-003**: The idea page MUST list the specs whose record source is its folder, each opening in the viewer.
- **FR-004**: An idea-folder Source row MUST open the idea page; any other folder or a path outside the project MUST open nothing and say so.

## Success Criteria

- **SC-001**: From a go idea, a reader reaches its spec in one click, and back.

## Assumptions

- Acceptance reworded: "the new spec's record names the idea's folder" is met through the existing `source` field rather than a new one, so w29's Source row shows it.
