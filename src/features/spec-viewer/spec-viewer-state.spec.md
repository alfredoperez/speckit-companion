# Spec Viewer State — Living Spec

<!-- reviewed: 763a4a8b -->
> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Decides where a spec stands from its recorded run, not from which files exist, and owns the timing, staleness, recovery, and completion judgements that follow.

## Requirements

### Viewer state is derived from the spec's recorded run, not from files on disk

The status badge, running step, completed steps, and footer actions MUST be derived from the spec's recorded context. A document file's presence SHALL NOT count as evidence that a step completed. File existence only decides whether a document can be opened and whether a step tab has something behind it.

#### Scenario: a document exists but the step never ran
- **WHEN** a plan document is present but the run never recorded the plan step
- **THEN** the plan step reads as not started
- **AND** the footer still offers the forward action for the step the spec is on

#### Scenario: an external tool advanced the run without per-step detail
- **WHEN** the recorded context names a later current step but has no entries for the steps before it
- **THEN** those earlier steps are treated as completed by their position in the ordering
- **AND** no step is left falsely pulsing

### Timing is reported by real wall-clock spans, and only timed steps count toward coverage

The viewer MUST show a step's duration only when both boundaries were stamped by a deterministic writer, in order, with a close at least as authoritative as the start. A CLI-only run stamped by the agent's writer script is trusted; an agent finish over an extension start, or a phase with no start, is not, and an untrusted span is withheld rather than guessed or capped. When the run is not fully trusted, the viewer shows "X of Y phases" coverage instead. Y MUST exclude steps declared untimed, such as the status-only terminal completion step.

#### Scenario: a completed run includes a status-only terminal step
- **WHEN** a completed spec's workflow ends with an untimed step that only records completion
- **THEN** that step is left out of the timing denominator
- **AND** the run reads as fully covered and its started/elapsed/ended span is shown

#### Scenario: a step's boundaries are not both trustworthy
- **WHEN** one of a step's start/complete stamps is missing, out of order, or overlaps an adjacent phase
- **THEN** no duration is claimed for that step
- **AND** the viewer falls back to the coverage statement

### One fact has exactly one derivation

Any fact shared with another surface (the sidebar tree, the Living Specs panel, task counting, in-flight detection) MUST be read from its single owning module, not recomputed here. Where a fact decides whether something is evidence or an assertion, that judgement SHALL be made once as the state is derived and carried, never re-read from the raw record by what renders it.

#### Scenario: a capability's coverage is shown in two places
- **WHEN** the viewer header and the Living Specs tree both display a capability's coverage
- **THEN** both obtain it from the same capability-health reader
- **AND** the two numbers cannot disagree

#### Scenario: a verification's provenance is read back
- **WHEN** the state is derived
- **THEN** only what the pipeline actually ran is marked as derived, and every other entry is carried as a claim

#### Scenario: a requirement count and a coverage denominator are displayed together
- **WHEN** the header shows both a requirement count and a covered-of-total ratio
- **THEN** both are counted off the same requirement identifiers
- **AND** the count and the denominator always match

#### Scenario: the header and the sidebar both name a spec
- **WHEN** the header and the sidebar tree render the same spec's name
- **THEN** both use one shared resolver (recorded name, then document heading, then humanized slug), so a raw slug never shows when a readable title exists
- **AND** the two surfaces cannot disagree, while the slug stays the identifier behind filtering, sorting, and open

### Staleness is advisory, document-local, and silent once the spec settles

Staleness SHALL compare one document against the documents it was generated from and be reported per document. It MUST NOT be computed for a completed or archived spec, so every surface that reads it goes quiet together.

#### Scenario: a spec is marked completed
- **WHEN** staleness is requested for a settled spec
- **THEN** an empty verdict is returned
- **AND** both the notice and the per-step mark disappear

### Quiet-run recovery states a suspicion, never acts on it

When an in-flight step has had no spec changes for a long time, the viewer MAY show a hedged prompt offering to resume or set the status by hand. It MUST NOT change status itself and MUST derive the judgement at render time from disk, with no polling. It SHOULD use a longer fuse for steps that think long between writes. Once a run is clearly not still running, the prompt SHALL lead with closing the spec out instead of resuming.

#### Scenario: a long-abandoned run
- **WHEN** an in-flight spec has been quiet for days
- **THEN** the prompt says the run looks abandoned and leads with marking it done
- **AND** the spec's status is unchanged until the reader acts

#### Scenario: every task is checked but the spec still reads in flight
- **WHEN** the work is finished and nobody closed the step
- **THEN** the prompt leads with marking the spec complete, however long it has been quiet

### A step's completion is announced exactly once

When a step's recorded completion appears, the viewer SHOULD tell the reader and offer to open the spec, gated by a reader-controlled setting. Announcements MUST be de-duplicated per spec, step, and run, and the first observation of an already-finished spec MUST seed the memory silently.

#### Scenario: a panel is reopened on a finished spec
- **WHEN** the viewer first observes a spec whose steps are already complete
- **THEN** nothing is announced
- **AND** a genuinely new completion after that is announced once

## Uncovered

_None: every file in the area was read, though test files under `__tests__/` were read only for the contracts they pin._
