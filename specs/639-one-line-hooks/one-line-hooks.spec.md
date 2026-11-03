# One-line journaling hooks

**Source**: issue #928, item w15 (slice 1 of 3)

## User Scenarios & Testing

### User Story 1 - A stock run records its steps without the assistant reading a manual (Priority: P1)

A developer runs plain spec-kit commands in a project with Companion installed. Before and after each step, a Companion hook records the step's start and finish so the viewer can show it. Today each hook makes the assistant load a page of 40 to 56 lines, check that Python exists, and pick the right flags from a table, all to run one line. In a short session the assistant skipped one mandatory hook and ran another twice. After this change each hook page is one sentence and one command, and the script decides the step's status itself.

**Why this priority**: every stock run fires ten of these hooks, so the cost and the misses repeat on every run.

**Independent Test**: count the lines of the seven hook pages before and after, and run each hook's command against a test spec and compare the history it writes with what today's calls write.

**Acceptance Scenarios**:

1. **Given** the seven journaling hook pages, **When** they are read, **Then** each is one sentence plus one command.
2. **Given** a spec, **When** the hook command runs for the start and the finish of plan, tasks, implement or converge, **Then** the history entries match what today's separate calls record.
3. **Given** a hook command that runs twice, **When** the record is read, **Then** it holds one start and one finish for that step.

### User Story 2 - The specify start is recorded without the assistant carrying a time (Priority: P1)

Before specify runs, its folder does not exist yet, so today the before hook asks the assistant to read the clock and remember the time until the after hook. After this change the before hook saves the time itself, and the after hook records it as the start, then the finish.

**Why this priority**: a time the assistant has to carry between two hooks is the step most likely to be lost or typed by hand.

**Independent Test**: run the specify start hook, create the folder, run the specify finish hook, and read the history.

**Acceptance Scenarios**:

1. **Given** the specify start hook ran, **When** the specify finish hook runs on the new folder, **Then** history holds a specify start at the saved time and then a specify finish.
2. **Given** the specify finish hook runs with no saved time, **When** history is read, **Then** it holds only the finish (or the start the editor already recorded).

### User Story 3 - A broken hook list is reported, not skipped quietly (Priority: P2)

When `.specify/extensions.yml` cannot be read, stock spec-kit commands now tell the person that no hooks were checked. Companion's commands still say to skip it silently. After this change they say the same thing stock does.

**Why this priority**: a mandatory hook that silently stops firing is invisible until a record is missing.

**Independent Test**: read the shared hooks instructions in the built specify, plan, tasks and implement commands.

**Acceptance Scenarios**:

1. **Given** an unreadable `.specify/extensions.yml`, **When** a Companion step reads the hooks instructions, **Then** they tell it to report the parser error and that no hooks were checked, then continue.
2. **Given** no `.specify/extensions.yml`, **When** a Companion step runs, **Then** it still skips the hooks silently.

## Edge Cases

- A saved specify start from an earlier, abandoned run: the next specify finish uses only a saved time newer than the folder's own creation, or none.
- The finish hook runs where no feature folder can be found: nothing is written and the command still exits 0.
- The implement finish runs when the feature has no tasks list: nothing is written and the command exits 0.
- A spec already completed: no hook writes to it.

## Requirements

### Functional Requirements

- **FR-001**: The writer MUST offer one hook command per boundary that takes only the boundary (start or finish) and the step, and picks the status itself.
- **FR-002**: A hook start or finish for plan, tasks, implement and converge MUST write the same history entries as today's separate calls.
- **FR-003**: The specify start hook MUST save the real clock time without writing any record, and the specify finish hook MUST record that time as the start before the finish.
- **FR-004**: The implement finish hook MUST sync the finished tasks from the feature's tasks list, as today's call does.
- **FR-005**: Each of the seven journaling hook pages MUST be one sentence and one command, with no Python check.
- **FR-006**: The shared hooks instructions MUST tell the step to report an unreadable `.specify/extensions.yml`, with the parser error, and that no hooks were checked.
- **FR-007**: Every hook command MUST exit 0 when it cannot write.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The seven hook pages drop from 331 lines in total to at most 7 lines of body each.
- **SC-002**: In tests, 100% of hook start and finish calls write the same history as today's calls.
- **SC-003**: The specify start reaches the record in 100% of tested specify runs without the assistant passing a time.

## Assumptions

- The saved specify time lives outside the project, beside the writer's lock files, so it never shows up in git.
- The editor's own dispatch path, which passes a time on the start call, keeps working unchanged.

## Verbatim Constraints

- `--hook start`
- `--hook finish`
