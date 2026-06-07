# Feature Specification: Status + Resume (v1 boundary)

**Feature Branch**: `130-status-and-resume`  
**Created**: 2026-06-07  
**Status**: Draft  
**Input**: User description: "Ship /speckit.companion.status and /speckit.companion.resume — two commands that turn captured spec state into something actionable. status summarizes the current spec (step, status, recorded decisions, next action). resume continues from the last completed step with those decisions in scope, dispatching the next command. Plus GUI surfacing of the same canonical data in the Companion sidebar. v1 ships here: any spec-kit user installs Companion and gets tracking + resume on their existing flow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See where a spec stands (Priority: P1)

A developer working through a spec-driven pipeline has lost track of where they left off. They run a single status command and immediately see which step the spec is on, its current status, the decisions recorded so far, and what the next action should be — without opening or re-reading any files.

**Why this priority**: This is the first surface that makes the captured state (from steps 1–2) worth anything. Until a user can read the state back, the tracking is invisible. It is the smallest independently shippable slice that delivers value on its own.

**Independent Test**: On a spec that has been carried partway through the pipeline, run the status command and confirm it prints the current step, the current status, the list of recorded decisions, and the recommended next action that matches the spec's actual on-disk state.

**Acceptance Scenarios**:

1. **Given** a spec with captured state recorded, **When** the user runs the status command, **Then** the output shows the current step, current status, recorded decisions, and the next action to take.
2. **Given** a spec whose captured state file is missing but whose pipeline files exist on disk, **When** the user runs the status command, **Then** the status is derived from the files present and still reports a coherent step/status/next-action.
3. **Given** a spec at the very start of the pipeline (only the specification exists), **When** the user runs the status command, **Then** the next action points to the next pipeline step (planning).

---

### User Story 2 - Resume from where you stopped (Priority: P1)

A developer stopped mid-pipeline — context switched, closed the session, came back later. They run a single resume command and the pipeline picks up at the recorded step, with the decisions made earlier still in scope, and the next pipeline command is dispatched automatically without the user re-specifying anything.

**Why this priority**: Resume is the payoff of capture. It removes the manual bookkeeping of "what command do I run next and with what context" and is the headline capability that justifies v1 shipping. It is independently testable and demonstrable on its own.

**Independent Test**: Carry a spec a few steps into the pipeline, stop, then run the resume command and confirm it continues at the correct next step with the previously recorded decisions available to the dispatched command.

**Acceptance Scenarios**:

1. **Given** a spec whose last completed step was planning, **When** the user runs the resume command, **Then** the pipeline advances to the next step (task generation) with the recorded decisions in scope.
2. **Given** a spec stopped partway through task execution, **When** the user runs the resume command, **Then** it continues at the next not-yet-completed task in the task list.
3. **Given** a spec whose captured state is missing but pipeline files exist, **When** the user runs the resume command, **Then** the resume point is derived from the files on disk and the pipeline continues from the correct step.

---

### User Story 3 - See and act on status in the sidebar (Priority: P2)

A developer using the Companion GUI sees the same canonical state surfaced in the sidebar — the current step, a status badge, the last transition — and a Resume action button. Clicking Resume continues the pipeline, and the sidebar reflects the new state without the user manually refreshing.

**Why this priority**: The GUI makes status and resume ambient rather than something a user has to remember to ask for. It depends on the same canonical data the commands read, so it is valuable but secondary to the commands themselves being correct.

**Independent Test**: With a spec at a known step, open the Companion sidebar and confirm it shows the matching step, status badge, and last transition; trigger Resume from the sidebar and confirm the displayed state updates to the new step without a manual refresh.

**Acceptance Scenarios**:

1. **Given** a spec with captured state, **When** the user views the Companion sidebar, **Then** it displays the current step, a status badge, and the last transition.
2. **Given** the sidebar is showing a spec mid-pipeline, **When** the user clicks the Resume action, **Then** the pipeline advances and the sidebar updates to the new step without a manual refresh.
3. **Given** a spec's state changes (via command or resume), **When** the change is recorded, **Then** the sidebar reflects the new step and status automatically.

---

### Edge Cases

