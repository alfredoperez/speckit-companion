# Capture Writes — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How a run's facts reach the record: timing stamped by a script, additive capture that composes, and per-task finishes journaled contention-free and folded once.

## Requirements

### Timing is stamped by a script, never hand-authored

Durations are only meaningful if a clock produced them. Every timing entry SHALL be written by running a writer script that reads the real clock at write time; no caller — human or AI — writes timing into the context by editing the file. This is the runtime's central reliability lever: running a command is something an AI does faithfully, while pausing mid-work to hand-author a timestamped JSON entry is not. It is also what keeps the file structurally valid, since hand-editing is what corrupted it in practice.

#### Scenario: a step's work finishes
- **WHEN** the step's own work ends and its completion must be recorded
- **THEN** the writer script is invoked and stamps the entry from its own clock

#### Scenario: an entry is de-duplicated
- **WHEN** the same step completion is recorded twice
- **THEN** history carries it once

### Additive capture composes; lifecycle modes are exclusive

The runtime distinguishes two kinds of write. Additive capture — decisions, verifications, concerns, expectations, requirement coverage, step summaries, size classification — SHALL all take effect when passed together, each reporting itself, because they are independent facts about the same run. Lifecycle modes are alternative readings of one invocation and MUST stay first-match-wins. When a capture flag accompanies a lifecycle flag, the lifecycle write is skipped and named on stderr rather than half-performed. All additive capture is de-duplicated on its identity value, so re-running a command never doubles up.

#### Scenario: several capture facts arrive in one call
- **WHEN** a caller records a decision, a verification, and a summary together
- **THEN** all three are stored

#### Scenario: capture and a lifecycle transition are mixed
- **WHEN** a completion flag and a capture flag arrive in one call
- **THEN** the capture is applied and the skipped lifecycle write is reported

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

- `derive-from-files.py` — read its docstring only.
