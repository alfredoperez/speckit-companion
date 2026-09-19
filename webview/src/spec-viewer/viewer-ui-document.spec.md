# Viewer UI Document — Living Spec

<!-- reviewed: d589a63e -->

## Purpose

How the webview turns a spec's markdown into a document the reader can annotate line by line, without letting document text reach the page as live markup.

## Requirements

### Rendered markdown is a commentable document, not just formatted text

Every rendered source line SHALL carry its line number and an add-comment control, so annotation works anywhere without a separate mode.

#### Scenario: the reader hovers any line
- **WHEN** the pointer rests on it
- **THEN** that line's add-comment control appears

### The add-comment control names its line

Each add-comment control's accessible label SHALL name the line it annotates, and its glyph SHALL be hidden from assistive technology.

#### Scenario: a line's comment control is reached without a pointer
- **WHEN** the reader tabs to it
- **THEN** it announces the particular line, not a generic "add comment"

### A document with carriage-return line endings renders as structure

Line endings SHALL be normalised before any block-level parsing.

#### Scenario: a document written with Windows line endings
- **WHEN** it renders
- **THEN** its headings and lists render as structure, not as one long paragraph

### Metadata the header already shows is not repeated in the body

Front matter, notation legends and the document's own metadata block SHALL be stripped from the rendered body when the header carries the spec's identity.

#### Scenario: a spec with a metadata block is opened
- **WHEN** the body renders
- **THEN** the metadata facts appear only in the header

### User text must never reach an HTML attribute unescaped

Document text placed into an attribute (a link target, image description, file reference or title) SHALL be built so it cannot end the attribute, because element-content escaping does not escape quotes. The content policy is not a substitute.

#### Scenario: a document contains a quote inside a file reference
- **WHEN** the reference renders
- **THEN** no attribute or handler is added from the document text

### A document link cannot run script

A link target or image source from the document SHALL render active only when its scheme is safe to navigate to or load. A script-executing destination SHALL render as inert text.

#### Scenario: a link points at a `javascript:` target
- **WHEN** the document renders
- **THEN** the link is plain text and nothing the reader clicks executes it

### Rendered documents stay addressable back to their source lines

Every editable line carries its source line number, and an edit acts on that number, never on the rendered DOM, which is a lossy projection of the file.

#### Scenario: a line is edited in place
- **WHEN** the user commits an inline edit
- **THEN** the webview sends the source line number and the new plain text
- **AND** the extension, not the webview, rewrites the file

#### Scenario: a region the user cannot act on
- **WHEN** the document has a fenced block or a horizontal rule
- **THEN** it renders without a per-line comment or edit control

### Fenced content renders as text, never as live markup

Highlighting and diagrams run after the escaped text is in the DOM.

#### Scenario: a fence contains markup
- **WHEN** a spec has HTML or script text inside a code fence
- **THEN** it shows as code and nothing in it runs

#### Scenario: a fence declares an unusual language
- **WHEN** the language token is arbitrary text, quotes included
- **THEN** it cannot add an attribute or element to the code block

## Uncovered

The original adoption did not read these files in full. Their exported surface and role were established, but their bodies were not reviewed line by line:

- `webview/src/spec-viewer/markdown/preprocessors.ts` (read partially; only the first ~60 lines and the export inventory)
- `webview/src/spec-viewer/toc.ts`
- `webview/src/spec-viewer/highlighting.ts`
