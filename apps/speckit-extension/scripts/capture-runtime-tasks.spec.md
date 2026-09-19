# Capture runtime tasks — Living Spec

## Purpose

Many workers record task progress at once, and it is read back as a checklist and a timeline. These rules keep the journal contention-free and the checklist derived from it, so the two never disagree.

## Requirements

### Concurrent task finishes all land

A task records a single finish, appended as one line to its own event log instead of rewriting the shared context.

#### Scenario: several workers finish at once
- **WHEN** parallel workers each record a task finish at the same time
- **THEN** every finish lands and the shared context stays readable

### Folding the task log twice changes nothing

A fold records exactly what an inline write would have.

#### Scenario: the log is folded more than once
- **WHEN** the same event log is folded repeatedly
- **THEN** the durable record is unchanged after the first fold

### The task log is folded before it is removed

#### Scenario: the spec reaches its terminal state
- **WHEN** the log is cleaned up
- **THEN** pending lines are folded first, the log is removed, and nothing recreates it

### Task checkboxes are flipped only by the derivation pass

The working agent never hand-edits them.

#### Scenario: a task is completed by a fanned-out worker
- **WHEN** a worker finishes its task
- **THEN** it records only its finish, and the derivation pass flips the checkbox later

### Task-marker parsing accepts every format the shipped commands emit

A missed format produces no journal and strands the step.

#### Scenario: a companion command and a stock command mark tasks differently
- **WHEN** each records a task finish
- **THEN** both are journaled

### The runtime and the extension count tasks the same way

Both follow one grammar: any bullet character, a required task id, and no checkbox inside a fenced block or code span. One shared fixture pins both test suites.

#### Scenario: a task document shows example syntax inside a fence
- **WHEN** the two halves each count its tasks
- **THEN** both skip the fenced example and reach the same count

### A one-call task close records the same as appending then folding

#### Scenario: a task is closed in one call instead of two
- **WHEN** the merged close runs
- **THEN** the record equals what appending and then folding produced

### A fanned-out worker can still append a finish without folding

Only the main agent folds, so the separate append stays available for workers.

#### Scenario: a worker finishes a task during fan-out
- **WHEN** it records the finish with the append-only call
- **THEN** the finish lands in the event log and nothing is folded
