# Spec Viewer Actions — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Actions are what the reader may do next and what the viewer writes to the spec's record on their behalf: the footer catalog, pipeline dispatch, and review-comment persistence. Without a single authority the footer offers steps the spec cannot take, and without a single writer two mutations clobber each other.

## Requirements

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

Which steps exist SHALL come from the one shared pipeline resolution the sidebar also uses, so a step the project added is a real step here: a dispatchable step placed after implement is the forward action, not a duplicate of completion, and whether a step's start is recorded is decided by that resolution rather than a fixed list of lifecycle names.

#### Scenario: the project placed a real step after implement
- **WHEN** implement has settled
- **THEN** the forward action targets that step rather than disappearing

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

The resolution, the fallback warning, the usage event, and the prompt assembly SHALL be performed by one shared dispatch routine rather than re-implemented per surface, so every place that can start a step behaves identically when the companion pipeline is missing.

#### Scenario: a second surface gains a way to run a step
- **WHEN** it dispatches
- **THEN** it goes through the same routine and inherits the same fallback, warning, and reporting

#### Scenario: a step is dispatched from the viewer
- **WHEN** the dispatch is reported for usage measurement
- **THEN** it carries only the provider, the phase coerced to its allow-list, and the spec's correlation identifier when one exists
- **AND** it attaches no retired dimension, so no reported field can outlive the concept it described

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

A living spec has no record to persist into, so in living mode the comments travel with the refinement request itself and the same prompt is built against the tier file's own path. The prompt SHALL be assembled once and shared by both paths — a second copy is how one of them quietly stops forbidding a regeneration.

#### Scenario: refinement is dispatched from a living spec
- **WHEN** the reader refines a capability's tier document
- **THEN** the comments supplied with the request are used, since none were persisted
- **AND** the prompt names the tier file and carries the same in-place-edit instructions as a run's document

## Uncovered

_None — every file in the area was read, though the test files under `__tests__/` were read only for the contracts they pin, not line by line._
