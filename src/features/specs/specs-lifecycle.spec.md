# Specs Lifecycle — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This capability decides what a spec's recorded events mean: its status, its current step, when a step is done, and when a spec is complete. Every consumer reads the one derivation here, so a step cannot look finished in one place and pending in another.

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

### A fast-path folded step is derived as folded, once

The shared step-history derivation SHALL mark a step folded when its own extension-stamped step-level start/complete pair spans under one second and its start lands within one second of the previous step's extension-stamped close — anchored on the stamped pair, never on the derived close, which can be a much later next-step start. The flag is independent of duration trust (a same-instant fold is folded but untrusted), is set nowhere else, and folded steps keep counting as measured timing coverage.

#### Scenario: a fast-path run's history is derived
- **WHEN** plan and tasks were stamped back-to-back inside the specify run
- **THEN** their derived entries carry the folded marker and specify's does not

#### Scenario: a sub-second step far from the previous close
- **WHEN** a step's stamped pair spans under a second but starts minutes after the previous step closed
- **THEN** its entry carries no folded marker

### A step's duration is trusted from any deterministic writer, gated on writer authority

The shared step-history derivation SHALL count a step's span as measured when the step carries exactly one step-level start from a deterministic writer and an ordered close (its own step-level complete, or the next lifecycle step's start) whose writer is at least as authoritative as the start's. Writers rank in two tiers: instrumented (`extension`, `cli`, `derive`, `user` — host- or in-command-script-observed) outranks agent (`ai` — a CLI/agent run's own writer-script boundary), which outranks any unrecognized writer. A run driven entirely through the CLI, whose ordered step boundaries are stamped `by:ai`, is therefore trusted, while an `ai` close over an `extension`-stamped start (a premature-finish masquerade) and a phase advanced with only a complete and no start each claim no duration. The existing anomaly guards — a single start, no completion before the start, no competing later start, no cross-phase overlap — continue to apply on top, and the `folded` flag stays defined over `extension`-stamped fast-path pairs only.

#### Scenario: a CLI-only run's history is derived
- **WHEN** every pipeline step carries an ordered `by:ai` step-level start and complete
- **THEN** all four phases count as measured timing coverage

#### Scenario: a premature agent finish over an extension start
- **WHEN** a step's start is stamped `by:extension` and an `ai` step-level complete lands immediately after
- **THEN** that step's duration is not trusted

## Uncovered

- All files under `__tests__/` were listed but not read.
