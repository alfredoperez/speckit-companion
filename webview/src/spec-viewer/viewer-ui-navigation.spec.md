# Viewer UI Navigation — Living Spec

<!-- reviewed: d589a63e -->

## Purpose

How the reader moves between the Overview, the pipeline documents and their artifacts without the page reloading or losing what they had open.

## Requirements

### The viewer is one page whose content is swapped, never reloaded

Moving between documents, or between the Overview and a document, SHALL swap content in place and keep the reader's current view, mounted comments and scroll position. A path that makes the host regenerate the page loses that state and bounces the reader to the landing view.

#### Scenario: a document is picked while the Overview is showing
- **WHEN** the reader selects a pipeline document from the rail
- **THEN** the document renders and the reader is not snapped back to the Overview

#### Scenario: the reader switches back to the Overview
- **WHEN** the Overview is re-selected
- **THEN** it appears immediately, without re-rendering

### Opening the spec lands on the Overview, opening a document lands on that document

What shows on open SHALL be decided by what was opened: the Overview for the spec itself, the document for any document, step or artifact row. This SHALL outrank the reader's earlier pick in the same panel.

#### Scenario: a document row is opened on a spec that has been run
- **WHEN** the viewer opens
- **THEN** it lands on that document

#### Scenario: the spec name is clicked after documents have been read in that panel
- **WHEN** the spec itself is opened again
- **THEN** it lands on the Overview, not on the document last read

### Exactly one rail item reads as current

The Overview SHALL be a rail destination alongside the documents, so selecting any item deselects every other.

#### Scenario: a document is picked while the Overview is selected
- **WHEN** the reader picks it
- **THEN** the Overview deselects and only that document reads as current

### The Overview is offered only for a spec with recorded activity

The Overview SHALL NOT be offered when the spec has no recorded activity or the reader has turned the Activity panel off.

#### Scenario: the Activity panel setting is off
- **WHEN** a spec opens
- **THEN** the rail has no Overview and the viewer lands on the document

### The pipeline rail lists document-producing steps only

The rail SHALL list only steps that produce a document of their own, so Implement, Mark Complete or a custom step with no document never appear. A hidden step SHALL neither shift nor lock a tab, even while it runs.

#### Scenario: an acting step is the running step
- **WHEN** a step with no document of its own is in flight
- **THEN** it does not appear in the rail and locks none of the document tabs

### A step's artifact files nest under it in the rail

Each step's artifact documents SHALL render as an indented sub-list under that step. A document belongs to the step it names as its parent, or to the first pipeline step when it names none.

#### Scenario: a step produced artifact documents
- **WHEN** a visible step owns related documents
- **THEN** they render as indented sub-items under that step

#### Scenario: an artifact sub-item is selected
- **WHEN** the reader clicks it
- **THEN** that document opens and reads as current, while clicking the parent step still opens the step's own document

### An artifact whose step is not in the rail is still reachable

An artifact whose owning step has no rail entry SHALL render in a labelled fallback group, so no artifact is dropped.

#### Scenario: an artifact belongs to a hidden step
- **WHEN** the rail renders
- **THEN** the artifact appears in the fallback group

### A narrow pane folds the rail into a strip that keeps each step beside its files

Below the rail's fold width, the rail SHALL become a horizontally scrolling strip where each step and its artifact chips form one inline unit, with a divider between units.

#### Scenario: the pane is too narrow for a vertical rail
- **WHEN** the container falls below the fold width
- **THEN** each step reads beside its own files rather than colliding with the next step

### A control that mounts late still responds to clicks

A control that appears after the page's scripts ran SHALL respond to clicks the same as one present at load.

#### Scenario: a requirement card's Remove renders after a redraw
- **WHEN** the reader clicks it
- **THEN** the removal request is posted

## Uncovered

_None recorded by the original adoption for this concern._
