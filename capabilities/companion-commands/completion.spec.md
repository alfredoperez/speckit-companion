# Run Completion — Living Spec

<!-- reviewed: d589a63e -->

## Purpose

A Companion run ends at one terminal step that marks a spec complete only over checks that really ran, and a diagnostic recomputes a run's health instead of trusting it.

## Requirements

### Completion is an explicit terminal step with exactly one writer

The Companion pipeline SHALL end at a completion step that promotes the spec to completed through the shared status writer, and no other path SHALL write that status. The stock pipeline has no terminal step.

#### Scenario: implementation finishes
- **WHEN** the terminal step runs
- **THEN** the spec is completed through the single writer
- **AND** the recorded current step stays at implement

#### Scenario: work remains
- **WHEN** the terminal step runs against a spec with open tasks
- **THEN** it refuses and reports, without failing the host

### A spec is never marked complete over a failing check the run introduced

"The work validates" SHALL mean the project's own checks ran and passed. When a check the run introduced fails, it is fixed, or the spec stays at implemented with the reason stated.

#### Scenario: a test the run authored fails
- **WHEN** implement reaches its end
- **THEN** the failure is fixed before completion, or the spec stays at implemented and the summary says why

### A check that could not run is recorded as a concern, never as a verification

A check the run could not execute SHALL be recorded as a concern naming what was skipped and why, with no verification entry for it, because readers trust the completed status without opening anything.

#### Scenario: the project has no runnable test script
- **WHEN** the run cannot execute its checks
- **THEN** the summary says so, a concern is recorded, and no verification entry claims the check

### Completion accounts for every loaded capability with a delta or a recorded skip

Before folding, both implement's close and the completion command SHALL give every loaded capability exactly one outcome: a delta block when its behaviour changed, or a recorded skip with a reason when it was only read.

#### Scenario: a feature changed a loaded capability
- **WHEN** completion runs
- **THEN** a delta block marked for that capability is written and the fold lands it in that capability's spec

#### Scenario: a capability was read but not changed
- **WHEN** completion runs
- **THEN** a skip with its reason is recorded and the capability's spec is untouched

### The tasks Polish phase validates the spec's Success Criteria in exactly one place

The Polish phase SHALL generate a task that runs the project's suites against the Success Criteria, unless a post-implement hook in the project's configuration carries `owns: validation`, in which case it defers to that hook. An unmarked hook does not defer, because review, PR and deploy hooks share the same anchor.

#### Scenario: a project marks a hook as owning validation
- **WHEN** tasks builds the Polish phase
- **THEN** the validation task defers to that hook and no second suite run is generated

#### Scenario: no hook carries the marker
- **WHEN** tasks builds the Polish phase with only unmarked hooks, none, or an unreadable configuration
- **THEN** Polish generates and owns the suite run

### A diagnostic command recomputes reality rather than trusting what a run recorded
<!-- touches: speckit-extension/commands/speckit.companion.doctor.md -->

The doctor MUST recompute each answer from the durable record and the spec's documents, never read back a verdict the run recorded, so it also works on runs older than the command.

#### Scenario: a recorded claim contradicts the recomputation
- **WHEN** a run recorded an area as clean and recomputing finds otherwise
- **THEN** the contradiction is reported as a false claim, showing both sides

### Every doctor check reports ran, skipped with a reason, or not applicable
<!-- touches: speckit-extension/commands/speckit.companion.doctor.md -->

A check that cannot run SHALL be reported as skipped with its reason, never as clean, and a check that crashes becomes that check's skip while the rest still run.

#### Scenario: a check's input is missing
- **WHEN** the doctor runs
- **THEN** that check is listed as skipped with the reason, and the others report normally

### The doctor is read-only and never halts
<!-- touches: speckit-extension/commands/speckit.companion.doctor.md -->

The doctor SHALL create, modify and delete nothing, and always exit successfully.

#### Scenario: the doctor finds problems
- **WHEN** it reports warnings
- **THEN** it exits successfully and the spec's files and record are unchanged

## Uncovered

_None._
