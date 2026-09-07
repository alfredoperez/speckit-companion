# Core Spec Lifecycle — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

What a spec's recorded state means: the single append-only context file, the pairing of steps with statuses, how durations are trusted, and the one observed path that closes the implement step.

## Requirements

### Recorded spec state has one on-disk shape and one append-only log

A spec's lifecycle SHALL be recorded in a single per-spec context file whose history is append-only — entries are never reordered, edited, or removed. Per-step and per-substep timing SHALL be derived in memory from that log rather than persisted alongside it, so there is exactly one source of truth and no second field to drift. Unknown and legacy fields MUST be preserved across writes, so an older or newer writer never loses another's data.

#### Scenario: a step's timing is displayed
- **WHEN** the viewer needs how long a step took
- **THEN** it derives that from the history log rather than reading a stored duration

#### Scenario: a writer that predates a field updates the file
- **WHEN** a component rewrites the context file
- **THEN** fields it does not recognize survive the write unchanged

A recorded coverage row SHALL be able to carry which of its named tests were confirmed to exist, distinguished from the case where nobody checked. "Checked and not found" and "not checked" are different facts and MUST NOT collapse into one, because only the first is a finding.

#### Scenario: coverage is recorded without a workspace to resolve against
- **WHEN** no check could be performed
- **THEN** the row records that nobody checked, rather than recording that nothing was found

### The recorded status and the recorded step must not disagree

Status values and step names SHALL form one lifecycle where each non-terminal status names the step that owns it and whether that step is still running or settled. A status ahead of the history log is an invalid state and MUST NOT be written: it renders as work in progress that nobody is doing.

#### Scenario: a step is advanced
- **WHEN** the current step changes
- **THEN** a matching history entry is appended in the same write

#### Scenario: a step is still running
- **WHEN** the status is one of the in-progress forms
- **THEN** the extension reports that step as active rather than settled

The pairing of a step with the status it carries while running and the status it settles at SHALL have exactly one declaration per language runtime, and the two declarations SHALL be held together by a test that reads both. Every other place that needs the pairing — the extension, the prompt preamble, the Python writers — reads it from there rather than restating it. A hand-copied version of this map is the drift that cannot be seen by reading either file alone.

#### Scenario: the two runtimes disagree about where a step lands
- **WHEN** one side's map settles a step at a different status than the other's
- **THEN** the test comparing them fails, naming the step
- **AND** finishing the implement step settles at `implemented`, never at `completed`, because closing the spec is the user's explicit action

A separate, narrower list SHALL name the steps a default pipeline dispatches and measures — specify, plan, tasks, implement — as the fallback for a project whose workflow does not define its own. Optional steps are not expected to be timed, so they are absent from it; it describes the default path, not the set of steps a pipeline may contain.

A step the project added to its pipeline is a real step with no canonical status. The pairing lookups SHALL answer "no status" for it rather than throw, and every writer that would advance the status on such a step SHALL keep the status the spec already has while still appending the history entry — the entry is what records that the step ran. A repair pass that would re-derive the status from the step likewise leaves it alone when there is nothing to derive it to.

#### Scenario: a project-added step starts or finishes
- **WHEN** the writer records its boundary
- **THEN** the history entry is appended
- **AND** the spec's status is unchanged, because the step maps to none

### A duration is only shown when the extension itself stamped both ends

A span SHALL be reported as trustworthy only when both of its boundaries were stamped by the extension's own clock. Timestamps journaled by the assistant or a CLI order events correctly but record when the write ran, not when the work happened, so a duration computed from them is fiction and MUST NOT be displayed as elapsed time.

#### Scenario: the assistant journaled a step's completion
- **WHEN** a step's start or end was written by something other than the extension
- **THEN** the span is marked untrusted and no elapsed time is rendered for it

A derived step entry MAY additionally carry a `folded` marker — set only by the in-memory step-history derivation for a fast-path step whose boundaries were stamped inside its anchoring phase — which is independent of duration trust; the derivation rule and its rendering live in the specs and viewer-UI capabilities, and the field is never persisted alongside the log.

#### Scenario: the whole run's elapsed time is requested
- **WHEN** a run-level timing summary is derived from the history log
- **THEN** a start, end, and elapsed span appear only if every expected phase has a trustworthy closed span; otherwise the summary reports how many phases were measured and stays incomplete
- **AND** the summary is derived in memory, never persisted, so the history log stays the only timing source on disk

### The completion of the implement step is closed by observing the work, not by trusting a report

Because the extension is blind to what the assistant does, the implement step SHALL be closed by watching the task list itself: when every task is checked and implement is underway, the extension writes the terminal close. This path MUST work regardless of how the run was driven, and MUST be idempotent and forward-only so it can never move a spec backward.

#### Scenario: the last task is checked off
- **WHEN** the task document changes and no unchecked tasks remain while implement is in progress
- **THEN** the extension records the implement step's completion
- **AND** re-running the same check does not duplicate or regress the recorded state

### Every field a script writes is declared in the shared context type

A field written onto the per-spec context file by any writer SHALL be declared in the canonical context type and documented in the schema reference. The two halves are written in different languages and neither can call the other, so an undeclared field is one no reader on this side can consume without a cast, and one no reader on either side can discover.

#### Scenario: a script writes a field the type does not have
- **WHEN** the field is added
- **THEN** declaring it in the type and the schema reference is part of that change, not a follow-up
