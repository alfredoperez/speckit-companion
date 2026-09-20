# Run Capture — Living Spec

<!-- reviewed: d589a63e -->

## Purpose

The extension dispatches text and gets no callback, so command bodies are the only place a run can record itself. These rules keep each step's work inside its recorded window and the shared record free of races.

## Requirements

### The feature pointer is written under the exact key the capture calls read
<!-- touches: apps/speckit-extension/nodes/specify/resolve-dir.md, apps/speckit-extension/nodes/specify/resolve-dir-git.md, apps/speckit-extension/nodes/auto/resolve-dir.md -->

The pointer the first step writes SHALL name the feature directory under a key the capture scripts resolve, so every later call made without an explicit feature directory lands on this spec.

#### Scenario: a later step runs without an explicit feature directory
- **WHEN** it resolves the spec through the pointer file
- **THEN** it finds the directory the first step wrote

### A step stamps its start before its hooks and nodes run
<!-- touches: apps/speckit-extension/presets/_parts/step-start.md -->

Each step's start SHALL be recorded by a script call ahead of its extension hooks and every node, so the whole step falls inside its window. A step that creates the feature directory SHALL stamp the moment the directory exists, never against the pointer's previous spec.

#### Scenario: plan begins
- **WHEN** the plan body starts
- **THEN** an extension-stamped start is recorded before any hook or planning output

#### Scenario: a fresh specify run
- **WHEN** the pointer still names the previous spec
- **THEN** no start is written until the new directory exists, and the previous spec's record is untouched

#### Scenario: the dispatcher already seeded the start
- **WHEN** the body's own stamp runs
- **THEN** no second start is appended and the earlier timestamp stands

### A step closes itself even when its after-hook never runs
<!-- touches: apps/speckit-extension/presets/_parts/timing.md -->

Every step except implement SHALL end by recording its own completion through an idempotent, first-writer-wins call, so a hook that was printed rather than dispatched still leaves the step closed. Clarify and analyze record a boundary without moving the status, and no step writes the next step's start.

#### Scenario: the after-plan hook is skipped
- **WHEN** plan finishes
- **THEN** plan's own close records the completion and the status advances

#### Scenario: the after-hook already closed the step
- **WHEN** the step's own close runs
- **THEN** nothing new is recorded

### Task finishes are folded into the shared record one at a time, as they land
<!-- touches: apps/speckit-extension/presets/_parts/timing.md -->

The main agent SHALL close each implement task the moment its work completes, not in a batch afterwards, so the panel and the task's checkbox advance as the run goes. The wave-join and end-of-step folds are backstops, not the cadence.

#### Scenario: a wave of tasks executes inline
- **WHEN** each task finishes
- **THEN** the context file and its checkbox advance before the next task starts

### Workers only append; the main agent does every fold
<!-- touches: apps/speckit-extension/presets/_parts/timing.md, apps/speckit-extension/nodes/implement/implement-exec.md -->

A fanned-out worker SHALL record its finish by appending one event-log line, and only the main agent folds, one returned result at a time, because a fold is a read-modify-write that concurrent writers would corrupt. Any prose that fans work out MUST name the main agent as the writer.

#### Scenario: workers finish at the same moment
- **WHEN** several workers record finishes concurrently
- **THEN** each appends only its own line and every finish reaches the record through the main agent's folds

### A host that cannot spawn workers produces the same artifacts sequentially
<!-- touches: apps/speckit-extension/nodes/plan/gather-context.md, apps/speckit-extension/nodes/plan/side-files.md, apps/speckit-extension/nodes/implement/implement-exec.md -->

Commands SHALL express parallel work as waves of independent tasks with explicit joins, so a host without workers runs the same waves in order with no error.

#### Scenario: the provider cannot spawn workers
- **WHEN** a wave of independent tasks is reached
- **THEN** it runs sequentially and produces the same result a parallel run would

## Uncovered

_None._
