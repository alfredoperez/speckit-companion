# Implement and Completion — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Implement and Completion is the tail of the Companion pipeline: parallel task execution with serialized bookkeeping, the single-writer terminal step, the living-spec fold at completion, and the diagnostic command that recomputes what a run claimed.

## Requirements

### Completion is an explicit terminal step with exactly one writer

The Companion pipeline ends at a dedicated completion command; the stock pipeline has no terminal step and simply stops. That command writes the terminal status through the shared writer and never by hand, refuses a spec whose work is outstanding, and is a no-op on a spec already shipped. This is the pipeline's completion gate — a second writer of that status MUST NOT be introduced anywhere.

#### Scenario: implementation finishes
- **WHEN** the terminal step runs
- **THEN** the spec is promoted to completed through the single writer
- **AND** the recorded current step stays at the last real step

#### Scenario: work remains
- **WHEN** the terminal step runs against an unfinished spec
- **THEN** it refuses and reports, without failing the host

"The work validates" SHALL mean the project's own checks ran and passed, not that the result was read against the spec. A spec MUST NOT be marked complete over a failing suite the run introduced: the failure is fixed, or the spec is left at the implemented status with the reason stated. Where the checks genuinely could not be run, that SHALL be recorded as a concern before completing, so the record says "finished, unverified" rather than implying "finished, verified". Completing on red is how a run that looks finished ships broken code, and the completed status is the one signal a reader trusts without opening anything.

A verification entry SHALL record the command that ran and its real outcome, never a restatement of intent, and a check that could not be run SHALL produce a concern and no verification entry at all — an entry for a check that never happened is worse than no entry, because every later reader trusts it.

#### Scenario: a test the run authored fails
- **WHEN** the implement step reaches its end
- **THEN** the failure is fixed before completion, or the spec stays at implemented with the reason stated

#### Scenario: the project has no runnable test script
- **WHEN** the run cannot execute its checks
- **THEN** it says so in the summary and records a concern
- **AND** it records no verification entry for the check it did not run

### Commands direct capable providers to parallelize, while bookkeeping stays serialized

Where a provider can spawn workers, the bodies SHALL make concurrency the expected strategy rather than an optional optimization, and SHALL express independence structurally — waves of tasks that share no files or dependencies, with explicit join points — rather than relying on the agent to infer it from inline markers. Concurrency MUST NOT extend to the shared record: prose that fans work out MUST name who serializes the write, because "journal each as it finishes" under concurrent workers reads as a race. Hosts without workers run sequentially and produce identical artifacts.

#### Scenario: a wave of independent tasks is reached
- **WHEN** the provider supports workers
- **THEN** the wave's tasks run concurrently and the next wave waits for it

#### Scenario: the provider cannot spawn workers
- **WHEN** the same wave is reached
- **THEN** it runs sequentially with no error and the same result

### Completion accounts for every loaded capability — a delta or an explicit skip, never silence

The completion step (both the implement-time close and the terminal `mark-complete`) instructs the AI to read `livingSpecs.loaded` and account for **every** name in it before folding — each gets exactly one of two outcomes. A loaded capability whose *behavior* the feature changed gets a marked delta block appended to the feature spec capturing the real requirement. A loaded capability merely read for context gets an explicit recorded skip (`write-context.py --living-spec-skip "<name>: <reason>"`), so "correctly nothing" stays distinguishable from "silently nothing." A loaded capability that is neither is a hole the fold flags loudly. The delta verb is chosen by whether the requirement's heading already exists in that capability's living spec: a heading not already there goes under `## ADDED Requirements` even when it revises the same behavior area, and `## MODIFIED Requirements` is reserved for editing the body of a heading that already matches one in the living spec.

#### Scenario: a feature changed a loaded capability

- **WHEN** the feature loaded a capability and changed its behavior
- **THEN** the completion step authors a delta block marked for that capability, and the fold writes the requirement into that capability's spec

#### Scenario: a capability was read but not changed

- **WHEN** the feature loaded a capability but did not change its behavior
- **THEN** an explicit skip is recorded for it, not silence, and its spec is left untouched

#### Scenario: a loaded capability is left unaccounted

- **WHEN** a name in `livingSpecs.loaded` gets neither a delta block nor a recorded skip
- **THEN** the fold flags it loudly as a hole

### Task finishes are folded into the shared record one at a time, as they land

Recording an implement task SHALL be a two-part closing action — append the finish, then fold it — executed by the MAIN agent in the foreground the moment the task's work completes. Fanned-out workers SHALL only append to the event log; the main agent folds each worker's finish as its result returns, and the wave-join and end-of-step folds are idempotent backstops, not the cadence.

#### Scenario: a wave of tasks executes
- **WHEN** each task in the wave finishes
- **THEN** the watched context file and its checkbox advance before the next task starts

#### Scenario: workers run in parallel
- **WHEN** several workers finish tasks concurrently
- **THEN** each appends only its own event-log line and the main agent alone performs every fold

### A diagnostic command recomputes reality rather than trusting what a run recorded
<!-- touches: speckit-extension/commands/speckit.companion.doctor.md -->

Where a command reports on the health of a run, it MUST derive its answer by recomputing, never by reading back a verdict the run recorded about itself — a run that claimed it was clean is precisely the case worth checking. Such a command SHALL be read-only, SHALL always exit successfully, and SHALL isolate each of its checks so that one failing becomes that check's stated skip reason rather than taking the report down. It MUST report, for every check it knows about, whether that check ran, was skipped with a reason, or did not apply, so that "found nothing" and "could not look" can never print the same way. Its core checks MUST derive from the durable record and the on-disk documents alone, so that it produces a meaningful verdict on a run that finished long before the command existed.

#### Scenario: a recorded claim contradicts the recomputation
- **WHEN** a run recorded that an area was clean and recomputing finds otherwise
- **THEN** the contradiction is reported as a false claim, showing both sides

#### Scenario: a check cannot run
- **WHEN** the input a check needs is missing
- **THEN** it is reported as skipped with the reason, never as clean

Where the build has recorded what a run of this pipeline must produce, the command SHALL also hold the run to that record and report a step that closed without a document it declared. That finding is a warning rather than a gate, because the record describes the pipeline as it is built today while the spec on disk may have been produced by an earlier one, and a step that produced none of the declared documents SHALL be read as a run of some other pipeline and reported as no record rather than as a fault.

#### Scenario: a step closed without the document its node declares
- **WHEN** the command compares what the build recorded against the spec on disk
- **THEN** the missing document is reported as a warning naming the step and the node that writes it
- **AND** a step that produced none of the declared documents is reported as no record rather than a fault
