# Viewer UI Comments — Living Spec

<!-- reviewed: d589a63e -->

## Purpose

How inline comments survive a re-render, what the reader's comment actions send to the extension, and when a spec stops taking comments.

## Requirements

### Comments survive re-render by re-anchoring, and the card speaks for where it sits

Saved comments SHALL be restored inline after every render and state change, never as duplicate cards, and a document switch SHALL clear the old mounts before re-anchoring.

#### Scenario: the panel re-renders twice
- **WHEN** each saved comment is restored
- **THEN** each has exactly one card

#### Scenario: a document switch replaces the rendered body
- **WHEN** the new content renders
- **THEN** no comment is left pointing at a removed element

### A comment follows its text when the document shifts

A comment SHALL mount on its stored line when that line still matches, else on a line matching its stored text, else on the first line under its stored heading, else on the stored line if it still exists.

#### Scenario: the document drifts by a line
- **WHEN** a comment's stored line no longer matches but its text is found elsewhere
- **THEN** the card mounts on the line where the text now lives

### A comment that matches no line stays in the list

A comment none of the anchoring steps can place SHALL remain in the consolidated comment list rather than be dropped.

#### Scenario: the commented section was deleted
- **WHEN** the document renders
- **THEN** the comment is still listed

### A restored card names the line it mounted on

A card SHALL describe the line it actually sits on, never the stored anchor it started from.

#### Scenario: a comment moved with its text
- **WHEN** the card renders on its new line
- **THEN** the card reports the new line number

### An edit that changes nothing sends nothing

Saving a comment whose trimmed text is empty or unchanged SHALL post no change to the extension.

#### Scenario: the reader saves an edit without changing it
- **WHEN** the editor closes
- **THEN** no edit is posted

### Deleting a card returns focus to its line

Deleting a comment SHALL unmount its card, update the pending count and return focus to the line's own comment control.

#### Scenario: a comment is deleted from the keyboard
- **WHEN** the reader deletes the card
- **THEN** focus lands on that line's comment control

### Sending comments for refinement clears the local cards

Dispatching refinement for a document SHALL clear its local cards and let the refreshed record render them again.

#### Scenario: the reader sends a document's comments
- **WHEN** refinement is dispatched
- **THEN** the cards clear until the extension's refresh arrives

### Structural line actions are offered as suggestions

The remove actions on a story, scenario, task, section or line SHALL read "Suggest removing …" and post a request for the assistant, never edit the document in place.

#### Scenario: a reader opens a task's line menu
- **WHEN** the menu renders
- **THEN** it offers "Suggest removing task", and choosing it leaves the document unchanged

### A settled spec is readable but not annotatable

Once a spec is completed or archived its comments SHALL stay visible, the composer SHALL NOT open, and cards SHALL render without edit or delete controls.

#### Scenario: a completed spec is opened
- **WHEN** the reader hovers a line
- **THEN** the composer does not open and existing comments show without controls

### Annotation closes in place when a spec settles

The read-only decision SHALL follow the spec's live status, so a spec that settles while open stops taking comments without a reopen.

#### Scenario: a spec settles while its panel is open
- **WHEN** the status becomes completed
- **THEN** the composer no longer opens in that panel

## Uncovered

The original adoption did not read this file in full. Its exported surface and role were established, but its body was not reviewed line by line:

- `webview/src/spec-viewer/components/InlineEditor.tsx`
