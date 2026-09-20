# Spec Viewer Actions — Living Spec

<!-- reviewed: 763a4a8b -->

## Purpose

What the footer lets the reader do next with a spec, and what the viewer writes to the spec's record when they act.

## Requirements

### The forward action follows the spec's current step, not the tab on screen
<!-- touches: apps/vscode/src/features/spec-viewer/footerActions.ts -->

The footer's actions SHALL be computed from the spec's recorded state, so the same state yields the same actions whichever document is displayed.

#### Scenario: the reader is looking at an earlier step's document
- **WHEN** a completed earlier step's document is displayed
- **THEN** the forward action names the step after the spec's current step

### Every footer action says whether it affects the whole spec or only this step
<!-- touches: apps/vscode/src/features/spec-viewer/footerActions.ts -->

Each action's tooltip SHALL end with its scope, "Affects whole spec" or "Affects this step".

#### Scenario: the reader hovers Regenerate
- **WHEN** the tooltip shows
- **THEN** it ends with "(Affects this step)"

### Mark Completed and Archive appear only once implementation is done
<!-- touches: apps/vscode/src/features/spec-viewer/footerActions.ts -->

The closure actions SHALL be offered only while the spec's status is `implemented` or `completed`, never while a step is still being generated or built.

#### Scenario: tasks are still being implemented
- **WHEN** the status is `implementing`
- **THEN** neither Mark Completed nor Archive is offered

#### Scenario: implementation has finished
- **WHEN** the status is `implemented`
- **THEN** Mark Completed and Archive are offered and the forward action is not

### A running step can be re-run but not advanced
<!-- touches: apps/vscode/src/features/spec-viewer/footerActions.ts -->

While the current step is in flight the footer SHALL keep Regenerate and withhold the forward action, saying the actions unlock when the step settles.

#### Scenario: a step is still running
- **WHEN** the spec's status names a step as in flight
- **THEN** Regenerate is offered and the forward action is not

### A run rolled back by hand gets its forward action back
<!-- touches: apps/vscode/src/features/spec-viewer/footerActions.ts -->

A later step's start left behind by an interrupted run SHALL NOT hide the forward action once an earlier status is forced.

#### Scenario: an interrupted run is rolled back
- **WHEN** an earlier status is forced after a run died mid-step
- **THEN** the footer offers the same forward action a normal pause at that stage offers

### A real step after implement becomes the forward action
<!-- touches: apps/vscode/src/features/spec-viewer/footerActions.ts, apps/vscode/src/features/workflows/stepSequence.ts -->

Which steps exist SHALL come from the same pipeline resolution the sidebar uses, including steps the project added. A dispatchable step after implement is offered as the forward action; the status-only completion step is not.

#### Scenario: the project placed a real step after implement
- **WHEN** implement has settled
- **THEN** the forward action targets that step instead of disappearing

### Re-run and advance act on the spec's current step, never the document on screen
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

Re-running or advancing SHALL target the spec's recorded current step and record its start before dispatching, plus its completion when advancing.

#### Scenario: re-run is clicked from a supporting document
- **WHEN** the reader triggers a re-run while viewing a supporting document
- **THEN** the spec's current step is re-run and its start is recorded against that step

### Rendering a spec never writes over an unreadable record
<!-- touches: apps/vscode/src/features/spec-viewer/specViewerProvider.ts -->

When a spec's recorded context cannot be parsed, the viewer SHALL render from an in-memory stand-in and leave the file on disk untouched. Only the reader's accepted reset may replace it, and the open panel then refreshes onto the repaired record.

#### Scenario: the record is unreadable mid-write
- **WHEN** the record cannot be parsed during a render
- **THEN** the panel renders and the file on disk is unchanged

#### Scenario: the reader accepts a reset
- **WHEN** the reader chooses to reset a corrupt record
- **THEN** the open panel refreshes onto the repaired record

### A review comment is saved the moment it is added, edited or removed
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/src/features/spec-viewer/reviewComments.ts -->

Each comment change SHALL be written to the spec's record when the reader makes it, with no separate save step.

#### Scenario: the reader closes the panel right after commenting
- **WHEN** the spec is reopened
- **THEN** the comment is still there

### Comment changes to one spec apply in order, and one failure does not block the next
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

Comment changes for a spec SHALL apply one at a time in the order made. A change that fails SHALL NOT stop later ones from applying.

#### Scenario: two comments are added in quick succession
- **WHEN** the webview posts two comment changes back to back
- **THEN** both are saved, in order

### A comment change is refused when the spec's record cannot be read
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

A comment change SHALL NOT be written when the existing record cannot be parsed, so a corrupt record is never replaced by one holding only comments.

#### Scenario: the record is corrupt when a comment is added
- **WHEN** the reader adds a comment
- **THEN** the record on disk is unchanged

### Refinement edits the document in place and keeps the comments it sent
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

Dispatching a document's pending comments SHALL send a prompt that asks for targeted in-place edits and forbids regenerating the document from a template. The sent comments SHALL be marked applied, not deleted.

#### Scenario: refinement is dispatched for a document
- **WHEN** the reader sends a document's pending comments to the assistant
- **THEN** those comments read as applied in the record

### Refining a living spec sends its comments with the request
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

A living spec has no run record, so its comments SHALL travel with the refinement request, and the prompt SHALL name the tier file with the same in-place-edit instructions a run's document gets.

#### Scenario: refinement is dispatched from a living spec
- **WHEN** the reader refines a capability's tier document
- **THEN** the prompt carries the comments from the request and names the tier file

### Optional per-tab commands dispatch like the Command Palette, and a project override wins
<!-- touches: apps/vscode/src/features/spec-viewer/optionalCommands.ts -->

Clarify, Checklist and Analyze SHALL appear as built-in buttons on their own tab only, dispatching the same registered command the Command Palette runs, with no workflow opt-in required. A project-defined command sharing one's id SHALL be rendered and dispatched instead.

#### Scenario: a project defines its own Clarify command
- **WHEN** the spec tab's buttons are built
- **THEN** the project's command is shown and dispatched, not the built-in one

### A record write failure reaches the output channel, never the dispatch path
<!-- touches: apps/vscode/src/features/specs/specContextWriter.ts -->

A failure to write the spec's record SHALL be logged to the SpecKit output channel and SHALL NOT stop the step it accompanies from dispatching.

#### Scenario: the record cannot be written when a step is dispatched
- **WHEN** the write fails
- **THEN** the failure is logged and the step still dispatches

## Uncovered

_None: every file in the area was read, though test files under `__tests__/` were read only for the contracts they pin._
