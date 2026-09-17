# Run Capture — Living Spec

<!-- reviewed: d589a63e -->
> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The command bodies are the only place the extension can make a run write its own record, since it dispatches text and gets no callback. Without these rules a step's work is attributed to no step, a pointer is written under a key nobody reads, or concurrent workers race on the shared record.

## Requirements

### The feature pointer is written under the exact key the capture calls read

The pointer file the first step writes SHALL name the feature directory under the one key the later capture calls resolve through when they run without an explicit feature directory. Any other key is silently dropped: the writes go nowhere and the run records nothing, with no error anywhere to notice.

#### Scenario: a later step runs without an explicit feature directory
- **WHEN** it resolves the spec through the pointer file
- **THEN** it finds the directory the first step wrote

### Commands direct capable providers to parallelize, while bookkeeping stays serialized

Where a provider can spawn workers, the bodies SHALL make concurrency the expected strategy rather than an optional optimization, and SHALL express independence structurally — waves of tasks that share no files or dependencies, with explicit join points — rather than relying on the agent to infer it from inline markers. Concurrency MUST NOT extend to the shared record: prose that fans work out MUST name who serializes the write, because "journal each as it finishes" under concurrent workers reads as a race. Hosts without workers run sequentially and produce identical artifacts.

#### Scenario: a wave of independent tasks is reached
- **WHEN** the provider supports workers
- **THEN** the wave's tasks run concurrently and the next wave waits for it

#### Scenario: the provider cannot spawn workers
- **WHEN** the same wave is reached
- **THEN** it runs sequentially with no error and the same result

### Step boundaries are extension-stamped in order on every dispatch path

Each pipeline step's start SHALL be recorded by a script call placed **above the step's extension-hooks fence**, so that hooks and every node run inside the window the step later reports; a stamp sitting partway down the body leaves that work attributed to no step at all. The instruction SHALL be single-sourced as one shared command part fenced into each step frame, never copied per command, so the four bodies cannot drift. A step that mints its own feature directory SHALL stamp the instant that directory exists and before any other work, since it has nothing to stamp against earlier. Plan/tasks completions SHALL be recorded by their after-step hook commands — both `by: extension`, start before complete. The AI SHALL self-close only clarify and analyze at step level; a step whose boundaries the extension stamps must never receive an AI step-level complete, because the idempotent completion append lets the first writer win.

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

Recording an implement task SHALL be a two-part closing action — append the finish, then fold it — executed by the MAIN agent in the foreground the moment the task's work completes. Fanned-out workers SHALL only append to the event log; the main agent folds each worker's finish as its result returns, and the wave-join and end-of-step folds are idempotent backstops, not the cadence.

#### Scenario: a wave of tasks executes
- **WHEN** each task in the wave finishes
- **THEN** the watched context file and its checkbox advance before the next task starts

#### Scenario: workers run in parallel
- **WHEN** several workers finish tasks concurrently
- **THEN** each appends only its own event-log line and the main agent alone performs every fold

## Uncovered

_None — re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
