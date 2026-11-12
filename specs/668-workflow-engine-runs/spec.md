# Hands-off runs also work on spec-kit's workflow engine

**Source**: #933

## User Scenarios & Testing

### User Story 1 - The engine routes on the recorded size (Priority: P1)

A developer runs the Companion workflow with `specify workflow run`. Specify records the change's size. The engine reads that size and takes the matching route, so a simple change goes straight to implement instead of parking at a review gate meant for normal changes.

**Why this priority**: today every engine run takes the default route, so the size routing never works.

**Independent Test**: run the workflow on a sandbox with a simple request; the run goes from specify to implement with no gate.

**Acceptance Scenarios**:

1. **Given** specify recorded `simple`, **When** the engine reaches the route step, **Then** it runs the simple implement route and skips plan, tasks and both gates.
2. **Given** specify recorded `normal`, **When** the engine reaches the route step, **Then** it takes the full route with its review gates.
3. **Given** no size was recorded, or an unknown value, **When** the engine reaches the route step, **Then** it takes the full route.

### User Story 2 - Gates pause and resume headless (Priority: P1)

A developer runs the workflow from a background terminal, CI or the viewer. The run pauses at the first review gate. They pass it with `specify workflow resume <run id> --input <gate input>=approve`, and the run continues to the next step.

**Why this priority**: without a verdict input, a gate on a non-interactive run can never be passed.

**Independent Test**: start a normal-sized run without a TTY; it pauses at the spec review gate; resume with the gate's input set to `approve`; it moves on and pauses at the plan review gate.

**Acceptance Scenarios**:

1. **Given** a paused run at `review-spec`, **When** the developer resumes with `--input review_spec=approve`, **Then** the run continues to plan.
2. **Given** a paused run, **When** the developer resumes with `reject`, **Then** the run aborts.
3. **Given** a run resumed past the first gate, **When** it reaches the plan gate, **Then** it pauses again rather than reusing the first verdict.

### User Story 3 - The workflow is registered after install (Priority: P2)

A developer installs Companion and runs `specify workflow list`. The Companion workflow is listed beside `speckit`. If it is missing, the doctor says so and its fix registers it.

**Why this priority**: users who look at the engine never see the workflow today.

**Independent Test**: remove the registration, run the doctor; it reports the gap; run its fix; `specify workflow list` shows `speckit-companion`.

**Acceptance Scenarios**:

1. **Given** Companion is installed and the workflow is not registered, **When** the doctor runs, **Then** it reports the missing registration with the fix command.
2. **Given** the doctor's fix runs, **When** the developer lists workflows, **Then** `speckit-companion` is listed.
3. **Given** the workflow is already registered, **When** the doctor runs, **Then** it reports nothing.

### User Story 4 - The site explains the engine path (Priority: P3)

A developer reads the custom workflow page and learns how to start the Companion workflow on the engine, how to resume a paused gate headless, and that headless agent runs need write permission.

**Independent Test**: the page names `specify workflow run`, `specify workflow resume <run id> --input`, and the permission note.

## Edge Cases

- `.specify/feature.json` missing or pointing at a folder with no `.spec-context.json`: the size step prints nothing and the route falls to the full pipeline.
- The size step never fails the run; a read error prints nothing.
- An oversized size prints the warning and runs the full pipeline with gates.
- `speckit.companion.auto` keeps working exactly as before.
- The doctor fix when the `specify` CLI is not on the PATH: it reports the command to run instead of failing.

## Requirements

### Functional Requirements

- **FR-001**: The workflow MUST read the size from the spec's recorded `.spec-context.json`, found through `.specify/feature.json`, with a read-only step whose output the switch can use.
- **FR-002**: The route switch's case keys MUST equal the classify verdicts that change the route, as recorded in the specify step's decisions.
- **FR-003**: A missing or unknown size MUST take the full pipeline, and the workflow MUST say so where it is defined.
- **FR-004**: The unused `scope` input MUST be removed.
- **FR-005**: Every gate MUST name its own verdict input, accepting empty, `approve` or `reject`, so `specify workflow resume --input` passes it without a terminal.
- **FR-006**: The doctor MUST report a missing workflow registration and its fix MUST register the shipped workflow with `specify workflow add`.
- **FR-007**: A test MUST check that the switch reads a step that can carry the value, and that the case keys match the recorded verdicts.
- **FR-008**: The site's custom workflow page MUST document `workflow run`, `resume --input` and the permission note.
- **FR-009**: `speckit.companion.auto` MUST behave unchanged.

## Success Criteria

### Measurable Outcomes

- **SC-001**: On a sandbox, a normal-sized engine run pauses at a gate and one resume command moves it past that gate.
- **SC-002**: On a sandbox, a simple-sized engine run reaches implement with zero gate pauses and no plan or tasks dispatch.
- **SC-003**: After install plus the doctor fix, `specify workflow list` shows the Companion workflow.
- **SC-004**: The engine run's `.spec-context.json` history lists the same steps in the same order as an auto run's.

## Assumptions

- Spec Kit 1.4.1: gates pause on a non-TTY, `verdict_input` names a workflow input, shell steps expose `stdout`, and the switch strips whitespace before matching.
- Extensions cannot ship workflows in their manifest, so registration goes through `specify workflow add` from the doctor.
- One verdict input per gate, so passing one gate never passes the next.

## Verbatim Constraints

- `specify workflow run`, `specify workflow resume <run id> --input`, `specify workflow list`, `specify workflow add`
- `verdict_input`, `review_spec`, `review_plan`
- verdicts `simple`, `normal`, `oversized`
