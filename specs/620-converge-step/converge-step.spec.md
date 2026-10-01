# Feature Specification: Record and show Spec Kit's converge step

**Feature Branch**: `feat/788-converge-step`
**Created**: 2026-10-01
**Status**: Draft
**Input**: Issue #788, "Add Spec Kit's converge step to the run record and viewer", scoped by the user to recording and showing converge.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A converge run is recorded like any other step (Priority: P1)

A developer finishes implement and runs Spec Kit's converge command, which checks the code against the spec, plan and tasks and either appends convergence tasks to the task list or says "Converged". Today the run record refuses a `converge` entry as an unknown step, so the run leaves no trace. With this change the companion extension's hooks around converge record its start and its finish in the spec's run record, stamped by the recorder, so the step has a real, measured span.

**Why this priority**: nothing else can show converge until the record accepts it. This is the MVP.

**Independent Test**: on a spec at `implemented`, fire the before-converge and after-converge captures and read `.spec-context.json`: history holds one converge start and one converge finish, and the status is still `implemented`.

**Acceptance Scenarios**:

1. **Given** a spec at `implemented`, **When** converge's before hook runs, **Then** history gains one `converge` start stamped by the extension, the current step becomes `converge`, and the status stays `implemented`.
2. **Given** converge has started, **When** its after hook runs, **Then** history gains one `converge` finish, and running the hook a second time adds nothing.
3. **Given** converge appended convergence tasks to the task list, **When** its finish is recorded, **Then** the status stays `implemented`; converge never moves the spec backward, and the status command names the next appended task.
4. **Given** no spec resolves, or Python is missing, **When** a converge hook runs, **Then** it warns and the converge command still succeeds.
5. **Given** a spec at `completed` or `archived`, **When** a converge hook runs, **Then** nothing is written.

---

### User Story 2 - The viewer shows converge running and how long it took (Priority: P1)

The developer has the spec open in the viewer while converge runs. The rail entry that already carries implement's progress shows converge in flight, with the spinning glyph, a "converge" label and a timer counting from converge's start. Once converge finishes, the Overview's run timing lists Converge after Implement with its measured time.

**Why this priority**: the point of recording converge is that the person can see it, in the same places they see every other step.

**Independent Test**: load the viewer with a record whose status is `implemented` and whose history has a converge start and no finish; the implement host entry shows the glyph, the label and a timer. Add the finish; the glyph and timer go away and the Overview lists Converge with a duration.

**Acceptance Scenarios**:

1. **Given** a spec at `implemented` with converge started and not finished, **When** the viewer renders, **Then** the rail entry that hosts implement's progress shows the in-flight glyph, a "converge" label and an elapsed timer from converge's start.
2. **Given** converge has finished, **When** the viewer refreshes, **Then** that entry no longer shows the glyph, label or timer.
3. **Given** a converge span with both ends stamped by trusted writers, **When** the Overview renders, **Then** Converge is listed after Implement with its duration.
4. **Given** a converge span with an untrusted or missing end, **When** the Overview renders, **Then** Converge is listed with no number.
5. **Given** a spec that never ran converge, **When** the Overview renders, **Then** the timing reads exactly as before, with no Converge entry and no change to timing coverage.

---

### User Story 3 - Converge never strands a finished spec (Priority: P2)

A spec that recorded converge after implement keeps behaving like a finished implement: the footer still offers Mark Completed and Archive, the status command still says the pipeline is complete or names the next unticked task, the editor's repair pass does not rewrite the record, and the quiet-run strip and step notifications treat converge like any other step.

**Why this priority**: recording a step after implement touches every surface that reasons about step order; any one of them misreading converge would strand the spec.

**Independent Test**: take a record at `implemented` with a converge start and finish after implement; the footer offers Mark Completed, the reconciler returns no repair, status reports the pipeline complete, and mark-complete succeeds.

**Acceptance Scenarios**:

1. **Given** a record at `implemented` whose last entries are a converge start and finish, **When** the viewer derives the footer, **Then** Mark Completed and Archive are offered and no forward button is shown.
2. **Given** the same record, **When** the editor reconciles it, **Then** nothing is rewritten and no warning about a mismatched current step is logged.
3. **Given** the same record, **When** mark-complete runs, **Then** the spec moves to `completed`.
4. **Given** converge appended unticked tasks and the record's current step is `converge`, **When** status runs, **Then** the next action is the next unticked task, not "Pipeline complete".
5. **Given** converge finishes while the viewer is open, **When** the record gains the finish, **Then** one notification reads "Spec NNN · Converge complete".

### Edge Cases

