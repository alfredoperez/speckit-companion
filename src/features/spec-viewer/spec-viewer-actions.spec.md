# Spec Viewer Actions — Living Spec

<!-- reviewed: 763a4a8b -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

What the reader may do next and what the viewer writes to the spec's record for them: the footer catalog, pipeline dispatch, and review-comment persistence.

## Requirements

### The action catalog is the authority on what the reader may do

The footer's actions MUST be computed from the spec's state alone, and the same state SHALL always yield the same set. Each action declares, and shows, whether it affects the whole spec or only the current step. Closure actions appear only at the final approval gate, and the forward action targets the real current step and disappears once the workflow has moved past it.

#### Scenario: a step is still running
- **WHEN** the spec's status names a step as in flight
- **THEN** the catalog still offers the re-run action for that step
- **AND** the reader cannot advance a step that has not settled

#### Scenario: an interrupted run is rolled back by hand
- **WHEN** an earlier status is forced after a run died mid-step
- **THEN** the abandoned later start no longer suppresses the forward action
- **AND** the reader gets the same forward action a normal pause at that stage offers

#### Scenario: the reader is looking at an earlier step's document
- **WHEN** a completed earlier step's document is displayed
- **THEN** the forward action reflects the spec's true stage, not the tab being viewed

Which steps exist SHALL come from the shared pipeline resolution the sidebar uses, including project-added steps. A dispatchable step after implement is the forward action, and that resolution, not a fixed list of lifecycle names, decides whether a step's start is recorded.

#### Scenario: the project placed a real step after implement
- **WHEN** implement has settled
- **THEN** the forward action targets that step instead of disappearing

### Pipeline actions target the spec's real step, and degrade safely when the pipeline is unavailable

Re-running or advancing a step MUST target the spec's recorded current step, never the document on screen, and MUST record a start (plus a completion when advancing) before dispatching. When a companion-pipeline command is dispatched without that pipeline installed, the viewer SHALL fall back to the standard equivalent and say so, or suppress the dispatch when none exists.

#### Scenario: re-run is clicked from a child document
- **WHEN** the reader triggers a re-run while viewing a supporting document
- **THEN** the spec's current step is re-run
- **AND** no start is recorded against the wrong step

#### Scenario: the companion pipeline is not installed
- **WHEN** a dispatch would name a companion-only command with no standard equivalent
- **THEN** nothing is dispatched
- **AND** the reader is told what is missing and offered a way to install it

Resolution, the fallback warning, the usage event, and prompt assembly SHALL run through one shared dispatch routine, not per surface.

#### Scenario: a second surface gains a way to run a step
- **WHEN** it dispatches
- **THEN** it goes through the same routine and inherits the same fallback, warning, and reporting

#### Scenario: a step is dispatched from the viewer
- **WHEN** the dispatch is reported for usage measurement
- **THEN** it carries only the provider, the phase coerced to its allow-list, and the spec's correlation identifier when one exists
- **AND** it attaches no retired dimension

### Reading a spec must never damage its record

The viewer SHALL treat the recorded context as read-only after first open. It MAY create a minimal record when none exists, but an existing unparseable record MUST be rendered from an in-memory stand-in and left untouched on disk. Repair happens only when the reader accepts an offer that backs up the original first.

#### Scenario: the record is unreadable mid-write
- **WHEN** the record cannot be parsed during a render
- **THEN** the panel renders from a minimal in-memory stand-in
- **AND** nothing is written over the file on disk

#### Scenario: the reader accepts a reset
- **WHEN** the reader chooses to reset a corrupt record
- **THEN** the original is backed up before a fresh record is written
- **AND** the open panel refreshes onto the repaired state

### Review comments persist through the single writer, one mutation at a time

An inline comment MUST be persisted the moment it is added, edited, or removed, through the sanctioned writer, never a direct write. Mutations for one spec SHALL be serialized, and a failed mutation MUST NOT wedge the queue. A mutation SHALL be refused when the existing record cannot be read.

#### Scenario: two comments are added in quick succession
- **WHEN** the webview posts two comment mutations back to back
- **THEN** they apply in order against successive baselines
- **AND** neither is lost

#### Scenario: refinement is dispatched for a document
- **WHEN** a document's pending comments are sent to the assistant
- **THEN** the prompt asks for targeted in-place edits and forbids regenerating the document from a template
- **AND** the dispatched comments are marked applied, not deleted

In living mode there is no record, so comments travel with the refinement request and the prompt targets the tier file's path. The prompt SHALL be assembled once and shared by both paths.

#### Scenario: refinement is dispatched from a living spec
- **WHEN** the reader refines a capability's tier document
- **THEN** the comments supplied with the request are used, since none were persisted
- **AND** the prompt names the tier file and carries the same in-place-edit instructions as a run's document

## Uncovered

_None: every file in the area was read, though test files under `__tests__/` were read only for the contracts they pin._
