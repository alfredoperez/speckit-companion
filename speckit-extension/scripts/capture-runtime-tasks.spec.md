# Capture runtime tasks — Living Spec

> [DRAFT] Re-adopted on 2026-09-07 from the single capture-runtime living spec, requirements moved verbatim, every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Per-task progress is written by many workers at once and read back as a checklist and a timeline. This concern keeps the journal contention-free and the checklist derived from it, so the two never disagree.

## Requirements

### Per-task progress is finish-only, contention-free, and folded idempotently

A task records a single finish, never a start/finish pair stamped at one instant — a pair produces zero-length ticks and hides real cadence, so each task's duration is the gap to the previous finish. Finishes are appended as single lines to a separate event log rather than read-modify-written into the shared context, so concurrent workers never contend and the hot loop never stalls. Those lines are folded into the durable record through the same code path a live write would take, so folding is byte-equivalent to inline journaling and re-folding the whole log never double-counts.

#### Scenario: several workers finish at once
- **WHEN** parallel workers each record a task finish simultaneously
- **THEN** every finish lands and none corrupts the shared context

#### Scenario: the log is folded more than once
- **WHEN** the same event log is folded repeatedly
- **THEN** the durable record is unchanged after the first fold

#### Scenario: the append log is garbage-collected
- **WHEN** the spec reaches its terminal state
- **THEN** pending lines are folded first and only then is the log removed
- **AND** the terminal state prevents the log from being recreated

### Derived artifacts have exactly one writer

Anything computed from the journal — most visibly the task checklist's checkboxes — SHALL be written by one place, derived from the event record, and never hand-edited by the agent doing the work. Two producers of the same fact will disagree eventually; making the checklist *derived* rather than a second source of truth is what keeps the file and the record from diverging. Task-marker parsing MUST accept every marker format the shipped command families emit, since a format the parser silently misses produces no journal at all and strands the step.

#### Scenario: a task is completed by a fanned-out worker
- **WHEN** a worker finishes its task
- **THEN** it records only its finish
- **AND** the checkbox is flipped later by the single derivation pass

The task grammar SHALL match the extension's, cover every bullet character, ignore a checkbox inside a fenced block or a code span, and require a task id. Both halves decide the same question — whether every task is done — from opposite sides of the product, so they SHALL be pinned to one shared fixture read by both test suites. A checkbox shown inside a fence is documentation of the syntax; counting it here reported a task list finished while the viewer, which has always skipped fences, still showed tasks left.

#### Scenario: a task document shows example syntax inside a fence
- **WHEN** the two halves each count its tasks
- **THEN** both skip the fenced example and reach the same count

### A call count may shrink only when the record it produces stays identical

Reducing the number of calls a step makes is worth doing — the two-call task close and the six-call end-of-step volley are both mostly ceremony — but a shorter path that records something different is a regression disguised as an optimization. A merged form MUST therefore produce a record byte-equivalent to the sequence it replaces, MUST remain idempotent for the same reason the sequence was, and MUST NOT remove the caller's ability to perform the steps separately where the split exists for a reason: only the main agent may fold, so a merged close that folds is for the main agent alone and a fanned-out worker keeps appending on its own.

#### Scenario: a task is closed in one call instead of two
- **WHEN** the merged close runs
- **THEN** the resulting record equals what appending and then folding produced

#### Scenario: a worker uses the merged close
- **WHEN** concurrent workers would each fold
- **THEN** the merged form is documented and reserved for the single serializing agent

## Uncovered

- The Python test suite under `speckit-extension/tests/` was not read.
