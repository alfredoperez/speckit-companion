# Viewer UI Comments — Living Spec

<!-- reviewed: d589a63e -->

> Adopted from existing code on 2026-07-19 and split by concern on 2026-09-07. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How inline comments survive a re-render, reach the extension that owns them, and close once a spec settles.

## Requirements

### Comments survive re-render by re-anchoring, and the card speaks for where it sits

Persisted comments MUST be restored inline on every render and after every state change, and restoring MUST be idempotent so cards never duplicate. Anchoring is best-effort in a fixed order: the stored line when its content still matches, else any line matching the stored text, else the first line under the stored heading, else the stored line if it still exists. A comment that matches nothing stays in the consolidated list rather than being dropped. A restored card MUST describe the line it actually mounted on, never the stored anchor it started from.

#### Scenario: the document drifts by a line
- **WHEN** a comment's stored line no longer matches but its text is found elsewhere
- **THEN** the card mounts on the line where the text now lives
- **AND** the card reports that line, not the stored one

#### Scenario: a document switch replaces the rendered body
- **WHEN** new content renders
- **THEN** stale mounts are cleared before comments are re-anchored
- **AND** no comment is left pointing at a removed element

### Comment mutations are posted to the extension, which owns the record

Adding, editing or removing a comment MUST post the change to the extension rather than write anything, since the local card only renders the record. An edit that changes nothing, or has no target, SHALL be a no-op rather than a posted mutation. Dispatching refinement for a document MUST clear the local cards and let the refreshed record re-render them. A living spec has no run record, so its dispatch MUST carry the document's pending comments, or the request asks for nothing.

The structural line actions (remove a story, scenario, task, section or line) are also posted requests, not edits. They MUST be labelled as suggestions rather than removals, so the reader is never told a click deletes content.

#### Scenario: a comment is deleted
- **WHEN** the reader deletes a card
- **THEN** the removal is posted, the card unmounts, and focus returns to the line's own control
- **AND** the pending count updates

#### Scenario: refinement is dispatched for a living spec
- **WHEN** the reader submits the document's comments
- **THEN** the comments travel with the request rather than being looked up from a record that does not exist
- **AND** the local cards are cleared as they are for any other document

#### Scenario: a reader picks a structural line action
- **WHEN** the reader chooses to remove a story, scenario, task, section or line from its menu
- **THEN** the control reads as a suggestion, not a direct removal
- **AND** the request is posted for the AI to act on rather than editing the document in place

### A settled spec is readable but not annotatable

Once a spec is completed or archived, its comments MUST stay visible, but every path that creates or changes one SHALL be closed: the composer refuses to open and mounted cards render without action controls. This read-only decision SHALL follow the spec's live status, as the footer's actions do, and is re-evaluated when the status changes inside an open panel.

#### Scenario: a completed spec is opened
- **WHEN** the reader hovers a line
- **THEN** the composer does not open
- **AND** existing comments remain visible without edit or delete controls

#### Scenario: a spec settles while its panel is open
- **WHEN** the status becomes completed during the session
- **THEN** the annotation paths close in place
- **AND** the reader does not have to reopen the panel for it to take effect

## Uncovered

The original adoption did not read this file in full. Its exported surface and role were established, but its body was not reviewed line by line:

- `webview/src/spec-viewer/components/InlineEditor.tsx`
