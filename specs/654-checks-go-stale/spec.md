# Feature Specification: A check says what code it ran on, and when that code moved

**Source**: #963

## User Scenarios & Testing

### User Story 1 - Each run check records the code it ran on (Priority: P1)

When the run executes a check (a test suite, a type-check, a build), the record keeps which commit the code was on and a snapshot of the working files at that moment, so a later reader can tell exactly what the check proved.

**Why this priority**: An exit code means little without the code it ran against. Checks usually run before the work is committed, so the commit alone is not enough.

**Independent Test**: Run a check through the writer in a git sandbox with an uncommitted change, then read its record.

**Acceptance Scenarios**:

1. **Given** a git project, **When** a check runs through the writer, **Then** its record holds the short commit it ran on and a snapshot of the working files.
2. **Given** a project that is not a git repository, or git failing, **When** a check runs, **Then** it is recorded as today, without commit or snapshot, and the call still succeeds.
3. **Given** a check the agent only reported (not run), **When** it is recorded, **Then** it carries no commit.

### User Story 2 - See when a check is out of date (Priority: P1)

The Overview shows, beside each run check, the commit it ran on. When project files changed after the check ran, the row is marked out of date and says how many files changed since. Changes to the spec's own folder and to Spec Kit's settings do not count.

**Why this priority**: A green check from before the last edit is the claim most likely to mislead a reviewer.

**Independent Test**: Record a check, edit a source file, reopen the Overview.

**Acceptance Scenarios**:

1. **Given** a check and no file changed since, **When** the Overview opens, **Then** the row reads "at <commit>" and is not marked.
2. **Given** a check and two source files changed since, **When** the Overview opens, **Then** the row is marked out of date and reads "at <commit>, 2 files changed since".
3. **Given** only the spec folder changed since, **When** the Overview opens, **Then** the row is not marked.
4. **Given** a check whose snapshot can no longer be read, **When** the Overview opens, **Then** it shows the commit without a mark.
5. **Given** an older check without a commit, **When** the Overview opens, **Then** it renders as today.

### Edge Cases

- A check run on a clean tree still records a snapshot equal to the commit's files.
- Several checks sharing one snapshot are compared once.
- A very large number of changed files shows the count, not the names.
- The comparison must not slow the panel: it is bounded and skipped when git is unavailable.

## Requirements

### Functional Requirements

- **FR-001**: A check run through the writer MUST record the short commit it ran on and a snapshot of the working files, when the project is a git repository.
- **FR-002**: Recording a check MUST succeed without commit or snapshot when git is unavailable or fails.
- **FR-003**: The Overview MUST show the commit beside each run check that has one.
- **FR-004**: The Overview MUST mark a run check out of date when files outside the spec folder and `.specify/` changed after it ran, with the number of files changed.
- **FR-005**: A check whose snapshot cannot be compared MUST show its commit without a mark.
- **FR-006**: Checks recorded before this change, and reported checks, MUST render as today.

### Key Entities

- **Run check**: what was run, the command, its exit code and duration, and now the commit and the working-files snapshot it ran on.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A check followed by an edit to one source file reads out of date with "1 file changed since".
- **SC-002**: Editing only the spec's own files leaves every check current.
- **SC-003**: Every existing Overview fixture and capture renders unchanged.

## Assumptions

- The snapshot is a git tree object; git may prune it after about two weeks, after which the row shows the commit only (FR-005).
- The PR receipts (r1) are a later slice and read these same fields.

## Verbatim Constraints

- Mark: `OUT OF DATE`
- Line: `at <commit>` and `at <commit>, <n> files changed since` (`1 file changed since` for one)
