# New specs are written as spec.md

**Source**: issue #926, item w1 (slice 1 of 2)

## User Scenarios & Testing

### User Story 1 - Stock commands find a Companion spec (Priority: P1)

A developer finishes a spec with Companion, then runs a stock spec-kit command such as converge, analyze or clarify. Those commands look for `spec.md` in the feature folder. Companion writes `<short-name>.spec.md`, so today converge stops on its first line and asks the developer to rename a file. After this change Companion writes new specs as `spec.md`, and stock commands find them with no argument.

**Why this priority**: converge is how spec-kit decides a spec is done, and today it cannot run on any Companion spec.

**Independent Test**: create a spec with Companion, then run spec-kit's prerequisite check that requires a spec and a task list.

**Acceptance Scenarios**:

1. **Given** a spec Companion just created, **When** the feature folder is listed, **Then** it holds `spec.md` and no other feature spec file.
2. **Given** that folder with a task list, **When** spec-kit's prerequisite check requiring a spec and tasks runs, **Then** it passes.

### User Story 2 - Older specs keep working (Priority: P1)

Thirty-odd existing folders hold `<name>.spec.md`. They must still open in the viewer, the board and the Claude Code mod, and still pass Companion's own checks.

**Why this priority**: renaming the new file must not break the record of every spec already written.

**Independent Test**: run Companion's checks on one folder of each kind.

**Acceptance Scenarios**:

1. **Given** a folder holding only `<name>.spec.md`, **When** the doctor checks that specify left its spec, **Then** it reports no missing file.
2. **Given** a folder holding only `spec.md`, **When** the same check runs, **Then** it reports no missing file.
3. **Given** a folder holding only `<name>.spec.md`, **When** the quality check runs, **Then** it scores that file.

## Edge Cases

- A folder that holds both names: no Companion step creates one, and readers keep their current choice.
- The demo fixtures already use `spec.md`; they stay as they are.

## Requirements

### Functional Requirements

- **FR-001**: Companion's specify and auto steps MUST write a new feature spec as `spec.md`.
- **FR-002**: Every step that loads the feature spec MUST name `spec.md` first and still read an older `<name>.spec.md`.
- **FR-003**: Companion's artifact, doctor and quality checks MUST accept a feature spec under either name.
- **FR-004**: No Companion step MUST leave a folder holding both names.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A new Companion spec passes spec-kit's spec-and-tasks prerequisite check in 100% of tested runs.
- **SC-002**: Companion's checks report 0 missing specs across the existing named folders and the new layout.

## Assumptions

- Readers in the viewer, the board and the mod already accept both names, so they need no change.
- Living-spec files under `capabilities/` keep their `<name>.spec.md` names.

## Verbatim Constraints

- `spec.md`
