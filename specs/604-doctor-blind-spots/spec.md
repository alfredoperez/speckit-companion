# Feature Specification: The health check reports what it cannot currently see

**Issue**: [#622](https://github.com/alfredoperez/speckit-companion/issues/622) — "The health check misses the failures it was built to catch"
**Branch**: `604-doctor-blind-spots`
**Created**: 2026-09-05

## Context

Issue #622 catalogued fourteen ways the run health check reported "0 problems" on runs that had silently lost data. Nine of them have since been fixed across #623, #628, #630 and #650, and each was re-verified against `main` before this spec was written. This feature covers **only what still reproduces**.

Three blind spots remain, plus one item that stays deliberately out of scope.

## User Scenarios & Testing

### User Story 1 - A run that could not write its trace at all still leaves evidence (Priority: P1)

A developer finishes a run in a directory the pipeline cannot write to. Some captures still succeed, because the write itself only needs the file, while recording the evidence needs the directory. The run leaves a marker saying "these calls did work I could not record." The health check reads that marker and tells the developer their counts are a floor, not a total — even though the trace file it would normally read was never created.

**Why this priority**: This is the one remaining case where a failure leaves the health check reporting a clean skip. Every other reported failure at least surfaces somewhere. It is also the smallest fix in the feature, so it should not wait behind the others.

**Independent Test**: Make a spec directory unwritable for new files but leave an existing capture path usable, run a capture, then run the health check. It must name the unrecorded calls instead of reporting that nothing has been captured.

**Acceptance Scenarios**

1. **Given** a run left an unrecorded-calls marker and no trace file exists, **When** the health check runs, **Then** it reports the unrecorded calls as a problem rather than skipping the trace check as "nothing captured yet".
2. **Given** a run left an unrecorded-calls marker and a trace file also exists, **When** the health check runs, **Then** it reports the unrecorded calls exactly as it does today, with counts labelled as lower bounds.
3. **Given** no marker exists and no trace file exists, **When** the health check runs, **Then** it still reports the trace check as skipped, with the existing wording.

---

### User Story 2 - A step that closed without running anything says so (Priority: P1)

A developer reads a finished run's report. One step wrote code, checked off a task named "add a test", and closed. Nothing was ever executed. The report names that: the step recorded no verifications at all, so nothing in it was proven to work.

**Why this priority**: A run that closes with zero verifications is the highest-value false clean left. Today the requirement to run the project's checks is prompt text only, with nothing observing whether it happened.

**Independent Test**: Close an implement step on a spec whose recorded verifications list is empty, run the health check, and confirm the finding appears. Record one verification, re-run, and confirm it does not.

**Acceptance Scenarios**

1. **Given** an implement step that reached its completion with no verification recorded, **When** the health check runs, **Then** it reports that the step closed with nothing verified.
2. **Given** an implement step that recorded at least one verification, **When** the health check runs, **Then** no such finding appears.
3. **Given** a spec that never reached implement, **When** the health check runs, **Then** the check reports itself as not applicable rather than as a failure.

---

### User Story 3 - A step's recorded time contains the work it claims (Priority: P2)

A developer looks at how long the planning step took and gets a number that covers the planning, not the gap between finishing the planning and getting around to writing it down. Today a step's start is stamped when the assistant reaches the line that stamps it, which on a measured run was after files had already been edited — half the run's clock belonged to no step at all.

**Why this priority**: The report already warns when a large share of elapsed time belongs to no step, so the developer is no longer misled. Closing the gap itself is the honest fix, but it is the larger change and the misleading part is already neutralised.

**Independent Test**: Run a full pipeline and compare each step's recorded start against the earliest evidence of that step's work. The gap should be dispatch latency, not minutes of unrecorded work.

**Acceptance Scenarios**

1. **Given** a step is dispatched, **When** the assistant begins any of that step's work, **Then** the step's recorded start is already stamped.
2. **Given** a step's start was stamped at dispatch, **When** the step body's own start instruction runs, **Then** it does not produce a second start entry.
3. **Given** a full pipeline run, **When** the health check measures the share of elapsed time belonging to no step, **Then** that share is below the threshold that triggers the existing warning.

---

## Edge Cases

- The unrecorded-calls marker exists but is empty or unreadable: treated as absent, never as a crash.
- Both the spec-level and repository-level markers exist: entries from both are reported, without double-counting.
- A run has verifications recorded against a step other than implement: does not satisfy the implement check.
- The pipeline runs a recipe where implement is absent entirely: the verification check reports as not applicable.
- A step start already exists from a prior attempt at the same step: no duplicate entry, and the earliest start wins, since history is append-only.
- The health check runs on a spec created before any of this shipped: every new check degrades to "no record" rather than reporting a false problem.

## Requirements

### Functional Requirements

- **FR-001**: The health check MUST read the unrecorded-calls marker before deciding that a spec has no trace evidence, so a missing trace file no longer suppresses it.
- **FR-002**: When unrecorded calls are found with no trace file present, the health check MUST report them at problem severity, naming at least one reason verbatim.
- **FR-003**: When no marker and no trace file are present, the health check MUST continue to report the trace check as skipped, with its current wording unchanged.
- **FR-004**: The health check MUST report an implement step that reached completion with no verification recorded against it.
- **FR-005**: The verification check MUST report itself as having no record — not as a problem — for a spec that never reached implement, or that predates verification recording.
- **FR-006**: A step's start MUST be recorded before the assistant performs any of that step's work, so a step's recorded window contains the work attributed to it.
- **FR-007**: Recording a step's start twice for the same step MUST NOT produce a second start entry, and the earlier timestamp MUST win.
- **FR-008**: Every new check MUST degrade silently on a spec with no relevant record, never failing the health check or the host command.
- **FR-009**: Each behaviour above MUST have an executable test that fails if the behaviour regresses.

## Key Entities

- **Unrecorded-calls marker** — a file left beside the trace naming calls that did work the trace could not record. Its whole reason to exist is the case where the trace itself could not be written, which is the case that currently cannot reach it.
- **Verification record** — the list of checks a run actually executed, recorded against the run. Already writable; nothing reads it to judge a step.
- **Step boundary** — the start and completion timestamps that define a step's recorded window. The completion is trustworthy; the start is currently stamped whenever the assistant reaches it.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A run whose trace file could not be created reports its unrecorded calls, where today it reports the trace check as skipped.
- **SC-002**: A step that closes having executed nothing produces exactly one finding naming it, where today it produces none.
- **SC-003**: Across a full pipeline run, the share of elapsed time belonging to no step is under 25%, down from 49% on the measured run in #622.
- **SC-004**: Zero new findings appear on a clean run — every added check reports nothing when there is nothing wrong.
- **SC-005**: All three behaviours are covered by tests that fail when the behaviour is reverted.

## Assumptions

- The remaining items were confirmed against `main` at `bb3e12fa` before this spec was written; the nine already fixed are excluded rather than re-verified in the plan.
- "Verification" means the recorded verification list, which the capture runtime already supports writing. No new recording mechanism is needed, only a reader.
- Fixing the late start stamp means moving the stamp earlier in the dispatch path. Which layer owns it is a planning decision, not a spec decision.

## Non-Goals

- **Preventing hand-edited task checkboxes.** Already detected and reported at problem severity. Prevention would mean policing an assistant's file writes, which is a larger change for no additional visibility.
- **Catching task records that name files never created.** Blocked on the artifact manifest in #624; the pieces exist but nothing calls them. That work belongs to #624, not here.
- **Re-fixing anything closed by #623, #628, #630 or #650.**

## Verbatim Constraints

- `.trace-lost` — the unrecorded-calls marker file
- `verified[]` — the recorded verification list on the spec context
- `_lost_entries` — the existing reader for the marker
- `speckit-extension/scripts/doctor_checks.py` — the health check module that owns both new behaviours

## ADDED Requirements
<!-- capability: capture-runtime -->

### The health check MUST consult the unrecorded-calls marker before concluding a spec has no trace evidence

A run that cannot write into its spec directory can still complete captures while the trace line recording them fails to append. That run leaves a marker and no trace file. The check SHALL read the marker first, so the single failure mode that produces no trace at all is reportable rather than indistinguishable from a spec that has simply captured nothing yet.

#### Scenario: the trace file was never created
- **WHEN** the health check runs on a spec with unrecorded-call entries and no trace file
- **THEN** it reports those calls at problem severity, naming at least one reason verbatim
- **AND** it does not report the trace check as skipped

#### Scenario: neither a marker nor a trace exists
- **WHEN** the health check runs on a spec with no marker and no trace file
- **THEN** it reports the trace check as skipped with its existing wording, and emits no finding

### The health check MUST report an implement step that closed having executed nothing

Running the project's own checks is an instruction with no observer, so a run can write code, check off a task naming a test, and close having proven nothing. The check SHALL judge whether the run recorded any verification it actually executed before implement closed, treating an absent, empty, or malformed list alike as nothing verified.

#### Scenario: implement closed with an empty verification list
- **WHEN** the health check runs on a spec whose implement step recorded a step-level completion and no verification
- **THEN** it emits exactly one problem finding naming that the step closed with nothing verified

#### Scenario: the spec never reached implement
- **WHEN** the health check runs on a spec with no implement completion recorded
- **THEN** the check reports itself as having no record, never as a problem

## MODIFIED Requirements
<!-- capability: companion-commands -->

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
