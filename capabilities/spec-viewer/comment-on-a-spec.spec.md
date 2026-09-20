# Comment on a Spec — Living Spec

## Purpose

A person reviews a spec line by line inside the viewer, leaves the comments in the repository beside the spec, and hands the pending ones to the assistant as one edit request. Without this, review happens in a chat window that the branch does not carry and the assistant is asked to regenerate a document when all that was wanted was three corrections.

## Requirements

### A comment attaches to a line of the document
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/renderer.ts, apps/vscode/webview/src/spec-viewer/editor/inlineEditor.ts -->

Content the viewer renders line by line, such as paragraphs, headings, list items, tasks, quotes, requirement rows and acceptance scenarios, SHALL offer a comment button on hover, and the card SHALL sit directly under the line it annotates. Content rendered as a block rather than as lines, such as a code fence, a table or a diagram, carries no button, because there is no line for a comment to hold on to.

#### Scenario: a diagram
- **WHEN** the reader hovers a rendered Mermaid diagram
- **THEN** no comment button appears, and the heading or paragraph above it can be commented on instead

### The composer offers actions that suit the kind of line
<!-- touches: apps/vscode/webview/src/spec-viewer/editor/lineActions.ts, apps/vscode/webview/src/spec-viewer/editor/inlineEditor.ts -->

The composer SHALL read whether the line is a user story, a task, a section heading, an acceptance scenario or a paragraph, and offer the quick action that matches. A removal action SHALL write a suggestion into the comment text and change nothing in the document. The one action that changes the document is toggling a task's checkbox.

#### Scenario: suggesting a removal
- **WHEN** the reader picks the removal action on a user story
- **THEN** a comment asking for the story to be removed is added, and the story is still in the file

### A comment is stored beside the spec
<!-- touches: apps/vscode/src/features/spec-viewer/reviewComments.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

Adding, editing or deleting a comment SHALL be written into the spec's own run record, so the review is committed with the branch and reopening the tab shows it again. Comments for one spec SHALL be written one at a time, so a fast run of comments cannot lose one. When the run record is missing or cannot be read, the write is skipped and reported rather than replacing the record with a fresh one. Editing keeps the comment's place, its status and when it was written, and blank text changes nothing.

#### Scenario: several comments in quick succession
- **WHEN** four comments are typed on the same document faster than each write finishes
- **THEN** all four are in the run record

#### Scenario: the run record cannot be read
- **WHEN** a comment is added and the run record is unreadable
- **THEN** nothing is written and the reason is logged

### A stored comment finds the text it was written against
<!-- touches: apps/vscode/webview/src/spec-viewer/editor/reanchor.ts, apps/vscode/webview/src/spec-viewer/editor/restoreComments.ts -->

A comment SHALL record the block of text and the nearest heading it was written under, not only a line number, and on reopen SHALL be placed back on the line whose text still matches, falling back to the same text elsewhere in the document and then to the section it was written under. Re-rendering the same document SHALL not produce a second copy of a card. A comment that matches nothing inline is not lost: every comment for the spec is also listed with its status under the run log, grouped by document, with a way to jump to it and a way to refine that document's pending ones.

#### Scenario: the spec was edited above the comment
- **WHEN** paragraphs are inserted above a commented line and the document is reopened
- **THEN** the comment sits on the same sentence it was written against, at its new position

#### Scenario: the commented text is gone
- **WHEN** the block a comment was written against no longer appears in the document
- **THEN** no card is shown inline, and the comment is still listed under the run log

### Refine hands the document's pending comments over as one edit request
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/webview/src/spec-viewer/editor/refinements.ts -->

Refine SHALL send every pending comment on the document being read, never the review as a whole and never only the card it was pressed on, and SHALL ask the assistant to edit that one file in place rather than to regenerate it or run a setup script. Each comment SHALL travel with its line, the heading it sits under, and the source text it was written against. The control SHALL be hidden while nothing is pending and SHALL say how many comments are pending otherwise.

#### Scenario: pending comments on two documents
- **WHEN** the Spec has two pending comments, the Plan has one, and Refine is pressed while reading the Spec
- **THEN** one request goes out carrying the Spec's two comments

### A comment that was sent reads as sent, not as done
<!-- touches: apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/webview/src/spec-viewer/components/InlineComment.tsx -->

Once a comment has been handed to the assistant it SHALL be marked applied and kept as history rather than deleted, and applied means the request was sent. The viewer never reads the file back to confirm the edit landed, so an applied comment is not a claim that the document changed. Deleting a comment removes it from the record entirely and is not how a handled comment is closed.

#### Scenario: after Refine
- **WHEN** the request has been dispatched
- **THEN** each dispatched card reads Applied and stays visible

### A closed spec keeps its review as a record
<!-- touches: apps/vscode/webview/src/spec-viewer/editor/readOnly.ts, apps/vscode/webview/src/spec-viewer/components/InlineComment.tsx -->

A completed or archived spec SHALL still render its comments with their text and status, and SHALL offer no way to add, edit, delete or refine them.

#### Scenario: reading a finished spec
- **WHEN** an archived spec is opened and a comment card is expanded
- **THEN** the text and its state are shown with no actions beside them
