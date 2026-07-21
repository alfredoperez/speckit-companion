# Feature Specification: Live per-task progress and trustable step durations

**Feature Branch**: `509-timing-capture`
**Created**: 2026-07-21
**Status**: Draft
**Input**: GitHub issue #509 — implement timing capture: live per-task progress + trustable step durations (only 1 of 4 phases measured)

## User Scenarios & Testing

### User Story 1 - The panel advances as each task lands (Priority: P1)

A developer watches the Companion panel while the AI implements a spec. Today the progress bar sits at 0 for the whole step and then jumps in one or two bursts, because per-task finishes only reach the watched files when the AI folds them "once per wave". The developer should see the count tick up task by task, as each task actually finishes.

**Why this priority**: Live progress is the panel's core promise; a frozen bar that jumps at the end reads as a hang.

**Independent Test**: Run an implement step with 10+ tasks and watch the panel — the task count must advance one at a time, not in end-of-wave bursts.

**Acceptance Scenarios**:

1. **Given** an implement run in progress, **When** the main agent finishes a task, **Then** the task's finish is folded into the watched context file and its checkbox is checked before the next task starts.
2. **Given** a wave whose tasks were fanned out to parallel workers, **When** each worker's finish lands, **Then** workers only append to the sidecar log and the main agent alone folds each finish into the shared files, one at a time, in the foreground.
3. **Given** the completed run's event log, **When** the capture eval measures finish cadence, **Then** the per-task finishes span the step's real duration instead of clustering into a tiny end-of-step window.

### User Story 2 - Every phase shows a real, trusted duration (Priority: P1)

