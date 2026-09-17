# Specs Lifecycle — Living Spec

<!-- reviewed: a9c0b02b -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Decides what a spec's recorded events mean: its status, current step, when a step is done, and when the spec is complete. Every consumer reads this one derivation, so a step never looks finished in one place and pending in another.

## Requirements

### One fact has exactly one derivation

Every derived quantity (a step's start and end, step completion, what a document row shows, a spec's effective status) SHALL be computed in one place and read by every consumer. A new surface that needs a derived fact MUST read the existing resolved value, not re-derive it.

#### Scenario: the sidebar and the viewer both show a step's state
- **WHEN** each renders a step
- **THEN** both read the same value from the same derivation
- **AND** they cannot show contradictory states

#### Scenario: a new consumer needs "is this step complete?"
- **WHEN** it is written
- **THEN** it calls the shared query instead of re-reading the log

Every place that needs the status a step runs at, or settles at, SHALL read it from the shared contract. A hand-written copy of that mapping once settled implement at `completed` and skipped the user's Mark Completed gate.

#### Scenario: a record is repaired because its status is unreadable
- **WHEN** the reconciler derives a replacement status for a finished implement step
- **THEN** it derives `implemented`, leaving closure to the user

A helper that several layers need SHALL live in the layer that owns it, with no compatibility re-export from its old module. Two paths to one function keep the retired path alive.

#### Scenario: a shared helper moves to a lower layer
- **WHEN** the move lands
- **THEN** its old module no longer re-exports it, and every caller names the new home

### Status moves forward and never regresses out of a terminal state

Status transitions SHALL be forward-only. A re-run, double-fired hook, or late write for an earlier step MUST record its event in the log but leave status and current step alone once the spec has moved past that step. A spec in a terminal state MUST NOT be moved backwards by any later write.

A step on its own can carry a spec no further than "implementation finished". Only an explicit terminal step that ran SHALL write the final closed state, and no recovery, repair, or reconciliation path may infer it from disk. When a recorded status is unreadable, such a path SHALL restore the highest state a step reaches on its own and leave closing to the terminal step.

#### Scenario: a repair path meets an unreadable status
- **WHEN** it reconstructs the spec's state
- **THEN** it settles no higher than "implementation finished"
- **AND** it never writes the final closed state itself

#### Scenario: an earlier step's completion arrives late
- **WHEN** a plan-step completion is written for a spec already at tasks
- **THEN** the completion is appended to the log
- **AND** status and current step stay where they were

A project-added step has no canonical status. Recording its start or finish SHALL append the history entry and leave status unchanged, and the reconciler SHALL NOT repair a status it has nothing to repair to.

#### Scenario: a project-added step finishes
- **WHEN** its completion is recorded
- **THEN** the entry lands and the status is unchanged

### Reaching the pipeline's end is a real end state, not a bug

The Companion pipeline marks the spec complete at its last step, and this MUST NOT be treated as an error to undo. The extension's own autonomous finish (a watcher or hook noticing the work is done) SHALL stop at "implementation finished" and leave closing to the sanctioned completion path. A pipeline that ran its terminal step decided; a watcher that saw every task checked did not.

#### Scenario: a Companion run reaches its terminal step
- **WHEN** the pipeline's last step executes
- **THEN** the spec is recorded as complete
- **AND** nothing later reverts it

#### Scenario: a watcher sees every task checked
- **WHEN** it settles the spec
- **THEN** it records the implementation as finished
- **AND** it does not declare the spec closed

### Completion is observed at one seam, and observing it writes nothing

Completion SHALL be reported only by the state-file watcher, which diffs each write's status against the last known one, because every completion path flows through the state file. It fires once per transition into the closed state: a first sighting of an already-closed spec seeds the baseline silently, and re-writing the closed state is a non-event. The seam MUST write nothing and respect forward-only status, a deleted spec's baseline MUST be evicted, and no completion path may report completion on its own.

#### Scenario: a completion lands from any of the three paths
- **WHEN** the state file's status transitions into the closed state
- **THEN** exactly one completion is reported, whoever wrote it

#### Scenario: two paths act on the same spec
- **WHEN** a second write of the closed state lands after the first
- **THEN** nothing further is reported

#### Scenario: the extension starts over a workspace with closed specs
- **WHEN** the baseline is seeded from disk
- **THEN** no completion is reported for any of them

### The implementation step settles from a signal that fires in every mode

The implementation step MUST settle from the task list's file changing, because it has no successor step to close it and no dispatch surface gives a completion callback. The settle SHALL be guarded to fire exactly once and only when warranted.

#### Scenario: implementation runs through a chat surface with no terminal
- **WHEN** the last task is checked off
- **THEN** the step still settles
- **AND** the spec is not stranded mid-implementation

#### Scenario: a spec parked before implementation has a fully-checked task list
- **WHEN** the watcher fires
- **THEN** nothing settles, because implementation never started
- **AND** the spec keeps its parked position

#### Scenario: the task list is re-saved after the step already closed
- **WHEN** the watcher fires again
- **THEN** no second closing event is recorded

### A fast-path folded step is derived as folded, once

The shared step-history derivation SHALL mark a step folded when its extension-stamped step-level start/complete pair spans under one second and starts within one second of the previous step's extension-stamped close. The check anchors on the stamped pair, never the derived close. The flag is independent of duration trust, is set nowhere else, and folded steps still count as measured timing coverage.

#### Scenario: a fast-path run's history is derived
- **WHEN** plan and tasks were stamped back-to-back inside the specify run
- **THEN** their entries carry the folded marker and specify's does not

#### Scenario: a sub-second step far from the previous close
- **WHEN** a step's stamped pair spans under a second but starts minutes after the previous close
- **THEN** its entry carries no folded marker

### A step's duration is trusted from any deterministic writer, gated on writer authority

The shared step-history derivation SHALL trust a step's span when it has exactly one step-level start from a deterministic writer and an ordered close (its own step-level complete, or the next lifecycle step's start) from a writer at least as authoritative. Writers rank: instrumented (`extension`, `cli`, `derive`, `user`) above agent (`ai`), above any unrecognized writer. So a CLI-only run stamped `by:ai` is trusted, while an `ai` close over an `extension` start, or a phase with a complete but no start, claims no duration. The existing anomaly guards (single start, no completion before start, no competing later start, no cross-phase overlap) still apply, and `folded` stays defined over `extension`-stamped pairs only.

#### Scenario: a CLI-only run's history is derived
- **WHEN** every pipeline step carries an ordered `by:ai` step-level start and complete
- **THEN** all four phases count as measured timing coverage

#### Scenario: a premature agent finish over an extension start
- **WHEN** a step's start is stamped `by:extension` and an `ai` step-level complete lands right after
- **THEN** that step's duration is not trusted

## Uncovered

- All files under `__tests__/` were listed but not read.
