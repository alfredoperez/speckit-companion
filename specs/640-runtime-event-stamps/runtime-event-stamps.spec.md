# Step boundaries from runtime events

**Source**: issue #928, items w16 and w17 (slice 2 of 3)

## User Scenarios & Testing

### User Story 1 - A step starts the moment its command is typed (Priority: P1)

A developer types a spec-kit command such as `/speckit-plan` in an agent that supports spec-kit's runtime events. Today the step's start is recorded only when the assistant gets round to running a hook, seconds later or not at all. After this change spec-kit itself reports the typed prompt to Companion, and Companion stamps the start right away, with no model involved.

**Why this priority**: the start is the boundary most often late or missing, and it needs no judgement to record.

**Independent Test**: feed a prompt-submitted event naming a step command to Companion's handler and read the record.

**Acceptance Scenarios**:

1. **Given** an active spec, **When** a prompt-submitted event arrives with `/speckit-plan`, `/speckit.plan` or `/speckit-companion-plan`, **Then** the record holds a plan start written by the extension.
2. **Given** a prompt that is not a step command, **When** the event arrives, **Then** nothing is written.
3. **Given** a specify command, **When** the event arrives, **Then** the start is saved until the new folder exists, the same way the before-specify hook saves it.

### User Story 2 - A step closes when its work is really done (Priority: P1)

When the assistant finishes a turn, spec-kit reports a stop event. A turn is not a step: on specify, the assistant may stop to ask a clarifying question. After this change Companion closes a step at a stop only when the step is open, its document has changed since it started, and, for implement, every task is checked. Otherwise the stop writes nothing.

**Why this priority**: an automatic close that fires on a question would end steps early, which is worse than a late close.

**Independent Test**: open a step, feed stop events before and after its document changes, and read the record.

**Acceptance Scenarios**:

1. **Given** plan started and `plan.md` written after the start, **When** a stop event arrives, **Then** plan is closed as planned.
2. **Given** specify open and no spec document written yet, **When** a stop event arrives, **Then** nothing is closed.
3. **Given** implement open with unchecked tasks, **When** a stop event arrives, **Then** nothing is closed.
4. **Given** a step already closed by its hook, **When** a stop event arrives, **Then** the record is unchanged.

### User Story 3 - The handlers never disturb the agent (Priority: P2)

Spec-kit runs an event handler as a plain process on every prompt and every turn end. A handler that prints, fails, or takes long would show up in the developer's session. Companion's handlers print nothing, always succeed, and do nothing when there is no active spec.

**Why this priority**: the handlers run on every turn, so any noise is constant.

**Independent Test**: pipe an agent's stop payload into the handler and check the exit code and output.

**Acceptance Scenarios**:

1. **Given** a stop payload on input, **When** the handler runs, **Then** it exits 0 and prints nothing.
2. **Given** malformed input or no active spec, **When** the handler runs, **Then** it exits 0, prints nothing and writes nothing.

## Edge Cases

- Both the event and the hook record the same boundary: the first one stands and the second adds nothing.
- An agent without runtime events: the hooks keep recording every boundary as today.
- A spec already completed: no event writes to it.
- A prompt with leading spaces or arguments after the command still counts.

## Requirements

### Functional Requirements

- **FR-001**: Companion MUST declare handlers for the prompt-submitted and stop events, each a command whose script spec-kit runs directly.
- **FR-002**: Each handler MUST be told which event it is handling by name.
- **FR-003**: A prompt naming a step command MUST record that step's start, written by the extension; any other prompt MUST write nothing.
- **FR-004**: A stop MUST close the open step only when its document changed after the step started and, for implement, every task is checked.
- **FR-005**: A boundary already recorded MUST NOT be recorded again.
- **FR-006**: A handler MUST print nothing and exit 0 on every input.
- **FR-007**: The existing lifecycle hooks MUST keep working unchanged.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In tests, a typed step command's start is recorded with zero model calls.
- **SC-002**: A clarifying-question stop on specify closes the step in 0 of tested cases.
- **SC-003**: Handlers produce empty output and exit 0 for 100% of tested payloads, including malformed ones.

## Assumptions

- The stop event's payload does not say which step ran, so the active spec comes from `.specify/feature.json`, as the hooks resolve it.
- A step's document is the spec file for specify, `plan.md` for plan and `tasks.md` for tasks and implement.
- Recording the last active time on session start is left for later: nothing reads such a field yet.

## Verbatim Constraints

- `--event`
- `by: extension`
