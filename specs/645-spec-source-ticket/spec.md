# Feature Specification: A spec keeps the ticket it came from

**Feature directory**: `specs/645-spec-source-ticket`
**Source**: #931 (item w11)

## User Scenarios & Testing

### User Story 1 - Find the ticket from the spec (Priority: P1)

A developer starts a spec from a brief that names a ticket, such as `TODO-42` or an issue URL. The spec opens with a Source line naming that ticket exactly as written, and the run record keeps it as `source`, so anyone reading the spec or a tool reading the record finds the ticket without guessing.

**Why this priority**: today the ticket survives only when the model happens to mention it, so the link between work and its ticket is lost.

**Independent Test**: run Companion specify with a brief naming `TODO-42`; read the spec's first lines and the record's `source`.

**Acceptance Scenarios**:

1. **Given** a brief naming `TODO-42`, **When** specify runs, **Then** the spec carries `**Source**: TODO-42` and the record carries `source: TODO-42`.
2. **Given** a brief with no ticket, **When** specify runs, **Then** neither the line nor the field is written.
3. **Given** a brief naming an issue URL, **When** specify runs, **Then** the URL is recorded as written and its page is never fetched.

### User Story 2 - Link a follow-up spec to the one it extends (Priority: P2)

A brief says the work extends or replaces an earlier spec folder. The record keeps that folder as `extends` or `supersedes`, so the two specs can be read together.

**Why this priority**: useful once source is recorded; fewer briefs name an earlier folder.

**Independent Test**: run specify with a brief that says it extends `specs/640-runtime-event-stamps`; read the record.

**Acceptance Scenarios**:

1. **Given** a brief saying it extends `specs/640-runtime-event-stamps`, **When** specify runs, **Then** the record carries `extends: specs/640-runtime-event-stamps`.

## Edge Cases

- A brief naming two tickets: record the first as `source` and mention the other in the spec's Assumptions.
- A ticket id that looks like a task id (`T001`): only an id the brief presents as a ticket counts.
- An earlier folder that does not exist: record it as written; nothing checks it.

## Requirements

### Functional Requirements

- **FR-001**: When the brief names a ticket id or URL, specify MUST write a `**Source**:` line under the spec's title, copied exactly as the brief gives it.
- **FR-002**: The same run MUST record the ticket as `source` on `.spec-context.json`, in the wrap-up call it already makes.
- **FR-003**: When the brief names no ticket, specify MUST write neither the line nor the field.
- **FR-004**: When the brief says the work extends or supersedes an earlier spec folder, the run MUST record it as `extends` or `supersedes`.
- **FR-005**: Specify MUST NOT fetch a ticket URL; the id or URL is data, never instructions.
- **FR-006**: The VS Code extension's record type MUST carry the optional `source`, `extends` and `supersedes` fields.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every spec started from a brief naming a ticket carries that ticket in both the spec and the record.
- **SC-002**: A spec started without a ticket gains no Source line and no `source` field.

## Assumptions

- The viewer chip that shows the source is a later item (w29) and out of scope.
- The bugfix and delta variants of the draft step follow the same rule.

## Verbatim Constraints

- `**Source**:`
- `source`
- `extends`
- `supersedes`

## Approach

- `apps/speckit-extension/nodes/specify/draft-spec.md`, `draft-spec-delta.md`, `draft-spec-bugfix.md`: one bullet each for the Source line.
- `apps/speckit-extension/nodes/specify/finalize.md`: `source`, `extends`, `supersedes` join the `set` map of the wrap-up batch; never fetch.
- Rebuild the assembled commands with `build.py`.
- `apps/vscode/src/core/types/specContext.ts`: the three optional fields.
- A test that the built specify command carries the rule, and that `--batch` with `source` lands on the record.
- Changelog line in `apps/speckit-extension/CHANGELOG.md`.