- Converge runs several times in a loop with implement: the record keeps one start and one finish per step, as it does for every step, so the first converge attempt is the one timed and later attempts add nothing. Idle time between implement and converge counts toward no phase.
- Converge runs before implement ever finished: it is recorded; the step order still places it after implement, and it does not change status.
- A record from before this change has no converge entries: it reads exactly as before.
- A project that declared its own step called `converge` keeps working; the name is now canonical.
- Converge finishes with no recorded start (the before hook never ran): one finish is journaled and no duration is offered.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The run record MUST accept `converge` as a step name, placed after `implement` in the step order, in the TypeScript vocabulary, the JSON schema and the Python mirror, with the vocabulary consistency tests covering it.
- **FR-002**: Recording a converge start or finish MUST NOT change the spec's `status`, in either direction.
- **FR-003**: Converge MUST be optional: it is not an expected phase, so a run without converge keeps its timing coverage, and completing or archiving a spec does not depend on it.
- **FR-004**: The companion spec-kit extension MUST register a `before_converge` hook that records converge's start and an `after_converge` hook that records its finish, both stamped by the recorder with `--by extension`, idempotent, and never failing the converge command.
- **FR-005**: A converge step MUST end at its own first finish, and the time between implement's finish and converge's start MUST count toward no phase.
- **FR-006**: While converge is started and not finished, the rail entry that hosts implement's progress MUST show the in-flight glyph, a `converge` label and an elapsed timer from converge's recorded start, even when the status is settled at `implemented`.
- **FR-007**: The Overview's run timing MUST list Converge after Implement, with a duration only when both ends are trusted.
- **FR-008**: A measured converge span MUST count toward the run's total active time when the run's expected phases are all measured, because converge is real work on the same feature.
- **FR-009**: A record whose current step is `converge` MUST keep the same footer gates, status-command next action and repair behaviour as one whose current step is `implement`.
- **FR-010**: The step-complete notification and the run's last-step label MUST name converge "Converge", and the quiet-run strip MUST have a quiet threshold for converge for the case where converge runs while the spec is still `implementing`.
- **FR-011**: The viewer MUST NOT gain a button or menu entry that starts converge.
- **FR-012**: The spec-kit extension docs MUST replace the stale note that says Spec Kit ships no converge, and say how converge relates to `living-drift` and `living-sync`; the hook table in the extension README MUST list the two new hooks.
- **FR-013**: A Storybook story MUST show converge in flight on the rail and a Converge phase in the Overview timing.

### Key Entities

- **Converge step**: a sub-phase of implement in the run record. It owns no status, sits after implement in step order, and is recorded as a start and a finish per attempt.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A converge run fired through the hooks leaves exactly one converge start and one converge finish in the run record, however often the hooks fire, and 0 status changes.
- **SC-002**: A spec that ran converge after implement still offers Mark Completed, and mark-complete succeeds on it.
- **SC-003**: A converge span with trusted ends shows its duration in the Overview, and the in-flight state shows on the rail within one refresh of the start being recorded.
- **SC-004**: Every existing record without converge renders the same rail, Overview timing and footer as before (existing tests stay green).

## Assumptions

- Converge is recorded through spec-kit's own `before_converge` and `after_converge` hooks, which Spec Kit's converge command already fires. No preset override of the stock converge command is added.
- Converge counts toward total active time but not toward timing coverage, so a run that skipped it is not reported as half-measured.
- The quiet threshold for converge matches the other read-and-think steps (it reads the whole feature before writing).
- Out of scope: a Converge button, a Companion converge command or pipeline node, and moving a spec back from `implemented` when converge appends tasks.

## MODIFIED Requirements
<!-- capability: record-a-run -->

### Step and status move together along one vocabulary

`currentStep` SHALL be one of `specify`, `clarify`, `plan`, `tasks`, `analyze`, `implement`, `converge`, and `status` one of `draft`, `specifying`, `specified`, `planning`, `planned`, `tasking`, `ready-to-implement`, `implementing`, `implemented`, `completed`, `archived`. Finishing a step SHALL set the status that step owns (`specified`, `planned`, `ready-to-implement`, `implemented`); `clarify` and `analyze` record only their finish. Starting a step moves `currentStep` and leaves `status` alone unless the caller names one. A finished spec is expressed in `status`, never as a `currentStep` of `done`.

#### Scenario: a project adds its own step
- **WHEN** a project declares an extra step and a run records its start and finish
- **THEN** both boundaries are journaled and the spec's status is left as it was

#### Scenario: a step name is misspelled
- **WHEN** a capture names a step the project does not have
- **THEN** nothing is written and the message lists the steps that exist

## ADDED Requirements
<!-- capability: record-a-run -->

### Converge never changes a spec's status

Recording a converge start or finish SHALL leave `status` where it was, in either direction, so a spec at `implemented` stays `implemented` even when converge appends tasks.

#### Scenario: converge runs on an implemented spec
- **WHEN** Spec Kit's converge fires its before and after hooks on a spec at `implemented`
- **THEN** history gains one converge start and one converge finish stamped by the extension, and the status is still `implemented`

