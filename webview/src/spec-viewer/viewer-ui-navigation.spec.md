# Viewer UI Navigation — Living Spec

> Adopted from existing code on 2026-07-19 and split by concern on 2026-09-07. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

This is how the reader moves between the overview, the pipeline documents and their artifacts without the page reloading under them. Without it every switch would reset what the reader had open, and a hidden step could shift or lock a tab it never owned.

## Requirements

### The viewer is one page whose content is swapped, never reloaded

The webview MUST behave as a single long-lived page. Navigation between documents, and between the overview and the documents, SHALL swap content in place and leave the shell's in-memory state — the reader's current view, mounted comments, scroll memory — intact. Any new navigation path must preserve this: a path that causes the host to regenerate the page loses that state and bounces the reader back to whatever the landing rule picks.

#### Scenario: a document is picked while the overview is showing
- **WHEN** the reader selects a pipeline document from the rail
- **THEN** the document renders and the overview is hidden
- **AND** the reader is not snapped back to the overview

#### Scenario: the reader switches back to the overview
- **WHEN** the overview is re-selected
- **THEN** it appears immediately because the document pane was hidden rather than unmounted

### The step order and the document vocabulary have one declaration

The canonical order of pipeline steps and the document types the protocol names SHALL be imported from the shared contract, never restated in a component. The step order had been copied into three places, so adding a step meant finding all three, and a missed copy renders a step out of order or not at all.

#### Scenario: a step is added to the canonical order
- **WHEN** the shared contract changes
- **THEN** every surface that orders steps picks it up with no edit of its own

### Overview and documents are one selection axis

The overview MUST be a destination alongside the documents, not a mode layered over them, so selection can never get stuck between the two. Which one is shown on open is decided by the entry point, not by the data: the Overview only when the spec itself was opened, its document for any document, step or artifact row — a data-derived default resolved to the Overview for every spec that had ever run, and every document row in the tree lost to it. The reader's pick wins after that, and a pick of the Overview is reported to the extension **as the Overview**, not as an absence of choice: a cleared field falls back to the document for any spec that has run, which is the same silent default this requirement exists to prevent. The entry point's decision MUST outrank a pick the reader made earlier, so a later click on the spec name lands on the Overview even in a panel that has already been used to read documents. There is one record of which is showing, held by the extension; anything the webview keeps is an optimistic echo of it and MUST be dropped whenever a fresh decision arrives, or the first document a panel showed becomes its answer for the panel's whole life. The overview MUST mount lazily on first reveal so it never delays the first document render, and MUST NOT be offered at all for a spec with no recorded run or when the reader has turned it off.

#### Scenario: a spec with only a work log
- **WHEN** the viewer opens
- **THEN** it lands on the document
- **AND** the overview remains reachable from the rail

#### Scenario: any rail item is selected
- **WHEN** the reader picks a document
- **THEN** the overview deselects
- **AND** exactly one rail item reads as current

#### Scenario: a document row is opened on a spec that has been run
- **WHEN** the viewer opens
- **THEN** it lands on that document

#### Scenario: the spec itself is opened
- **WHEN** the viewer opens
- **THEN** it lands on the Overview

#### Scenario: the spec name is clicked after documents have been read in that panel
- **WHEN** the spec itself is opened again
- **THEN** it lands on the Overview, not on the document last read

### The pipeline rail lists document-producing steps only

The rail MUST render only steps that produce a document of their own; steps that merely act — Implement, Mark Complete, any custom step with no document — never appear as rail entries. Every index the rail computes — its root phase, the host of the live implement percent, the in-flight step that locks later tabs — MUST be computed against the rendered list, so a hidden acting step can neither shift a tab nor lock one. An acting step that is running therefore contributes no lock, because it holds no rail position to lock from.

#### Scenario: an acting step is the running step
- **WHEN** a step with no document of its own is in flight
- **THEN** it does not appear in the rail
- **AND** it locks none of the document tabs

### A step's artifact files nest under it in the rail

Each pipeline step's related artifact documents MUST render as an indented sub-list directly beneath that step in the rail, not in separate per-step groups below it. A step owns a related document when the document names it as its parent step; a document with no parent step falls back to the first pipeline step. An artifact whose owning step has no rail entry — a hidden action step, or a step absent from the workflow — MUST still render in a labeled fallback group so no artifact is dropped.

#### Scenario: a step produced artifact documents
- **WHEN** a visible step owns one or more related documents
- **THEN** those documents render as indented sub-items under that step
- **AND** no separate "<step> files" group renders for them below the rail

#### Scenario: an artifact belongs to a hidden step
- **WHEN** a related document's owning step is not shown in the rail
- **THEN** the document renders in a labeled fallback group so it stays reachable

#### Scenario: an artifact sub-item is selected
- **WHEN** the reader clicks a nested artifact sub-item
- **THEN** the viewer switches to that document and the sub-item reads as current
- **AND** clicking the parent step still opens the step's own document

#### Scenario: the pane is too narrow for a vertical rail
- **WHEN** the container falls below the rail's fold width
- **THEN** the rail folds into a horizontally-scrolling strip where each step and its own artifact chips form one inline unit, with a divider between units
- **AND** a step reads beside its own files rather than colliding with the next step's column

### Delegated click handling must survive non-element targets and late mounts

Handlers that delegate from the document MUST confirm the event target is an element before walking up from it, since it can be neither. Delegation — rather than binding to an element at load — is also required for any control that mounts after the page's scripts run, because a direct binding would silently no-op against a control that does not exist yet.

#### Scenario: a click lands on a non-element target
- **WHEN** the delegated handler receives it
- **THEN** it returns without throwing

## Uncovered

_None recorded by the original adoption for this concern._
