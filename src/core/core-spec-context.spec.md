# Core Spec Context — Living Spec

<!-- reviewed: d589a63e -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Core defines what a spec's recorded state means: the on-disk context file, its append-only history, the pairing of steps with statuses, and which timings can be trusted. The extension, the prompt preamble, and the Python writers all share this one contract.

## Requirements

### Recorded spec state has one on-disk shape and one append-only log
<!-- touches: src/core/types/specContext.ts, src/core/types/spec-context.schema.json -->

A spec's lifecycle SHALL be recorded in one per-spec context file whose history is append-only: entries are never reordered, edited, or removed. Per-step and per-substep timing SHALL be derived in memory from that log, never persisted beside it. Unknown and legacy fields MUST be preserved across writes, so no writer loses another's data.

#### Scenario: a step's timing is displayed
- **WHEN** the viewer needs how long a step took
- **THEN** it derives that from the history log, not a stored duration

#### Scenario: a writer that predates a field updates the file
- **WHEN** a component rewrites the context file
- **THEN** fields it does not recognize survive the write unchanged

A recorded coverage row SHALL be able to record which of its named tests were confirmed to exist, separately from the case where nobody checked. "Checked and not found" and "not checked" MUST NOT collapse into one, because only the first is a finding.

#### Scenario: coverage is recorded without a workspace to resolve against
- **WHEN** no check could be performed
- **THEN** the row records that nobody checked, not that nothing was found

### The recorded status and the recorded step must not disagree
<!-- touches: src/core/types/specContext.ts -->

Status values and step names SHALL form one lifecycle where each non-terminal status names its owning step and whether that step is running or settled. A status ahead of the history log MUST NOT be written, because it renders as work in progress that nobody is doing.

#### Scenario: a step is advanced
- **WHEN** the current step changes
- **THEN** a matching history entry is appended in the same write

#### Scenario: a step is still running
- **WHEN** the status is one of the in-progress forms
- **THEN** the extension reports that step as active, not settled

The pairing of each step with its running and settled statuses SHALL be declared exactly once per language runtime, and a test SHALL read both declarations and hold them together. Every other consumer, including the extension, the prompt preamble, and the Python writers, reads the pairing from there instead of restating it.

#### Scenario: the two runtimes disagree about where a step lands
- **WHEN** one side's map settles a step at a different status than the other's
- **THEN** the test comparing them fails, naming the step
- **AND** finishing the implement step settles at `implemented`, never at `completed`, because closing the spec is the user's explicit action

A separate, narrower list SHALL name the steps a default pipeline dispatches and measures (specify, plan, tasks, implement) as the fallback for a project whose workflow defines none. Optional steps are not timed, so they are absent from it.

A step the project added to its pipeline has no canonical status, and the pairing lookups SHALL answer "no status" for it instead of throwing. Every writer that would advance the status on such a step SHALL keep the spec's current status while still appending the history entry. A repair pass that re-derives status from the step likewise leaves it alone when there is nothing to derive.

#### Scenario: a project-added step starts or finishes
- **WHEN** the writer records its boundary
- **THEN** the history entry is appended
- **AND** the spec's status is unchanged, because the step maps to none

### A duration is only shown when the extension itself stamped both ends
<!-- touches: src/core/types/specContext.ts -->

A span SHALL be trusted only when the extension's own clock stamped both of its boundaries. Timestamps journaled by the assistant or a CLI order events correctly but record when the write ran, so a duration from them MUST NOT be displayed as elapsed time.

#### Scenario: the assistant journaled a step's completion
- **WHEN** a step's start or end was written by something other than the extension
- **THEN** the span is marked untrusted and no elapsed time is rendered for it

A derived step entry MAY carry a `folded` marker, set only by the in-memory step-history derivation for a fast-path step stamped inside its anchoring phase. The marker is independent of duration trust, is never persisted with the log, and its derivation and rendering live in the specs and viewer-UI capabilities.

#### Scenario: the whole run's elapsed time is requested
- **WHEN** a run-level timing summary is derived from the history log
- **THEN** a start, end, and elapsed span appear only if every expected phase has a trustworthy closed span; otherwise the summary reports how many phases were measured and stays incomplete
- **AND** the summary is derived in memory, never persisted, so the history log stays the only timing source on disk

### Every field a script writes is declared in the shared context type
<!-- touches: src/core/types/specContext.ts, src/core/types/spec-context.schema.json -->

Any field a writer puts on the per-spec context file SHALL be declared in the canonical context type and documented in the schema reference. The writers and readers are in different languages, so an undeclared field is one no reader can discover or consume without a cast.

#### Scenario: a script writes a field the type does not have
- **WHEN** the field is added
- **THEN** declaring it in the type and the schema reference is part of that change, not a follow-up

## Uncovered

_None. Every file in the area was read._
