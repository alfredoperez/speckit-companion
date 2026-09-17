# Viewer UI Navigation — Living Spec

<!-- reviewed: d589a63e -->

> Adopted from existing code on 2026-07-19 and split by concern on 2026-09-07. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How the reader moves between the overview, the pipeline documents and their artifacts without the page reloading. It keeps what the reader had open, and stops a hidden step from shifting or locking a tab it never owned.

## Requirements

### The viewer is one page whose content is swapped, never reloaded

The webview MUST behave as one long-lived page. Navigation between documents, and between the overview and the documents, SHALL swap content in place and keep the shell's in-memory state: the current view, mounted comments and scroll memory. Any new navigation path must preserve this, because a path that makes the host regenerate the page loses that state and bounces the reader to the landing view.

#### Scenario: a document is picked while the overview is showing
- **WHEN** the reader selects a pipeline document from the rail
- **THEN** the document renders and the overview is hidden
- **AND** the reader is not snapped back to the overview

#### Scenario: the reader switches back to the overview
- **WHEN** the overview is re-selected
- **THEN** it appears immediately, because the document pane was hidden, not unmounted

### The step order and the document vocabulary have one declaration

The canonical step order and the document types the protocol names SHALL be imported from the shared contract, never restated in a component. A missed copy renders a step out of order or not at all.

#### Scenario: a step is added to the canonical order
- **WHEN** the shared contract changes
- **THEN** every surface that orders steps picks it up with no edit of its own

### Overview and documents are one selection axis

The overview MUST be a destination alongside the documents, not a mode layered over them. The entry point, not the data, decides what shows on open: the Overview when the spec itself is opened, and its document for any document, step or artifact row. After that the reader's pick wins, and a pick of the Overview is reported to the extension as the Overview, because an empty field falls back to the document. The entry point's decision MUST outrank an earlier pick, so clicking the spec name lands on the Overview even in a panel already used to read documents. The extension holds the one record of what is showing, and that record MUST survive the render it triggers. The webview's copy is an optimistic echo and MUST be dropped whenever a fresh decision arrives. The overview MUST mount lazily on first reveal, and MUST NOT be offered for a spec with no recorded run or when the reader has turned it off.

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

The rail MUST list only steps that produce a document of their own, so acting steps such as Implement, Mark Complete or a custom step with no document never appear. Every index the rail computes (its root phase, the host of the live implement percent, the in-flight step that locks later tabs) MUST be computed against the rendered list. A hidden acting step therefore neither shifts nor locks a tab, even while it runs.

#### Scenario: an acting step is the running step
- **WHEN** a step with no document of its own is in flight
- **THEN** it does not appear in the rail
- **AND** it locks none of the document tabs

### A step's artifact files nest under it in the rail

Each step's artifact documents MUST render as an indented sub-list directly under that step in the rail, not in separate per-step groups below it. A document belongs to the step it names as its parent, or to the first pipeline step when it names none. An artifact whose owning step has no rail entry (a hidden acting step, or a step missing from the workflow) MUST still render in a labeled fallback group, so no artifact is dropped.

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
- **THEN** the rail folds into a horizontally-scrolling strip where each step and its artifact chips form one inline unit, with a divider between units
- **AND** a step reads beside its own files rather than colliding with the next step's column

### Delegated click handling must survive non-element targets and late mounts

Handlers delegated from the document MUST confirm the event target is an element before walking up from it. Any control that mounts after the page's scripts run MUST be handled by delegation, because a binding made at load silently does nothing for a control that does not exist yet.

#### Scenario: a click lands on a non-element target
- **WHEN** the delegated handler receives it
- **THEN** it returns without throwing

## Uncovered

_None recorded by the original adoption for this concern._
