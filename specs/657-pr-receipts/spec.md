# Feature Specification: The pull request carries the receipts

**Source**: #963

## User Scenarios & Testing

### User Story 1 - The PR lists every check the run recorded (Priority: P1)

When the Companion pipeline opens a pull request, its body carries a Receipts section built from the run record, not typed by the agent: each check with its command and exit code, the commit it ran on and whether code changed since, the mutation result, the review depth, and the requirements that rest on an assumption. Checks the agent only reported are labelled "claimed by the agent, not run".

**Why this priority**: A reviewer reads the PR, not the Overview. The evidence has to travel with the change.

**Independent Test**: Run the receipts script on a record with a run check, a claimed check, a stale check, a mutation result, a raised tier and an assumed requirement.

**Acceptance Scenarios**:

1. **Given** a run check that exited 0 in 14 s, **When** the receipts are printed, **Then** its row reads "exit 0 · 14 s".
2. **Given** a check the agent only reported, **When** the receipts are printed, **Then** its row reads "claimed by the agent, not run".
3. **Given** a check whose code changed since, **When** the receipts are printed, **Then** its row reads "exit 0 at <commit> · out of date".
4. **Given** a mutation result and weak requirements, **When** the receipts are printed, **Then** the mutation row names the caught count and the weak requirements.
5. **Given** a raised review depth and an assumed requirement, **When** the receipts are printed, **Then** both appear under the table.
6. **Given** no record or no checks, **When** the receipts are printed, **Then** the section says no checks were recorded, and the script still exits 0.

### User Story 2 - The pipeline puts the receipts in the PR (Priority: P1)

Implement tells the agent to paste the receipts into the pull request body unedited, and the Overview's documentation explains everything #963 added.

**Why this priority**: The section only helps if every Companion PR carries it.

**Independent Test**: Read the built implement command and this repository's PR hook.

**Acceptance Scenarios**:

1. **Given** the implement command, **When** it reaches the review step, **Then** it says to paste the receipts output into the PR body unedited.
2. **Given** the site's Overview page, **When** a reader looks up a Weak, Assumed or out-of-date row, a review depth or the quoted request, **Then** each is explained.

### Edge Cases

- A command or result containing `|`, backticks or line breaks must not break the Markdown table.
- A check without an exit code that the writer derived (a mutation row) shows its result, not an exit code.

## Requirements

### Functional Requirements

- **FR-001**: A read-only script MUST print a Markdown Receipts section from the run record, and never fail.
- **FR-002**: Each run check MUST show its command and "exit N · T s"; a stale one MUST read "exit N at <commit> · out of date".
- **FR-003**: Each check the agent only reported MUST read "claimed by the agent, not run".
- **FR-004**: The section MUST name the mutation result with its weak requirements, the review depth with any raise and its reason, and each assumed requirement with what it assumes.
- **FR-005**: Implement MUST tell the agent to put the receipts output into the PR body unedited.
- **FR-006**: Table cells MUST escape characters that would break the Markdown table.
- **FR-007**: The site's Overview page MUST explain the request quote, decision authors, Assumed, Weak, out-of-date checks, review depth and the receipts.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A PR opened by the pipeline lists every recorded check with its exit code and marks claimed ones.
- **SC-002**: A record with a `|` in a command still renders a valid table.

## Assumptions

- The script is shipped with the other runtime scripts and called from the implement command; the PR itself is opened by the project's own hook.

## Verbatim Constraints

- Heading: `## Receipts`
- Lead: `Recorded by the run, not typed by the agent, except where marked.`
- Claimed: `claimed by the agent, not run`
- Stale: `out of date`
