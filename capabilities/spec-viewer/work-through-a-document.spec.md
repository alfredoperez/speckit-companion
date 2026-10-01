# Work Through a Document — Living Spec

<!-- reviewed: aebf4657 -->

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

A path written in backticks whose extension is one the viewer recognises SHALL render as a control that opens that file in the editor group beside the viewer, showing the short name and the full path on hover. Every file opened from the page goes to that same group, so repeated clicks never split the editor again. A path with no match in the workspace SHALL say so rather than failing silently, and text in backticks that is not a file path stays ordinary code.

#### Scenario: a path in the plan
- **WHEN** the plan names a source file in backticks and the reader clicks it
- **THEN** that file opens in an editor beside the viewer

#### Scenario: a file that is not in the workspace
- **WHEN** the named file cannot be found
- **THEN** the reader is told it is not in the workspace

### A link to another document opens that document
<!-- touches: apps/vscode/webview/src/spec-viewer/documentLinks.ts, apps/vscode/webview/src/spec-viewer/markdown/inline.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

A link in a document to another document of the same spec SHALL open that document in the viewer, and a link with a heading fragment SHALL scroll to that heading once the document has rendered. A link that is only a fragment SHALL scroll within the current document. A link to a document of another spec SHALL open that spec in the viewer, the same as clicking it in the sidebar, never as raw markdown. A link to any other file opens it in the editor group beside the viewer, reusing that group on every click, and a web link is left to the editor to open.

#### Scenario: a plan that points at the tasks
- **WHEN** the reader clicks a link to the tasks document in a one-line plan
- **THEN** the viewer switches to the tasks document

#### Scenario: a link to a section of another document
- **WHEN** the reader clicks a link to a heading in the spec from the plan
- **THEN** the spec opens scrolled to that heading

#### Scenario: a link to another spec
- **WHEN** the reader clicks a link to another spec's spec.md
- **THEN** that spec opens in its own viewer tab, as it does from the sidebar

#### Scenario: a link to a source file, clicked twice
- **WHEN** the reader clicks a link to a source file, goes back to the viewer and clicks it again
- **THEN** both clicks open the file in the one group beside the viewer and no third group appears

### A checkbox in a bug report never changes the report
<!-- touches: apps/vscode/webview/src/spec-viewer/actions.ts, apps/vscode/webview/src/spec-viewer/editor/readOnly.ts -->

Clicking a checkbox in an open bug report SHALL leave the box as the report file has it and leave the file unchanged. Completed and archived specs are not read-only in this sense: their task boxes still tick through to the file.

#### Scenario: a checkbox inside a bug report
- **WHEN** a checkbox in an open bug report is clicked
- **THEN** it snaps back to its state on disk and the report file is not changed

#### Scenario: a checkbox in a completed spec
- **WHEN** a task box is ticked in the viewer on a completed spec
- **THEN** its line in the tasks file is marked done
