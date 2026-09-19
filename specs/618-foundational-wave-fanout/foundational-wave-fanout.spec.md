# Implement fans out large Foundational waves

**Issue**: #749 (the part left after #758; the benchmark numbers the issue asks for stay open)

## User Scenarios & Testing

### User Story 1 - A big shared foundation is built by several workers (Priority: P1)

A developer runs a feature whose shared foundation is large, laid out as waves of four or more independent tasks. Implement hands each such wave to several workers at once, waits until every one of them reports back, and only then starts the next wave. The developer sees workers doing the foundation instead of one long single-threaded stretch.

**Why this priority**: the foundation is often the biggest block of independent work in a run, and today it is always built one task at a time.

**Independent Test**: give implement a task list whose Foundational phase has a wave of four tasks on four different files, and check that it dispatches workers for that wave and crosses the join line only after all of them return.

**Acceptance Scenarios**:

1. **WHEN** a Foundational wave holds four or more tasks, **THEN** implement splits that wave's tasks across workers dispatched together.
2. **WHEN** the workers of a wave are still running, **THEN** no task after that wave's join line starts.

### User Story 2 - Small work stays inline (Priority: P1)

A Foundational wave of one to three tasks, and all of Setup and Polish, keep being built by the main agent, because a worker's startup would cost more than the work.

**Why this priority**: the existing measurement showed thin fan-out buys no speed at twice the cost.

**Independent Test**: give implement a Foundational phase with waves of one, two and three tasks and check that none is dispatched.

**Acceptance Scenarios**:

1. **WHEN** a Foundational wave holds fewer than four tasks, **THEN** implement builds it itself.
2. **WHEN** implement builds Setup or Polish, **THEN** it builds them itself whatever their size.

### User Story 3 - The run's subagent tally expects the new workers (Priority: P2)

The maintainer's per-ticket subagent tally counts qualifying Foundational waves in what implement is expected to dispatch, so a run that skips them shows as a gap.

**Why this priority**: without it the tally reports a run that ignored the rule as matching expectations.

**Independent Test**: run the tally against a task list with one qualifying Foundational wave and check the expected count includes it.

**Acceptance Scenarios**:

1. **WHEN** a task list has a Foundational wave of four or more tasks, **THEN** the tally's implement expectation names it.

## Edge Cases

- A wave of four tasks where two touch the same file: that breaks the wave rule the tasks step already enforces, so implement says so and runs those two one after another.
- Workers finish in any order: each only appends its finish; the main agent folds them one at a time.
- One worker's task fails: the join is not crossed, the same as a failed inline task halts the phase.

## Requirements

### Functional Requirements

- **FR-001**: Implement MUST dispatch a Foundational wave of four or more tasks across workers dispatched together.
- **FR-002**: Implement MUST NOT start any task after a wave's join line until every worker of that wave has returned and its finishes are folded.
- **FR-003**: Foundational waves of fewer than four tasks, and all of Setup and Polish, MUST stay with the main agent.
- **FR-004**: The implement command body MUST stay under the 1,000-word node limit.
- **FR-005**: The subagent tally MUST count each qualifying Foundational wave in implement's expected dispatch.

## Success Criteria

### Measurable Outcomes

- **SC-001**: On a task list shaped like spec 612 (Foundational waves of 7, 4, 4, 4 and 1 tasks), implement is instructed to dispatch the first four waves and build the last one itself.
- **SC-002**: 0 nodes over the word limit after the change.

## Assumptions

- Four tasks is the bar because the issue's own example sits there and three or fewer mirrors the thin-phase case measured as wasteful. The speed claim itself needs the benchmark the issue names and is not made here.
- A worker gets one or more tasks of the wave; the split is by task, never across waves.

## MODIFIED Requirements
<!-- capability: commands-pipeline -->

### A step dispatches to avoid reading, or to get a second pair of eyes, never for parallelism itself

A step SHALL dispatch when a worker reads something the main agent would otherwise carry to the end of the run, brings a distinct perspective, or builds independent work a script has already split out for it. Which workers a step sends is decided by `dispatch-briefs.py`, not by the model: plan sends one reader per recorded code area (at most four) and, above `simple` size, one writer per design document; implement sends workers for each Foundational wave of four or more tasks. Tasks does not dispatch. The optional adversarial task review is a panel of distinct lenses, not a split of files.

#### Scenario: a step's only inputs are the artifacts already written
- **WHEN** no script prints briefs for it
- **THEN** it stays inline

#### Scenario: a step wants breadth rather than reading
- **WHEN** it dispatches a review panel
- **THEN** each worker carries a different lens over the same material, not a different slice of it

### Implement dispatches on how much a phase carries, not on every phase

Implement SHALL dispatch a story phase only when it owns roughly five files or more, build the rest inline in phase order, and say which it did which way. The phase's own file count alone decides it; specify, plan and tasks having run in the same session is not a reason to build inline. Foundational goes through `dispatch-briefs.py --waves`: each wave of four or more tasks is split across up to four workers, and the next wave starts only when they have all returned. Smaller Foundational waves, Setup and Polish are built inline.

The story-phase threshold is measured: in ten replays, phases of four files or fewer gained nothing from fanning out and cost about twice as much, while six to eight file phases saved about three minutes.

#### Scenario: a story phase owns two files
- **WHEN** implement reaches it
- **THEN** it is built inline, and the summary says so

#### Scenario: a story phase owns eight files
- **WHEN** implement reaches it
- **THEN** it is dispatched to its own worker

#### Scenario: a Foundational wave holds four or more tasks
- **WHEN** implement reaches it
- **THEN** its tasks go to workers dispatched together, and no task after its join line starts until they all return

## RENAMED Requirements
<!-- capability: commands-pipeline -->

### A step dispatches to avoid reading, or to get a second pair of eyes, never for parallelism itself -> A step dispatches what a script splits out for it, to avoid reading or to get a second pair of eyes
