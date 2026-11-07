# Feature Specification: "Assumed" is a coverage state

**Source**: #963

## User Scenarios & Testing

### User Story 1 - Record what the code relies on without a test (Priority: P1)

When implement finishes, the agent records, per requirement, anything the code relies on that no test checks: a library, the clock, the database, an index. The record keeps that note beside the requirement's tasks and tests.

**Why this priority**: Without a place for it, an untested requirement and one that rests on a known outside guarantee look the same, and the reason disappears with the session.

**Independent Test**: Run the writer with `--assumes FR-004 "relies on the orders index; not timed"` and read the record.

**Acceptance Scenarios**:

1. **Given** a spec, **When** `--assumes FR-004 "<what>"` runs, **Then** the record's coverage for FR-004 holds that text.
2. **Given** an assumption already stored, **When** a second one is recorded for the same requirement, **Then** the stored text is replaced by the new one.
3. **Given** a requirement with tasks and tests, **When** an assumption is recorded, **Then** its tasks and tests are kept.
4. **Given** the batch form, **When** a coverage entry carries `assumes`, **Then** it lands exactly as the flag would write it.

### User Story 2 - See tested, assumed or untraced per requirement (Priority: P1)

In the Overview, each requirement in Coverage carries one state: tested, assumed or untraced. An assumed requirement says what it relies on. The section count and the header strip count a requirement as traced when it is tested or assumed.

**Why this priority**: The reader needs to tell at a glance which requirements a test protects, which rest on something outside the code, and which nobody accounted for.

**Independent Test**: Open a story with one tested, one assumed and one untraced requirement.

**Acceptance Scenarios**:

1. **Given** a requirement with tests, **When** the Overview opens, **Then** it shows Tested with its test count, as today.
2. **Given** a requirement with no tests and an assumption, **When** the Overview opens, **Then** it shows Assumed and the assumption text.
3. **Given** a requirement with tests and an assumption, **When** the Overview opens, **Then** it shows Tested, with the assumption beneath.
4. **Given** a requirement with neither, **When** the Overview opens, **Then** it shows the untraced state, as today.
5. **Given** three of four requirements tested or assumed, **When** the Overview opens, **Then** the section and the header strip read 3/4 traced.

### Edge Cases

- A blank assumption is not stored.
- An assumption for a requirement no earlier step listed creates its coverage entry.
- A named test that is not on disk still shows the not-found state; an assumption does not hide it.
- Assumption text containing markup shows as text, and long text wraps inside the row at narrow widths.

## Requirements

### Functional Requirements

- **FR-001**: The writer MUST record an assumption per requirement through `--assumes <req> "<what>"` and through the batch `coverage` entry's `assumes` key.
- **FR-002**: Recording an assumption MUST keep the requirement's title, tasks and tests.
- **FR-003**: The implement step MUST tell the agent to record an assumption for each requirement the code relies on without a test.
- **FR-004**: The Overview MUST show each requirement as tested, assumed or untraced, with tests taking precedence over an assumption.
- **FR-005**: An assumed requirement MUST show what it assumes; a tested one with an assumption MUST show it beneath.
- **FR-006**: The traced count in Coverage and in the header strip MUST count tested and assumed requirements.
- **FR-007**: Records without assumptions MUST render exactly as today.

### Key Entities

- **Coverage entry**: per requirement, its title, tasks, tests, and now an optional assumption: one line saying what the requirement relies on without a test.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A requirement recorded with only an assumption reads Assumed with its text in the Overview.
- **SC-002**: A spec with one tested, one assumed and one untraced requirement reads 2/3 traced in both counts.
- **SC-003**: Every existing Overview fixture and capture renders unchanged.

## Assumptions

- One assumption per requirement is enough; recording again replaces it, as a title does.
- The weak state (a test that never fails) is item r4, a later slice.

## Verbatim Constraints

- Flag: `--assumes <req> "<what>"`
- Batch key: `assumes`
- State words: `Tested`, `Assumed`, and today's untraced label `No test linked`