- What happens when both the captured state file and the expected pipeline files are missing or empty? The status surface should report that there is nothing to summarize rather than failing.
- How does the system handle a captured state file that is present but malformed/unreadable? Status should fall back to deriving state from files on disk and signal that the recorded state could not be read.
- What happens when resume is requested on a spec that is already at the final step (fully implemented)? Resume should report there is nothing left to advance rather than re-running the last step.
- What happens when the recorded step and the on-disk files disagree (e.g., state says "planned" but no plan file exists)? The surface should prefer the evidence on disk and report the derived state.
- What happens when resume is requested but the underlying pipeline-execution capability is unavailable or below the required minimum version? Resume should decline clearly and tell the user what is needed rather than partially executing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a status command that reads the canonical captured state for the current spec and reports the current step, current status, recorded decisions, and the recommended next action.
- **FR-002**: When the canonical captured state is missing, the status command MUST derive an equivalent summary from the pipeline files present on disk.
- **FR-003**: System MUST provide a resume command that continues the pipeline from the last completed step, with the recorded decisions in scope for the next step.
- **FR-004**: The resume command MUST dispatch the next pipeline command automatically rather than only telling the user which command to run.
- **FR-005**: When resuming inside the task-execution step, the resume command MUST continue at the next not-yet-completed task in the task list.
- **FR-006**: When the canonical captured state is missing, the resume command MUST derive the resume point from the pipeline files present on disk.
- **FR-007**: The Companion sidebar MUST surface the same canonical state — current step, a status badge, and the last transition — for the selected spec.
- **FR-008**: The Companion sidebar MUST provide a Resume action that continues the pipeline from the sidebar.
- **FR-009**: The Companion sidebar MUST reflect state changes (from commands or from the Resume action) automatically, without the user manually refreshing.
- **FR-010**: When there is no remaining step to advance to, the resume command MUST report that the pipeline is complete rather than re-running the last step.
- **FR-011**: When the recorded state and the on-disk pipeline files disagree, the status and resume surfaces MUST prefer the evidence on disk and report the derived state.
- **FR-012**: The status and resume commands MUST behave consistently whether the spec state was authored through the terminal pipeline or through the Companion GUI.

### Key Entities *(include if feature involves data)*

- **Captured spec state**: The canonical record of where a spec is in the pipeline — current step, current status, the history of transitions, and the decisions recorded along the way. It is the single source of truth that status, resume, and the sidebar all read.
- **Pipeline step**: A named stage of the spec-driven workflow (e.g., specify, plan, tasks, implement). Each step has a status and an associated next action.
- **Recorded decision**: A choice captured during an earlier step that must remain in scope when later steps run, so resume carries prior context forward.
- **Transition**: A recorded move from one step/status to another, including which surface authored it; the most recent transition is what the sidebar surfaces as "last transition."

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a stock spec-kit project with Companion installed, a user can run the status command and see the correct current step, status, decisions, and next action for any spec in the pipeline, with zero changes to their existing templates.
- **SC-002**: A user who stopped mid-pipeline can resume to the correct next step with prior decisions in scope in a single command, without manually restating any earlier context.
- **SC-003**: When the captured state file is absent, both status and resume produce the same step/next-action conclusion that they would have produced from the captured state, derived from files alone.
- **SC-004**: After a Resume action in the sidebar, the displayed step and status update to the new state within the same session without a manual refresh.
- **SC-005**: Status and resume reach the same conclusion for a given spec regardless of whether its state was authored via the terminal or the GUI.

## Assumptions

- **Resume semantics inside the task step**: When the pipeline stopped partway through task execution, resume continues at the next not-yet-completed task in the task list. Parallel-group ("[P]") ordering is respected once that capability lands in a later step; until then, the next incomplete task in order is the resume point.
- **Pipeline-execution capability exists**: Resume relies on the existing pipeline-execution mechanism to dispatch the next command; a minimum supported version of that mechanism is required and resume declines clearly if it is unavailable.
- **Single source of truth**: The canonical captured state is the authority when present and readable; file-derived state is a fallback, not a parallel source.
- **Scope boundary for v1**: This feature delivers the two commands plus GUI surfacing of already-captured data. Parallel-pipeline commands, presets, complexity branching, and fully automatic mode are explicitly out of scope and handled in later steps.
