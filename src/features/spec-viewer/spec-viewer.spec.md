# Spec Viewer — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The spec viewer is the extension-side host for the reading surface: it owns a spec's panel, decides what the reader is allowed to see and do next, and hands the webview a complete picture of the spec's true state. Without it the workflow's state would only exist as files on disk, and the reader would have to infer where a spec stands from what happens to be present in a directory — which is exactly how the viewer and the sidebar used to disagree with each other.

## Requirements

### One panel per spec, revealed rather than duplicated

Opening any document of a spec MUST resolve to that spec's own panel. A second open — of the same document, a sibling document, or the spec as a whole — SHALL reuse and reveal the existing panel rather than creating another. Panels are keyed by the spec's directory so a spec can never end up with two disagreeing views of itself, and closing a panel MUST release everything scoped to it (pending timers, per-spec notification memory).

#### Scenario: opening a sub-document of an open spec
- **WHEN** the reader opens a document that lives under a directory a panel already owns
- **THEN** that panel switches to the document and comes to the front
- **AND** no second panel is created

#### Scenario: the panel is closed
- **WHEN** a panel is disposed
- **THEN** its pending work and its per-spec notification state are discarded
- **AND** reopening the spec starts from a clean panel

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

### Every refresh ships a complete state snapshot from one builder

Both refresh paths — a document switch and a change to the spec's recorded context — MUST build their payload through one shared builder and send a *complete* state, never a partial merged onto whatever the webview last held. A payload that omits a state-bearing field would let the webview keep a stale value beside fresh ones, which is how the footer once offered an action the spec's real state did not permit.

#### Scenario: the recorded context changes on disk
- **WHEN** a watcher reports a change to an open spec's recorded context
- **THEN** the viewer re-derives state and posts a complete snapshot
- **AND** the reader sees the settled state without switching tabs or reloading

#### Scenario: a refresh that carries no document content
- **WHEN** the refresh is triggered by state alone
- **THEN** document and staleness reads are skipped as unnecessary work
- **AND** the snapshot remains internally consistent by reusing the panel's cached values for the fields it did not recompute

### The action catalog is the authority on what the reader may do

The set of actions offered at the bottom of the viewer MUST be computed as a function of the spec's state alone, and the same true state SHALL always yield the same set. Each action declares whether it affects the whole spec or only the current step, and that scope is surfaced to the reader. Closure actions appear only once the spec has reached its final approval gate; the forward action targets the spec's real current step and disappears when the workflow has genuinely moved past it.

#### Scenario: a step is still running
- **WHEN** the spec's status names a step as in flight
- **THEN** the catalog still offers the re-run action for that step
- **AND** the reader is not offered a way to advance a step that has not settled

#### Scenario: an interrupted run is rolled back by hand
- **WHEN** an earlier status is forced after a run died mid-step
- **THEN** the abandoned later start no longer suppresses the forward action
- **AND** the reader gets the same forward action a normal pause at that stage would offer

#### Scenario: the reader is looking at an earlier step's document
- **WHEN** a completed earlier step's document is displayed
- **THEN** the forward action still reflects the spec's true stage, not the tab being viewed

### Reading a spec must never damage its record

The viewer SHALL treat the spec's recorded context as read-only after the first open. It MAY create a minimal record when none exists at all, but a record that exists and cannot be parsed MUST be rendered from an in-memory stand-in and left untouched on disk. Repairing a corrupt record is the reader's explicit decision, taken through an offer that backs up the original first.

#### Scenario: the record is unreadable mid-write
- **WHEN** the record cannot be parsed during a render
- **THEN** the panel renders from a minimal in-memory stand-in
- **AND** nothing is written over the file on disk

#### Scenario: the reader accepts a reset
- **WHEN** the reader chooses to reset a corrupt record
- **THEN** the original is backed up before a fresh record is written
- **AND** the open panel refreshes onto the repaired state

### Pipeline actions target the spec's real step, and degrade safely when the pipeline is unavailable

Re-running or advancing a step MUST resolve its target from the spec's recorded current step — never from the document the reader happens to be looking at — and MUST record an honest start (and, when advancing, a completion) before dispatching. When a dispatch names a command that belongs to the companion pipeline and that pipeline is not installed, the viewer SHALL fall back to the standard equivalent and say so, and SHALL suppress the dispatch entirely rather than send a command that cannot resolve.

