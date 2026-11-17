# Feature Specification: An opt-in mutation check marks weak requirements

**Source**: #963

## User Scenarios & Testing

### User Story 1 - Turn on a mutation check for the project (Priority: P1)

A project that wants proof its tests bite sets `mutation: { enabled: true }` in `.specify/companion.yml`. When implement has validated the work, it runs the project's mutation tool on the files the change touched (Stryker for JavaScript and TypeScript, mutmut for Python) and hands the report to the writer. Without the setting, nothing runs and nothing changes.

**Why this priority**: Passing tests prove little if they would also pass against broken code. It costs minutes, so it is opt-in.

**Independent Test**: Feed the writer a Stryker report with one requirement's tests killing mutants and another's killing none.

**Acceptance Scenarios**:

1. **Given** the setting is off or absent, **When** implement runs, **Then** no mutation tool runs.
2. **Given** a Stryker report and requirements linked to test files, **When** the writer reads it, **Then** a requirement none of whose test files killed a mutant is marked weak, and the others are not.
3. **Given** a Stryker report, **When** the writer reads it, **Then** the record holds a "Mutation check" result reading "<killed> of <total> caught".
4. **Given** a mutmut summary, **When** the writer reads it, **Then** the caught count is recorded, and no requirement is marked weak, since mutmut does not say which test caught what.
5. **Given** an unreadable report, **When** the writer reads it, **Then** it declines with a reason and the call succeeds.

### User Story 2 - See weak requirements (Priority: P1)

Coverage shows a weak requirement as Weak with "tested, but a planted bug passed", and Verified shows the mutation check with its caught count.

**Why this priority**: A weak requirement looks tested today; the reader needs to see it is not.

**Independent Test**: Open a story with a weak requirement and a mutation result.

**Acceptance Scenarios**:

1. **Given** a weak requirement, **When** the Overview opens, **Then** its row reads Weak with "tested, but a planted bug passed", and the Coverage pill is a warning.
2. **Given** a named test missing on disk, **When** the requirement is also weak, **Then** the missing state wins.
3. **Given** a record without a mutation run, **When** the Overview opens, **Then** it renders as today.

### Edge Cases

- A Stryker report without test attribution (no `testFiles`) records the caught count only.
- Re-reading a newer report clears weak marks the new report no longer supports.
- Mutants Stryker ignored or could not compile do not count toward the total.

## Requirements

### Functional Requirements

- **FR-001**: The mutation check MUST run only when `.specify/companion.yml` sets `mutation.enabled: true`.
- **FR-002**: The writer MUST read a Stryker JSON report and mark weak every requirement with test files of which none killed a mutant.
- **FR-003**: The writer MUST read a mutmut summary and record the caught count without marking requirements.
- **FR-004**: Each report read MUST record a "Mutation check" result with "<killed> of <total> caught", and replace the weak marks of every requirement it judged; a report that judges none leaves earlier marks alone.
- **FR-005**: The Overview MUST show Weak for a weak requirement, below missing and above tested, and warn in the Coverage pill.
- **FR-006**: Implement MUST tell the agent, when the setting is on, to run the tool on the changed files and pass the report to the writer.
- **FR-007**: Reading a report MUST never fail the host command; records without a mutation run render as today.

### Key Entities

- **Mutation result**: the tool, killed and total counts, and which requirements came out weak.

## Success Criteria

### Measurable Outcomes

- **SC-001**: With the sample Stryker report, exactly the requirement whose tests killed nothing reads Weak.
- **SC-002**: With the setting off, an implement run never mentions a mutation tool.
- **SC-003**: Every existing Overview fixture and capture renders unchanged.

## Assumptions

- The check runs at the end of implement, once the work validates, rather than after converge: implement is the step every flow runs, and converge reads the result.
- Killed and Timeout mutants count as caught; Ignored, CompileError and RuntimeError are left out of the total.
- A requirement's test entry `path::case` is matched by its file path.

## Verbatim Constraints

- Config: `mutation: { enabled: true }` in `.specify/companion.yml`
- Flag: `--mutation-report <path>`
- Wording: `Weak`, `tested, but a planted bug passed`, `Mutation check`, `<killed> of <total> caught`
