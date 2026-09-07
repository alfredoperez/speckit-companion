# Specs Lifecycle Status — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How a spec's status and current step move: forward only, derived in one place, settled by the one signal every mode has, and closed only by the pipeline's own terminal step.

## Requirements

### One fact has exactly one derivation

Every derived quantity — a step's start and end, whether a step is complete, what a document row shows, what a spec's effective status is — SHALL be computed in one place and read by every consumer. Two consumers that each compute the same fact WILL eventually disagree, and this repo has shipped that bug (a row's icon and its own tooltip contradicting each other). Adding a second surface that needs a derived fact means reading the existing resolved value, not re-deriving it.

#### Scenario: the sidebar and the viewer both show a step's state
- **WHEN** each renders a step
- **THEN** both read the same derived value from the same derivation
- **AND** it is not possible for them to show contradictory states

#### Scenario: a new consumer needs "is this step complete?"
- **WHEN** it is written
- **THEN** it calls the shared query rather than re-reading the log itself

The step-to-status pairing is the same rule. Every place that needs the status a step runs at, or settles at, SHALL read it from the shared contract. Four separate hand-written copies of that mapping existed, and one of them settled the implement step at `completed` — skipping the user's Mark Completed gate for any spec that happened to be repaired through it.

#### Scenario: a record is repaired because its status is unreadable
- **WHEN** the reconciler derives a replacement status for a finished implement step
- **THEN** it derives `implemented`, leaving the spec's closure to the user

A helper that more than one layer needs SHALL live in the layer that owns it rather than being re-exported from where it used to live. A compatibility re-export leaves the same function reachable by two paths, so the next reader adds a caller against whichever they found first and the retired path never dies.

#### Scenario: a shared helper moves to a lower layer
- **WHEN** the move lands
- **THEN** its old module no longer re-exports it, and every caller names the new home

### Status moves forward and never regresses out of a terminal state

Status transitions SHALL be forward-only. A re-run, a double-fired hook, or a late-arriving write for an earlier step MUST record its event honestly in the log while leaving status and current step alone if the spec has already moved past that step. A spec that has reached a terminal state MUST NOT be dragged backwards by any subsequent write.

The furthest a step can carry a spec on its own is "implementation finished". The final closed state is written only by an explicit terminal step that ran and decided; no recovery, repair, or reconciliation path may infer it from what it finds on disk. When a recorded status is unreadable, such a path SHALL restore the highest state a step can reach on its own and leave the closing act to the terminal step. This is what lets the Companion pipeline finish a spec by itself — it does so *through* its terminal step, not by inference.

#### Scenario: a repair path meets an unreadable status
- **WHEN** it reconstructs the spec's state
- **THEN** it settles no higher than "implementation finished"
- **AND** it never writes the final closed state on its own

#### Scenario: an earlier step's completion arrives late
- **WHEN** a plan-step completion is written for a spec already at tasks
- **THEN** the completion is appended to the log
- **AND** the spec's status and current step stay where they were

A step the project added carries no canonical status. Recording its start or finish SHALL append the history entry and leave the status where it is, and the reconciler SHALL NOT repair a status it has nothing to repair to.

#### Scenario: a project-added step finishes
- **WHEN** its completion is recorded
- **THEN** the entry lands and the status is unchanged

### Reaching the pipeline's end is a real end state, not a bug

The Companion pipeline finishes by marking the spec complete at its last step — that is the intended behavior and the whole point of the pipeline, and MUST NOT be treated as an error to undo. Separately, the extension's *own* autonomous finish (a watcher or hook observing that the work is done) SHALL stop at "implementation finished" and leave the final closing act to the sanctioned completion path. The distinction is who decided: a pipeline that ran to its terminal step decided; a watcher that merely noticed the tasks are all checked did not.

#### Scenario: a Companion run reaches its terminal step
- **WHEN** the pipeline's last step executes
- **THEN** the spec is recorded as complete
- **AND** nothing later reverts it

#### Scenario: a watcher sees every task checked
- **WHEN** it settles the spec
- **THEN** it records the implementation as finished
- **AND** it does not itself declare the spec closed

### Completion is observed at one seam, and observing it writes nothing

Reporting that a spec was completed SHALL happen at exactly one seam: the state-file watcher diffing each write's status against the last known one, because the state file is the only artifact every completion path — the sidebar action, the viewer's lifecycle action, and the pipeline's terminal step written outside the extension — flows through. The observation fires exactly once per transition into the closed state: a first sighting of an already-closed spec seeds the baseline silently, and a re-write of the closed state is a non-event. The seam only *observes* — it adds no writer of the closed state, respects forward-only status, and a deleted spec's baseline is evicted so a re-created spec starts fresh. No completion path may carry its own report beside the seam; two reporters needing cross-de-duplication is the shape this requirement exists to forbid.

#### Scenario: a completion lands from any of the three paths
- **WHEN** the state file's status transitions into the closed state
- **THEN** exactly one completion is reported, whoever wrote it

#### Scenario: two paths act on the same spec
- **WHEN** a second write of the closed state lands after the first
- **THEN** nothing further is reported

#### Scenario: the extension starts over a workspace with closed specs
- **WHEN** the baseline is seeded from what is already on disk
- **THEN** no completion is reported for any of them

### The implementation step settles from a signal that fires in every mode

The implementation step is the one step with no successor to close it, and the host gets no completion callback from any dispatch surface. Its settle MUST therefore hang off the one always-on, mode-agnostic signal — the task list's own file changing — rather than off a terminal handle or a workflow hook that only some modes have. The settle SHALL be guarded so it fires exactly once and only when warranted.

#### Scenario: implementation runs through a chat surface with no terminal
- **WHEN** the last task is checked off
- **THEN** the step still settles
- **AND** the spec does not sit stranded mid-implementation forever

#### Scenario: a spec parked before implementation has a fully-checked task list
- **WHEN** the watcher fires
- **THEN** nothing settles, because implementation was never underway
- **AND** the spec keeps its parked position

#### Scenario: the task list is re-saved after the step already closed
- **WHEN** the watcher fires again
- **THEN** no second closing event is recorded

### A workflow that records nothing still shows progress

Workflows the user defines themselves run commands that write documents but never touch the state record, which would strand them at their first step forever. For those workflows only, progression SHALL be reconstructed from the one signal they do leave — their step outputs on disk — and only ever *forward* of what the record already says. Workflows that do record their own progress MUST be left entirely alone.

A workflow the product ships is recognized by its own step sequence, not by whether every step name belongs to the lifecycle set. A built-in pipeline that ends in a step outside that set MUST still be recognized as built-in and MUST NOT be reconstructed from disk. Recognition may only ever move a workflow from user-defined to built-in — never the reverse — so nothing that reconstructs progression today stops doing so.

A step may claim a whole folder as its own output. Everything inside a claimed folder belongs to the step that claims it and MUST NOT count as loose evidence for any other step.

#### Scenario: a user's workflow has produced its third step's output
- **WHEN** the record still says step one
- **THEN** a reconstructed progression advances it to the third step so the forward action appears
- **AND** the built-in pipelines are untouched by this path

#### Scenario: the record is already at or ahead of what disk shows
- **WHEN** reconstruction runs
- **THEN** the real record wins and nothing is rewritten

#### Scenario: a built-in pipeline ends in a step outside the lifecycle set
- **WHEN** the reader opens a spec running that pipeline
- **THEN** no progression is reconstructed from disk
- **AND** the forward action names the same step the step strip shows as pending

#### Scenario: only a claimed folder's document is present
- **WHEN** the sole document beyond the specification lives in a folder an earlier step claims
- **THEN** no later step reads as having produced output
- **AND** a document loose in the spec directory still counts as before