## MODIFIED Requirements
<!-- capability: see-where-a-spec-stands -->

### The next action follows the spec's own workflow

The next action SHALL be: the next step's command when the current step is finished, the current step's command when it is still in progress, the next unticked task when inside implement or converge, and "Pipeline complete" when the spec is `completed` or `archived`, has no tasks left, or is `implemented` and never ran converge. An `implemented` spec that ran converge still names its next unticked task, because converge appends tasks after implement settles. The command offered belongs to the workflow the record names, so a Companion spec continues on Companion commands and a stock spec on stock ones.

#### Scenario: a Companion spec finished planning
- **WHEN** the record has `workflow: companion` and status `planned`
- **THEN** the next command is the Companion tasks command

#### Scenario: converge appended tasks
- **WHEN** the record is at `implemented` with `currentStep: converge` and the task list has an unticked task
- **THEN** status names that task as the next action rather than "Pipeline complete"

### The editor repairs a record that contradicts itself

On reading a record the editor SHALL repair an unrecognised status from what history shows, move `currentStep` back to the step that owns a completed status, and settle a lagging in-progress status once history shows the step complete. It never does that last step for implement, where finishing stays a deliberate action, and it never invents history entries. When `currentStep` does not match the last history entry it logs a warning instead. Converge counts as implement in every one of these checks, so an `implemented` spec whose current step is `converge` is neither rewritten nor warned about.

#### Scenario: a record claims planning began when only specify ran
- **WHEN** a record reads `currentStep: plan` with `status: specified`
- **THEN** `currentStep` is set back to `specify`

#### Scenario: converge is running on an implemented spec
- **WHEN** a record reads `currentStep: converge` with `status: implemented`
- **THEN** the editor rewrites nothing and logs no warning

## ADDED Requirements
<!-- capability: move-a-spec-forward -->

### A running converge shows in flight on the entry that carries implement's progress

While converge is started and not finished, the rail entry that carries implement's progress SHALL show it in flight, with the spinning glyph, a `converge` label and a timer counting from converge's recorded start, even when the spec's status is already `implemented`.

#### Scenario: converge starts after implement
- **WHEN** a converge start is recorded on an `implemented` spec
- **THEN** the Tasks entry shows the spinning glyph, the `converge` label and a timer

#### Scenario: converge finishes
- **WHEN** the converge finish is recorded
- **THEN** the glyph, label and timer are gone on the next refresh

## MODIFIED Requirements
<!-- capability: move-a-spec-forward -->

### Regenerate re-runs the step the run is on

Regenerate SHALL be offered when the step being read has started and the spec is not completed or archived, and never while the run's current step is converge, which the viewer does not start. It SHALL re-run the run's current step, not the tab or sub-document being read, recording a fresh start for that step before sending its command.

#### Scenario: regenerate from a sub-document
- **WHEN** the person presses Regenerate while reading the data model and the run is on plan
- **THEN** the plan command is sent and a plan start is recorded

#### Scenario: converge is the current step
- **WHEN** an `implemented` spec's current step is `converge`
- **THEN** the footer offers no Regenerate

## ADDED Requirements
<!-- capability: see-what-the-run-recorded -->

### Converge is timed when it runs and never counted as missing

The run overview SHALL list Converge after Implement only when the run recorded it, never count it toward timing coverage, and add a trusted converge span to the total of a run whose expected phases are all measured.

#### Scenario: a spec that never ran converge
- **WHEN** the Overview renders a run with no converge entries
- **THEN** no Converge entry shows and timing coverage reads as it did before

#### Scenario: converge ran after implement
- **WHEN** a fully measured run adds a trusted two-minute converge an hour after implement finished
- **THEN** Converge reads 2m after Implement and the total grows by two minutes, not by the hour between them

## MODIFIED Requirements
<!-- capability: protect-the-run-record -->

### A spec is never dragged backward

A write for an earlier step SHALL leave alone a spec already at a later step or at `implemented`, `completed` or `archived`. A spec at `completed` or `archived` is closed to every lifecycle and task write. Per-task finishes are still accepted at `implemented`, and neither converge nor a step the project added is ranked against the built-in order. A spec whose current step is `converge` ranks as implement.

#### Scenario: a late hook resolves to a shipped spec
- **WHEN** an after-specify capture lands on a spec whose status is `completed`
- **THEN** the record is unchanged and the capture says it did not regress it

#### Scenario: a finish arrives for a step the spec has passed
- **WHEN** a step is advanced on a spec already beyond it
- **THEN** the finish is journaled and `status` and `currentStep` stay where they were

#### Scenario: implement finishes after a converge that ran mid-implement
- **WHEN** implement is advanced on an `implementing` spec whose current step is `converge`
- **THEN** the spec moves to `implemented`