A developer opens a finished spec and reads the timing panel. Today it says "Timing coverage: 1 of 4" — only implement carries a trusted span, because plan and tasks get their extension-stamped start written *after* their completion (the hook fires after the AI's self-close), and that inverted order poisons specify's boundary too. After the fix, all four phases show a trusted duration.

**Why this priority**: Untrusted timing makes the whole timing feature pointless — one measured phase out of four is noise, not signal.

**Independent Test**: Run the full pipeline on a spec and derive its step history — specify, plan, tasks, and implement must each have an extension-stamped start that precedes an extension-stamped close.

**Acceptance Scenarios**:

1. **Given** a plan or tasks step beginning, **When** the command body starts its work, **Then** a script-stamped start entry (`by: extension`) is recorded before any of the step's work runs.
2. **Given** a plan or tasks step finishing, **When** the step's after-hook fires, **Then** it records the step's completion (`by: extension`) — not a start — so the boundaries land in start-then-complete order.
3. **Given** a spec produced by the fixed pipeline, **When** the viewer derives step history, **Then** specify, plan, tasks, and implement are all duration-trusted and the timing summary reads 4 of 4.
4. **Given** a legacy spec whose plan completion precedes its start (the old inverted order), **When** step history is derived, **Then** that span stays untrusted — old dishonest data is never retroactively trusted.

### User Story 3 - The instructions agree everywhere they are stated (Priority: P2)

The capture cadence rules live in the shared timing part (assembled into every Companion command body) and are mirrored in the GUI dispatch preamble. Both surfaces must state the same per-task cadence and the same self-close set, and the parity gate must keep them from forking.

**Why this priority**: A forked instruction is how the last cadence bug shipped; parity is the guard.

**Independent Test**: The shape-parity check passes and the re-blessed goldens carry the new cadence text in every assembled body.

**Acceptance Scenarios**:

1. **Given** the timing part is edited, **When** the command bodies are reassembled, **Then** every assembled body carries the new cadence and the golden baseline is re-blessed to match.
2. **Given** the GUI preamble's per-task instruction, **When** compared with the timing part, **Then** both name the main agent as the one serializing writer and both instruct per-task folding.

## Edge Cases

- A parallel worker finishes while the main agent is folding another task's finish: the worker only appends to the sidecar, so there is no concurrent read-modify-write on the shared file.
- The after-plan/after-tasks hook never fires (unparseable extensions file): the step still has its script-stamped start, and the next step's start closes the span — the duration stays trusted.
- A step is re-run on a spec that already moved past it: the forward-only guard keeps status from regressing, and the idempotent completion append never doubles.
- A stock (non-Companion) run: the stock preamble's self-close model is unchanged; stock timing stays best-effort as documented.
- Legacy specs recorded under the old order: derivation must keep rejecting their inverted spans rather than trusting them retroactively.
- The AI still self-closes clarify/analyze (no hooks exist for them): those remain finish-only, `by: ai`, untrusted for duration — unchanged.

## Requirements

### Functional Requirements

- **FR-001**: The implement instructions MUST tell the main agent to fold each task's finish into the shared context file (and its checkbox) the moment that task completes — one task at a time, in the foreground — instead of once per wave.
- **FR-002**: The instructions MUST keep parallel workers append-only: only the main agent runs the fold, so there is never more than one writer of the shared files.
- **FR-003**: The plan and tasks command bodies MUST record a script-stamped, extension-attributed start entry at the beginning of their work, matching what specify and implement already do.
- **FR-004**: The after-plan and after-tasks hook commands MUST record the step's completion (extension-attributed) instead of a start, so both boundaries are extension-stamped and in order.
- **FR-005**: The shared timing part MUST stop instructing the AI to self-close plan and tasks at step level; clarify and analyze keep their self-close (no hooks close them). Substep finishes are unchanged.
- **FR-006**: The GUI dispatch preamble MUST mirror the same cadence: per-task folding by the main agent, and a self-close set consistent with the hooks owning plan/tasks closure on Companion runs.
- **FR-007**: Step-history derivation MUST mark specify, plan, tasks, and implement duration-trusted for a run captured in the new order, and MUST keep legacy inverted-order spans untrusted; tests MUST cover both.
- **FR-008**: All assembled command bodies, the golden baseline, and the shape-parity gate MUST agree after the change (re-blessed deliberately, not silently).
- **FR-009**: The capture documentation MUST describe the new cadence and boundary-ownership model so the flow is not re-derived from code.

## Success Criteria

### Measurable Outcomes

- **SC-001**: On a pipeline run captured after the fix, the derived timing summary reports 4 of 4 phases measured.
- **SC-002**: During an implement step, the watched context file gains each task's finish before the next task starts — no multi-task burst at wave end from the main agent's own work.
- **SC-003**: The shape-parity check and the golden baseline pass, and the full test suite passes.
- **SC-004**: A legacy spec with inverted plan boundaries still derives as untrusted (regression test passes).

## Assumptions

- Stock-family runs (non-Companion commands) keep their existing best-effort timing model; this change scopes trusted durations to the Companion pipeline, where hooks exist to stamp the close.
- The per-task fold's extra script call per task is an acceptable cost — it is one read-modify-write of a small JSON file, far cheaper than the task's own work.
- The hook-fires-late risk (hook completion stamped a few seconds after the step's true end) is acceptable: the close is still after the start and near the true end, unlike today's start-after-complete inversion.

## ADDED Requirements
<!-- capability: companion-commands -->

### Step boundaries are extension-stamped in order on every dispatch path

Each pipeline step's start SHALL be recorded by a script call at the top of the step's own command body, and plan/tasks completions SHALL be recorded by their after-step hook commands — both `by: extension`, start before complete. The AI SHALL self-close only clarify and analyze at step level; a step whose boundaries the extension stamps must never receive an AI step-level complete, because the idempotent completion append lets the first writer win.

#### Scenario: plan runs on any dispatcher
- **WHEN** the plan command body begins its work
- **THEN** a script-stamped extension start is recorded before any planning output
- **AND** the after-plan hook later records the extension-stamped completion

#### Scenario: a step's hook never fires
- **WHEN** the after-step hook is skipped (missing or unparseable extensions registry)
- **THEN** the next step's extension start still closes the span and the duration stays trusted

### Task finishes are folded into the shared record one at a time, as they land

Recording an implement task SHALL be a two-part closing action — append the finish, then fold it — executed by the MAIN agent in the foreground the moment the task's work completes. Fanned-out workers SHALL only append to the event log; the main agent folds each worker's finish as its result returns, and the wave-join and end-of-step folds are idempotent backstops, not the cadence.

#### Scenario: a wave of tasks executes
- **WHEN** each task in the wave finishes
- **THEN** the watched context file and its checkbox advance before the next task starts

#### Scenario: workers run in parallel
- **WHEN** several workers finish tasks concurrently
- **THEN** each appends only its own event-log line and the main agent alone performs every fold

## ADDED Requirements
<!-- capability: ai-providers -->

### The dispatch preamble names the main agent as the per-task serializing writer

The implement preamble SHALL instruct that per-task journaling is performed by the main agent — one task at a time, in the foreground, including tasks whose work was fanned out — and that workers never write the shared context file. The slim companion preamble SHALL describe step closure as extension-stamped (bodies record starts, hooks and scripts record completes), reserving AI self-close for clarify/analyze.

#### Scenario: implement is dispatched with the full preamble
- **WHEN** the AI fans tasks out to workers
- **THEN** the preamble directs the main agent to journal each returned task itself, serially

#### Scenario: a companion command is dispatched
- **WHEN** the slim preamble is rendered
- **THEN** it defers step closure to the body-and-hook model and never asks the AI to self-close plan or tasks
