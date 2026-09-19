# Specs Lifecycle — Living Spec

<!-- reviewed: a9c0b02b -->

## Purpose

Decides what a spec's recorded events mean: its status, current step, when a step is done, and when the spec is complete, derived once so every surface agrees.

## Requirements

### One fact has exactly one derivation

A step's start and end, whether it is complete, and a spec's effective status SHALL each be derived once and read by every surface, so no two surfaces can show the same step in different states.

#### Scenario: the sidebar and the viewer both show a step's state
- **WHEN** each renders the same step of the same spec
- **THEN** both show the same state

### Status moves forward and never regresses out of a terminal state

Status and current step SHALL only move forward. A re-run, a double-fired hook or a late write for a step the spec has already passed SHALL be appended to the log and leave status and current step alone, and nothing moves a spec out of a terminal state.

#### Scenario: an earlier step's completion arrives late
- **WHEN** a plan completion is written for a spec already at tasks
- **THEN** the completion is appended to the log
- **AND** status and current step stay where they were

### Only a terminal step that ran closes a spec

A step on its own SHALL carry a spec no further than "implemented". Only an explicit terminal step that ran writes the closed state. A watcher, repair or reconciliation path never infers it, and when a recorded status is unreadable it restores no higher than "implemented".

#### Scenario: a watcher sees every task checked
- **WHEN** it settles the spec
- **THEN** it records the implementation as finished and does not close the spec

#### Scenario: a repair path meets an unreadable status after implement finished
- **WHEN** it reconstructs the spec's state
- **THEN** it settles at `implemented`, leaving closure to the user

#### Scenario: a Companion run reaches its terminal step
- **WHEN** the pipeline's last step executes
- **THEN** the spec is recorded as complete and no later write reverts it

### A project-added step leaves status unchanged

A step the project added has no canonical status. Recording its start or finish SHALL append the history entry and leave status as it was, and the reconciler does not try to repair it.

#### Scenario: a project-added step finishes
- **WHEN** its completion is recorded
- **THEN** the entry lands and the status is unchanged

### Completion is reported exactly once per transition into the closed state

A `spec.completed` event SHALL be reported once each time a spec's recorded status moves into the closed state, whichever path wrote it. Re-writing the closed state, or first seeing a spec that was already closed, reports nothing.

#### Scenario: a completion lands from any path
- **WHEN** the state file's status transitions into the closed state
- **THEN** exactly one completion is reported

#### Scenario: two paths close the same spec
- **WHEN** a second write of the closed state lands after the first
- **THEN** nothing further is reported

#### Scenario: the extension starts over a workspace with closed specs
- **WHEN** it first reads their records
- **THEN** no completion is reported for any of them

### The implementation step settles when its last task is checked, in every mode

The implementation step SHALL settle once when the task list shows every task checked, because it has no successor step to close it and chat surfaces give no completion callback.

#### Scenario: implementation runs through a chat surface with no terminal
- **WHEN** the last task is checked off
- **THEN** the step settles and the spec is not stranded mid-implementation

#### Scenario: a spec parked before implementation has a fully checked task list
- **WHEN** the task list changes
- **THEN** nothing settles, because implementation never started

#### Scenario: the task list is re-saved after the step already closed
- **WHEN** the task list changes again
- **THEN** no second closing event is recorded

### A fast-path folded step is derived as folded, once

A step SHALL be marked folded when its extension-stamped start and complete are under one second apart and it starts within one second of the previous step's extension-stamped close. A folded step still counts as measured timing.

#### Scenario: a fast-path run's history is derived
- **WHEN** plan and tasks were stamped back-to-back inside the specify run
- **THEN** their entries are marked folded and specify's is not

#### Scenario: a sub-second step far from the previous close
- **WHEN** a step's stamped pair spans under a second but starts minutes after the previous close
- **THEN** its entry is not marked folded

### A step's duration is trusted from any deterministic writer, gated on writer authority

A step's duration SHALL be trusted when it has exactly one start and an ordered close from a writer at least as authoritative as the start's. Instrumented writers (`extension`, `cli`, `derive`, `user`) rank above the agent (`ai`), which ranks above any unrecognized writer. A step with a close but no start claims no duration.

#### Scenario: a CLI-only run's history is derived
- **WHEN** every pipeline step carries an ordered `by:ai` start and complete
- **THEN** all four phases count as measured timing

#### Scenario: a premature agent finish over an extension start
- **WHEN** a step's start is stamped `by:extension` and an `ai` complete lands right after
- **THEN** that step's duration is not trusted

## Uncovered

- All files under `__tests__/` were listed but not read.