#### Scenario: re-run is clicked from a child document
- **WHEN** the reader triggers a re-run while viewing a supporting document
- **THEN** the spec's current step is re-run
- **AND** no start is recorded against the wrong step

#### Scenario: the companion pipeline is not installed
- **WHEN** a dispatch would name a companion-only command with no standard equivalent
- **THEN** nothing is dispatched
- **AND** the reader is told what is missing and offered a way to install it

### Review comments persist through the single writer, one mutation at a time

An inline comment MUST be persisted to the spec's record the moment it is added, edited, or removed, and MUST reach disk through the sanctioned writer rather than a direct write. Mutations for a given spec SHALL be serialized so two comments added in quick succession cannot read the same baseline and clobber each other, and a failed mutation MUST NOT wedge the queue for the ones behind it. A mutation SHALL be refused outright when the existing record cannot be read.

#### Scenario: two comments are added in quick succession
- **WHEN** the webview posts two comment mutations back to back
- **THEN** they apply in order against successive baselines
- **AND** neither is lost

#### Scenario: refinement is dispatched for a document
- **WHEN** a document's pending comments are sent to the assistant
- **THEN** the prompt asks for targeted in-place edits and explicitly forbids regenerating the document from a template
- **AND** the dispatched comments are marked applied rather than deleted

### Best-effort facts are omitted, never rendered as zeros

Any fact the viewer cannot determine — a count, a date, a coverage ratio, a drift verdict — MUST be left out of the surface rather than shown as an empty or zero value. A zero the reader can trust and a fact nobody could compute are different claims, and rendering them identically makes the surface lie.

#### Scenario: a capability's health cannot be computed
- **WHEN** the repository has no version control, or the check times out
- **THEN** the coverage and drift facts are simply absent from the header
- **AND** nothing renders as `0`

### Slow facts arrive after first paint and are discarded if the panel moved on

A fact that costs real time to compute MUST NOT block the panel's first render. It SHALL be resolved afterwards and pushed to the panel, and the push MUST be dropped if the panel has since been re-anchored to a different subject — otherwise a slow answer about one capability lands on another.

#### Scenario: two capabilities share a panel
- **WHEN** the reader switches to a second capability while the first one's health check is still running
- **THEN** the late result is discarded
- **AND** the header keeps showing only facts belonging to what is on screen

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

### A living spec is presented as a capability, not a run

A living-spec panel MUST drop the workflow machinery entirely — no run state, no phases, no forward actions — and present the capability's tiers as the only navigation. Its title comes from the capability's own spec document whichever tier is displayed, so the title belongs to the capability rather than to the tab on screen. A document that declares itself a draft SHALL be badged as one rather than presented as settled.

#### Scenario: the architecture tier is selected
- **WHEN** a non-spec tier is displayed
- **THEN** the header still shows the capability's title as authored in its spec tier
- **AND** no workflow status or forward action appears

#### Scenario: the document carries a draft banner near its top
- **WHEN** the spec declares itself a draft
- **THEN** the header badges it as a draft
- **AND** the in-document banner is left intact

### The webview shell is generated under a locked-down policy

Each render MUST emit its own content-security policy with a freshly generated per-render nonce, restrict resource loading to the extension's own assets plus the explicitly named script sources, and escape every value interpolated into the shell — including values placed inside HTML attributes, which need stricter escaping than element content. Regenerating the shell is also what resets the webview's in-memory selection, so any navigation meant to preserve that selection MUST go through a message instead.

#### Scenario: a pipeline entry is selected
- **WHEN** the reader picks a document from the pipeline rail
- **THEN** only the content is swapped by message
- **AND** the shell is not regenerated, so the reader's current view is preserved

## Uncovered

_None — every file in the area was read, though the test files under `__tests__/` were read only for the contracts they pin, not line by line._

### A done spec offers only its finish actions, never the forward advance

Once a spec has reached a done-building state, the footer MUST offer only its finish actions (Mark Completed / Archive) and MUST NOT surface the forward advance action, regardless of what the recorded current step says. A fast-path finish can flip the status to done before the pipeline records the final step's boundary, leaving the recorded current step transiently behind; the done status alone SHALL suppress the forward action so advance and finish are never offered together.

#### Scenario: the status is done but the recorded current step still trails
- **WHEN** a spec's status reports it is done building while its recorded current step lags at an earlier step
- **THEN** the footer offers only the finish actions
- **AND** the forward advance action is absent
