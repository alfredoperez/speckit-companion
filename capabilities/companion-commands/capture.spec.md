# Run Capture — Living Spec

<!-- reviewed: d589a63e -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Command bodies are the only place a run can be made to write its own record, since the extension dispatches text and gets no callback. These rules keep work attributed to its step, pointers under the key readers use, and the shared record free of races.

## Requirements

### The feature pointer is written under the exact key the capture calls read

The pointer file the first step writes SHALL name the feature directory under the one key later capture calls resolve when run without an explicit feature directory. Any other key is silently dropped and the run records nothing.

#### Scenario: a later step runs without an explicit feature directory
- **WHEN** it resolves the spec through the pointer file
- **THEN** it finds the directory the first step wrote

### Commands direct capable providers to parallelize, while bookkeeping stays serialized

Where a provider can spawn workers, the bodies SHALL make concurrency the expected strategy and express independence structurally, as waves of tasks sharing no files or dependencies with explicit join points, not as inline markers. Concurrency MUST NOT extend to the shared record: prose that fans work out MUST name who serializes the write. Hosts without workers run sequentially and produce identical artifacts.

#### Scenario: a wave of independent tasks is reached
- **WHEN** the provider supports workers
- **THEN** the wave's tasks run concurrently and the next wave waits for it

#### Scenario: the provider cannot spawn workers
- **WHEN** the same wave is reached
- **THEN** it runs sequentially with no error and the same result

### Step boundaries are extension-stamped in order on every dispatch path

Each step's start SHALL be stamped by a script call above the step's extension-hooks fence, so hooks and every node fall inside the step's window, and that instruction SHALL be one shared part fenced into each step frame. A step that mints its own feature directory SHALL stamp as soon as the directory exists, before any other work. Plan and tasks completions SHALL be recorded by their after-step hooks, both `by: extension`, start before complete, and the AI SHALL self-close only clarify and analyze at step level, because the first completion written wins.

#### Scenario: plan runs on any dispatcher
- **WHEN** the plan command body begins its work
- **THEN** a script-stamped extension start is recorded before any planning output
- **AND** the after-plan hook later records the extension-stamped completion

#### Scenario: a step's hook never fires
- **WHEN** the after-step hook is skipped (missing or unparseable extensions registry)
- **THEN** the next step's extension start still closes the span and the duration stays trusted

#### Scenario: the extension already seeded this step's start
- **WHEN** the command body's own stamp runs after a dispatcher already recorded the step's start
- **THEN** no second start entry is appended and the earlier timestamp stands

### Task finishes are folded into the shared record one at a time, as they land

The main agent SHALL record each implement task in the foreground the moment its work completes, by appending the finish and then folding it. Fanned-out workers SHALL only append to the event log, and the main agent folds each worker's finish as its result returns. The wave-join and end-of-step folds are idempotent backstops, not the cadence.

#### Scenario: a wave of tasks executes
- **WHEN** each task in the wave finishes
- **THEN** the watched context file and its checkbox advance before the next task starts

#### Scenario: workers run in parallel
- **WHEN** several workers finish tasks concurrently
- **THEN** each appends only its own event-log line and the main agent alone performs every fold

## Uncovered

_None. Re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
