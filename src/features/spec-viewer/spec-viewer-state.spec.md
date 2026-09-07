# Spec Viewer State Derivation — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How the viewer decides where a spec stands: state read from the recorded run rather than files on disk, verified coverage, trusted timing spans, single-owner facts, staleness, quiet-run recovery and completion announcements.

## Requirements
### Viewer state is derived from the spec's recorded run, not from files on disk

Everything the reader sees about *where the spec stands* — the status badge, which step is running, which steps are done, and which actions the footer offers — MUST be derived from the spec's recorded context. The presence or absence of a document file SHALL NOT be read as evidence that a step completed. File existence remains meaningful only for what it actually proves: whether a document can be opened, and whether a step tab has something behind it.

#### Scenario: a document exists but the step never ran
- **WHEN** a plan document is present but the run never recorded the plan step
- **THEN** the plan step reads as not started
- **AND** the footer still offers the forward action for the step the spec is actually on

#### Scenario: an external tool advanced the run without per-step detail
- **WHEN** the recorded context names a later current step but carries no entries for the steps before it
- **THEN** those earlier steps are treated as completed by their position in the ordering
- **AND** no step is left falsely pulsing

### Displayed coverage is verified, and an empty result is stated rather than hidden

The requirement-to-test table renders with the visual authority of a check, so it MUST behave like one. A test a requirement names SHALL be confirmed to exist before the table presents it as coverage, and a named test that cannot be found SHALL render in a state distinct from both a confirmed test and a requirement that was never mapped — a link resolving to nothing is worse than an honest gap, because it reads as coverage that exists. Where several tests are named, the label SHALL say how many were found, so a partly-real link is not read as whole. The distinction MUST survive without colour.

Coverage is the one section exempt from hiding itself when empty. Nothing traced is a finding, not an absence, and the header strip reports the count whether the section renders or not — so hiding it left the page stating the zero and withholding the explanation at the same time.

#### Scenario: a requirement names a test that is not on disk
- **WHEN** a linked test path does not resolve in the workspace
- **THEN** that row renders in its own state and the label says how many of the named tests were found

#### Scenario: no requirement has a linked test
- **WHEN** coverage rows exist and none is traced
- **THEN** the section renders, states the zero, and lists the untraced requirements

### Timing is reported by real wall-clock spans, and only timed steps count toward coverage

The viewer MUST derive a timing summary from the spec's recorded step history and surface a step's wall-clock duration only when both of that step's boundaries were stamped by a deterministic writer, fall in order, and the close is at least as authoritative as the start — so a run driven entirely through the CLI (boundaries stamped by the agent's own writer script) is trusted, while a premature agent finish stamped over an extension-started span, or a phase advanced with no start, is not; a span that fails that trust test is withheld rather than shown as a guessed or capped figure. When the run is not fully trusted the viewer reports a plain "X of Y phases" coverage statement instead. The coverage denominator MUST count only steps that are expected to be timed — a step declared untimed (one that merely flips the spec's status without ever writing a start/complete boundary, such as the terminal completion step) SHALL be excluded from Y, so a fully-captured completed run reaches its full coverage and shows its elapsed span rather than stalling one short.

#### Scenario: a completed run includes a status-only terminal step
- **WHEN** a completed spec's workflow ends with an untimed step that only records completion
- **THEN** that step is left out of the timing denominator
- **AND** the run reads as fully covered and its started/elapsed/ended span is shown

#### Scenario: a step's boundaries are not both trustworthy
- **WHEN** one of a step's start/complete stamps is missing, out of order, or overlaps an adjacent phase
- **THEN** no duration is claimed for that step
- **AND** the viewer falls back to the coverage statement rather than a fabricated time

### One fact has exactly one derivation

Any fact this feature shares with another surface — the sidebar tree, the Living Specs panel, task counting, in-flight detection — MUST be read from that fact's single owning module rather than recomputed here. Two independent derivations of the same fact will drift, and every time this repo has shipped one, the two surfaces eventually contradicted each other in front of the user.

#### Scenario: a capability's coverage is shown in two places
- **WHEN** the viewer header and the Living Specs tree both display a capability's coverage
- **THEN** both obtain it from the same capability-health reader
- **AND** the two numbers cannot disagree

#### Scenario: a requirement count and a coverage denominator are displayed together
- **WHEN** the header shows both a requirement count and a covered-of-total ratio
- **THEN** both are counted off the same requirement identifiers
- **AND** the count and the denominator always match

#### Scenario: the header and the sidebar both name a spec
- **WHEN** the header renders a spec's display name and the sidebar tree renders the same spec's row
- **THEN** both resolve the name through one shared resolver — recorded name first, then the document heading, then a humanized slug — so a raw directory slug is never shown when a readable title exists
- **AND** the two surfaces cannot show different names for the same spec, while the slug stays the stable identifier behind filtering, sorting, and open

### Staleness is advisory, document-local, and silent once the spec settles

A staleness verdict compares one document against the documents it was generated from, and is reported per document so the notice can sit with the document it describes. It MUST NOT be computed at all for a completed or archived spec — "regenerate this, the source moved on" is advice about work still to do, and a finished spec has none. Every surface that reads staleness therefore goes quiet together.

#### Scenario: a spec is marked completed
- **WHEN** staleness is requested for a settled spec
- **THEN** an empty verdict is returned
- **AND** both the notice and the per-step mark disappear

### Quiet-run recovery states a suspicion, never acts on it

When a step is in flight but nothing belonging to the spec has changed for a long time, the viewer MAY surface a hedged prompt offering to resume or to set the status by hand. It MUST NOT change the spec's status on its own, MUST derive the judgement purely at render time from what is on disk (no polling), and SHOULD use a longer fuse for steps that think for a long time between writes than for steps that write frequently. Past the point where "is it still running?" stops being a plausible question, the prompt SHALL change its framing to closing the spec out instead of resuming it.

#### Scenario: a long-abandoned run
- **WHEN** an in-flight spec has been quiet for days
- **THEN** the prompt says the run looks abandoned and leads with marking it done
- **AND** the spec's status is unchanged until the reader acts

#### Scenario: every task is checked but the spec still reads in flight
- **WHEN** the work is finished and nobody closed the step
- **THEN** the prompt leads with marking the spec complete regardless of how long it has been quiet

### A step's completion is announced exactly once

When a step's recorded completion appears, the viewer SHOULD tell the reader, with an offer to open the spec. The announcement MUST be de-duplicated per spec, step, and run so reopening a panel never re-announces history, and the first observation of an already-finished spec MUST seed the memory silently rather than firing a burst of stale notices. The announcement is gated by a setting the reader controls.

#### Scenario: a panel is reopened on a finished spec
- **WHEN** the viewer first observes a spec whose steps are already complete
- **THEN** nothing is announced
- **AND** a genuinely new completion after that is announced once
