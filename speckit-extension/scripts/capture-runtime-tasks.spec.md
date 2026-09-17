# Capture runtime tasks — Living Spec

> [DRAFT] Re-adopted on 2026-09-07 from the single capture-runtime living spec, requirements moved verbatim, every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Many workers write per-task progress at once, and it is read back as a checklist and a timeline. These rules keep the journal contention-free and the checklist derived from it, so the two never disagree.

## Requirements

### Per-task progress is finish-only, contention-free, and folded idempotently

A task records a single finish, never a start/finish pair, and its duration is the gap to the previous finish. Finishes are appended as single lines to a separate event log, not read-modify-written into the shared context, so concurrent workers never contend. Folding those lines into the durable record uses the same code path as a live write, so it is byte-equivalent to inline journaling and re-folding never double-counts.

#### Scenario: several workers finish at once
- **WHEN** parallel workers each record a task finish at the same time
- **THEN** every finish lands and none corrupts the shared context

#### Scenario: the log is folded more than once
- **WHEN** the same event log is folded repeatedly
- **THEN** the durable record is unchanged after the first fold

#### Scenario: the append log is garbage-collected
- **WHEN** the spec reaches its terminal state
- **THEN** pending lines are folded first and only then is the log removed
- **AND** the terminal state prevents the log from being recreated

### Derived artifacts have exactly one writer

Anything computed from the journal, such as the task checklist's checkboxes, SHALL be written by one place from the event record and never hand-edited by the working agent. Task-marker parsing MUST accept every marker format the shipped command families emit, since a missed format produces no journal and strands the step.

#### Scenario: a task is completed by a fanned-out worker
- **WHEN** a worker finishes its task
- **THEN** it records only its finish
- **AND** the single derivation pass flips the checkbox later

The task grammar SHALL match the extension's: every bullet character, no checkbox inside a fenced block or code span, and a required task id. Both halves SHALL be pinned to one shared fixture read by both test suites, so they agree on whether every task is done.

#### Scenario: a task document shows example syntax inside a fence
- **WHEN** the two halves each count its tasks
- **THEN** both skip the fenced example and reach the same count

### A call count may shrink only when the record it produces stays identical

A merged form that replaces a call sequence MUST produce a byte-equivalent record and MUST stay idempotent. It MUST NOT remove the ability to run the steps separately where the split has a reason: only the main agent may fold, so a merged close that folds is reserved for the main agent and fanned-out workers keep appending on their own.

#### Scenario: a task is closed in one call instead of two
- **WHEN** the merged close runs
- **THEN** the record equals what appending and then folding produced

#### Scenario: a worker uses the merged close
- **WHEN** concurrent workers would each fold
- **THEN** the merged form is documented and reserved for the single serializing agent

## Uncovered

- The Python test suite under `speckit-extension/tests/` was not read.
