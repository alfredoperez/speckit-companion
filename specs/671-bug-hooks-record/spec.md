# Feature Specification: Record bug runs through the bug hooks

**Source**: #987

## User Scenarios & Testing

### User Story 1 - A bug run typed in chat leaves a record (Priority: P1)

A developer types a bug into chat and runs spec-kit's bug assess, then fix, then test. Each stage's start and finish is recorded in the bug's own run record, in the bug's folder, the same way a spec's steps are recorded. Today nothing is written, so the Bugs pane cannot say when a stage ran or how long it took.

**Why this priority**: without the record, nothing else in this feature has data to show.

**Independent Test**: run assess, fix and test on one bug in a project with Companion installed; the bug's folder holds a run record with a start and finish for each of the three stages.

**Acceptance Scenarios**:

1. **Given** Companion is installed, **When** a bug assess runs in chat and writes its assessment, **Then** the bug's run record holds an assess start and an assess finish.
2. **Given** an assessed bug, **When** fix and then test run, **Then** the same record gains a fix start and finish and a test start and finish, in order.
3. **Given** a record already exists for the bug, **When** a stage runs again, **Then** the earlier entries stay and the new ones are added after them.

### User Story 2 - Partial and stopped runs are visible (Priority: P1)

A fix that only partly applied, a test that failed, or a stage that stopped before writing its report must not look like a clean finish.

**Why this priority**: a record that hides a stopped or partial stage is worse than no record.

**Independent Test**: stop a fix before it writes its report; the record shows the fix started and never finished. Run a fix that reports `partial`; the record's fix finish carries `partial`.

**Acceptance Scenarios**:

1. **Given** a stage starts, **When** it stops early without writing its report, **Then** the record holds the start and no finish, and the pane shows that stage as stopped, not done.
2. **Given** a fix reports `partial` or `not-applied`, **When** its finish is recorded, **Then** the finish carries that outcome.
3. **Given** an assessment with verdict `invalid`, **When** its finish is recorded, **Then** the finish carries `invalid`.

### User Story 3 - The pane shows stage times once (Priority: P2)

The bug's page in the Bugs pane shows when each stage ran and how long it took, read from the record. A bug run through spec-kit's workflow engine shows each stage once, never once from the engine and again from the record.

**Why this priority**: it is the visible payoff, and it depends on stories 1 and 2.

**Independent Test**: open a recorded bug's page; it shows a time per stage. Run a bug through the engine; each stage appears once.

**Acceptance Scenarios**:

1. **Given** a bug with a run record, **When** its page opens, **Then** each recorded stage shows its time and outcome.
2. **Given** a bug run through the workflow engine that also fired the hooks, **When** its page opens, **Then** each stage appears once.
3. **Given** a bug with no record (run before this change), **When** its page opens, **Then** it looks as it does today.

## Edge Cases

- The slug is resolved by the bug command itself; a hook that cannot tell which bug it belongs to records nothing rather than guessing.
- A before hook fires but the bug folder does not exist yet (assess creates it): the hook still records against the slug the command resolved, creating only the record.
- Two stages of different bugs run at once: each writes its own folder's record, under the shared lock.
- An idea (assess extension) has no hooks and gets no record.
- A record that cannot be read or parsed: the pane falls back to today's view.

## Requirements

### Functional Requirements

- **FR-001**: Companion MUST register a hook on each of the six bug events: before and after assess, fix and test.
- **FR-002**: Each hook MUST record the stage boundary for the bug's slug into `.specify/bugs/<slug>/.spec-context.json`, through the existing record writer, with its guarantees (history only grows, writes merge, one cross-process lock).
- **FR-003**: An after hook MUST record the stage's outcome from its report: assessment verdict, fix status, or test result.
- **FR-004**: A stage that started and has no finish MUST read as stopped once a later stage starts or the stage is no longer running.
- **FR-005**: The slug MUST be the one the bug command resolved, the same across assess, fix and test.
- **FR-006**: The Bugs pane MUST show each recorded stage's time and outcome on the bug's page.
- **FR-007**: A bug run through the workflow engine MUST show each stage once.
- **FR-008**: A bug without a record MUST look as it does today.

### Key Entities

- **Bug run record**: the bug's `.spec-context.json`, the same shape as a spec's record, with one history entry per stage boundary (stage, start or finish, time, outcome, author).

## Success Criteria

- **SC-001**: A chat run of assess, fix and test produces 6 boundary entries in the bug's record.
- **SC-002**: A stage stopped early shows as stopped, never as done, in 100% of tested cases.
- **SC-003**: An engine-run bug shows each stage exactly once.
- **SC-004**: Bugs recorded before this change render unchanged.

## Assumptions

- Hooks are model-run, so a stamp happens only when the agent runs the hook; the hook script itself writes it as `by: extension`.
- A hook for a bug folder that does not exist yet records nothing; spec-kit's bug commands create the folder before their hooks run.
- The record lives beside the bug's reports, in `.specify/bugs/<slug>/`, as the owner decided on 2026-11-17.
- Stage names in the record are `assess`, `fix` and `test`.

## Verbatim Constraints

- Hook events: `before_bug_assess`, `after_bug_assess`, `before_bug_fix`, `after_bug_fix`, `before_bug_test`, `after_bug_test`.
- Record path: `.specify/bugs/<slug>/.spec-context.json`.
- Outcomes: verdict `valid` | `likely valid, needs reproduction` | `invalid`; fix status `applied` | `partial` | `not-applied`.
