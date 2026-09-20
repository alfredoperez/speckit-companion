# Webview safety — Living Spec

## Purpose

Every panel this extension draws shows text a person did not write: the words in a spec document, the name of a file someone attached, a version string in a banner, a step's own note from the run record. A repository the reader merely opened can carry any of it. This is its own capability because no single panel owns the rule: the viewer, the editor and the builder each render text from outside, each dropped the rule independently, and a reader who opens an untrusted repository is protected only if all of them hold it. What follows is what stays true wherever that text reaches a panel.

## Requirements

### Text from outside is read as words, never as markup
<!-- touches: apps/vscode/webview/src/spec-viewer/**, apps/vscode/webview/src/spec-editor/**, apps/vscode/webview/src/pipeline-builder/**, apps/vscode/src/features/spec-viewer/html/** -->

Text that came from a document, a filename, a run record or a version string SHALL reach a panel as characters to read and never as markup to run. A document carrying a tag or a script SHALL show that tag as visible text, exactly as the file has it. Opening a repository SHALL never be enough to run something the reader did not ask for.

#### Scenario: a spec carries a script
- **WHEN** a reader opens a spec whose text contains a script tag
- **THEN** the panel shows the tag as words in the document and nothing runs

#### Scenario: a run record names a file oddly
- **WHEN** a step's record names a file whose name contains angle brackets
- **THEN** the name is shown as typed

### Text from outside never lands inside a tag through string building
<!-- touches: apps/vscode/webview/src/spec-editor/**, apps/vscode/webview/src/spec-viewer/**, apps/vscode/src/features/spec-viewer/html/** -->

Where outside text becomes part of a panel's own tag, such as an image's description or a button's stored filename, it SHALL be set on the element itself rather than pasted into a string of markup. A quote, an apostrophe or a bracket in that text SHALL stay part of the value and never close the tag it sits in.

#### Scenario: an attached image has a quote in its name
- **WHEN** a reader attaches an image whose filename contains a double quote
- **THEN** the thumbnail's description holds the whole name and no new element appears

#### Scenario: a code span names a path with a quote
- **WHEN** a document mentions a path containing a quote inside backticks
- **THEN** the path renders in full and the surrounding tag stays closed

### A link that points at a script does nothing
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/**, apps/vscode/webview/src/spec-viewer/** -->

A link or an image in a document SHALL only ever point somewhere a reader can safely be sent. A target that asks the panel to run something instead of going somewhere SHALL render inert: the link's words still show, and following it does nothing.

#### Scenario: a document links to a script target
- **WHEN** a reader clicks a link whose target is a script URL
- **THEN** nothing runs and the reader stays where they were

### Fenced content is made safe before anything renders it
<!-- touches: apps/vscode/webview/src/spec-viewer/markdown/**, apps/vscode/webview/src/spec-viewer/highlighting.ts -->

Code and diagrams fenced inside a document SHALL be neutralised as they are placed on the page, before colouring or diagram drawing looks at them. A colouring or drawing pass SHALL therefore only ever see text, and a diagram that fails to draw SHALL leave its source showing as words rather than as markup.

#### Scenario: a fenced block holds markup
- **WHEN** a document fences a block of HTML
- **THEN** the block shows as coloured code and none of it becomes part of the page

#### Scenario: a diagram will not draw
- **WHEN** a fenced diagram is malformed
- **THEN** its source stays on the page as plain text

## Uncovered

- A markdown link's target is not checked today: a script URL is written into the link as given, and a quote in the target closes the link's own tag. Both scenarios under "A link that points at a script does nothing" fail on current code.
- Nothing prevents a new panel from building markup by hand. The rule is held by review, not by a check.
