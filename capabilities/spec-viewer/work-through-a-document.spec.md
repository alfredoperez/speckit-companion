# Work Through a Document — Living Spec

## Purpose

A spec document is long, and a person reading one needs to jump to a section, come back to where they were, tick off work as it lands, and open the files the text names. Without this the viewer is a wall of prose that has to be re-scrolled every time it is opened and every file it mentions has to be found by hand.

## Requirements

### An outline of the document sits beside it and follows the reader
<!-- touches: apps/vscode/webview/src/spec-viewer/toc.ts -->

The viewer SHALL list the document's section headings beside it and mark the one being read. Top-level sections show by default and a control adds the level below them, a choice that holds while the viewer stays open, across document switches. Headings that are instructions rather than places to go SHALL be left out, so the outline reads as places to jump to. A document with nothing to navigate between shows no outline.

#### Scenario: scrolling down
- **WHEN** the reader scrolls a long plan
- **THEN** the outline entry for the section on screen is marked as the current one

#### Scenario: a document with one section
- **WHEN** the document has a single heading
- **THEN** no outline is shown

### A narrow pane folds the outline above the document instead of dropping it
<!-- touches: apps/vscode/webview/src/spec-viewer/toc.ts -->

When the reading column is too narrow for a side column, the outline SHALL become a compact disclosure above the document carrying the same entries and the same tracking, rather than disappearing.

#### Scenario: the panel is dragged narrow
- **WHEN** the viewer is resized below the width a side column needs
- **THEN** the outline moves above the document as a disclosure

### The viewer keeps the reader's place
<!-- touches: apps/vscode/webview/src/spec-viewer/index.tsx -->

A viewer tab SHALL come back to the scroll position it was left at when it is restored, so a tab that VS Code reloads in the background does not send the reader back to the top of the document.

#### Scenario: a reloaded tab
- **WHEN** a tab left halfway down the tasks document is restored
- **THEN** it reopens at that position

### Ticking a task in the viewer writes through to the file
<!-- touches: apps/vscode/webview/src/spec-viewer/actions.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

Ticking or clearing a task's checkbox SHALL rewrite that task's line in the file on disk and save it, so the viewer and the file never disagree. The counts the viewer derives from the boxes, on the rail entry and on each section's progress, SHALL update on the same click rather than waiting for the file to be read back.

#### Scenario: ticking a task
- **WHEN** a task is ticked in the viewer
- **THEN** its line in the tasks file is marked done and the completion counts move immediately

### A file the document names opens from the page
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/inline.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

A path written in backticks whose extension is one the viewer recognises SHALL render as a control that opens that file beside the viewer, showing the short name and the full path on hover. A path with no match in the workspace SHALL say so rather than failing silently, and text in backticks that is not a file path stays ordinary code.

#### Scenario: a path in the plan
- **WHEN** the plan names a source file in backticks and the reader clicks it
- **THEN** that file opens in an editor beside the viewer

#### Scenario: a file that is not in the workspace
- **WHEN** the named file cannot be found
- **THEN** the reader is told it is not in the workspace
