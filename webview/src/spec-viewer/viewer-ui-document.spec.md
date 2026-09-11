# Viewer UI Document — Living Spec

<!-- reviewed: d589a63e -->

> Adopted from existing code on 2026-07-19 and split by concern on 2026-09-07. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

This is the rendering pipeline that turns a spec's markdown into a document a person can read, annotate and navigate by requirement. Without it the viewer would show formatted text nobody can point at, and document text could reach the page as live markup.

## Requirements

### Rendered markdown is a commentable document, not just formatted text

The rendering pipeline MUST emit each source line as an addressable, hoverable unit carrying its own line number and an affordance to attach a comment, so annotation works anywhere in the document without a separate mode. Authoring scaffolding that belongs to the generator rather than the reader — front matter, notation legends, metadata already shown in the header — SHALL be stripped rather than rendered. Structured passages the specs use repeatedly (user stories, phased task lists, requirement blocks, acceptance scenarios, callouts) SHOULD be recognised and rendered as their own components rather than as generic prose, and those components stay commentable too.

The attach-a-comment affordance MUST name the specific line it targets in its accessible label rather than carrying a generic one, so that identical controls repeated down the document are distinguishable to assistive technology; the glyph inside it is decorative and MUST be hidden from that tree.

#### Scenario: a line's comment affordance is reached without a pointer
- **WHEN** the reader tabs to a line's add-comment control
- **THEN** it announces the particular line it will annotate, not a generic "add comment"
- **AND** the glyph inside it is hidden from assistive technology

#### Scenario: a document written with foreign line endings
- **WHEN** the source uses carriage returns
- **THEN** line endings are normalised before any block-level parsing
- **AND** the document renders as structure, not as one long paragraph

#### Scenario: the header already shows the spec's metadata
- **WHEN** the state carries the spec's identity
- **THEN** the document's own metadata block is stripped from the rendered body
- **AND** the reader does not see the same facts twice

### User text must never reach an HTML attribute unescaped

Markup that carries content from the document — a link target, an image description, a file reference, a title — MUST be built so the value cannot terminate the attribute it sits in. The escaping used for element *content* does not escape attribute quotes and is not sufficient here; such markup SHALL be assembled with DOM APIs, or escaped with an attribute-safe routine. The content policy is not a substitute for this and MUST NOT be relied on as one.

A destination taken from the document — a link target, an image source — MUST additionally be restricted to schemes that are safe to navigate to or load. A destination carrying a script-executing scheme SHALL NOT render as an active link or a loading image; it is rendered as inert text instead.

#### Scenario: a document contains a quote inside a file reference
- **WHEN** the value is placed into an attribute
- **THEN** the quote cannot close the attribute
- **AND** no additional attribute or handler can be introduced from document text

#### Scenario: a link points at a script-executing destination
- **WHEN** the document supplies a `javascript:` target
- **THEN** it is not rendered as an activatable link
- **AND** nothing the reader can click executes it

### A living spec is navigable by requirement

A living spec SHALL be navigable by requirement from the viewer's existing document outline, not from a second one built beside it — the viewer already has a sticky outline with scroll, active-heading tracking, and a narrow-pane fallback, and a second one puts two indexes of the same headings side by side on a wide pane. Because a living spec's requirements are its subsection headings, that outline SHALL list them by default rather than behind the subsections toggle a feature spec needs. Each row SHALL show that requirement's coverage where it is known and as unknown where it is not, never as zero, and the number of path patterns its marker names where it carries one — patterns, not files, since one entry can claim a whole directory and calling that a file count is a number the reader can check and find wrong. Those marks SHALL be drawn and hidden from assistive technology, with the row's single accessible name saying what they mean in words: a dot carrying only a tooltip is not reliably announced, and a bare number beside a heading says nothing. The outline SHALL read what it shows off the rendered requirement cards, never by parsing the document again. A feature spec's outline is unchanged.

#### Scenario: a large living spec is opened
- **WHEN** it renders
- **THEN** every requirement appears once in the outline, in document order, without the reader turning on subsections

#### Scenario: a requirement appended past the uncovered-files section
- **WHEN** the cards and the outline are built
- **THEN** it is a card and a row like any other, because fold-back appends to the end of the file and where a requirement sits says nothing about whether it is one
- **AND** the uncovered section between them is left outside every card rather than swallowed into the one above it

#### Scenario: a requirement whose coverage was never computed
- **WHEN** its row renders
- **THEN** it reads as unknown rather than as zero, which would mean none

#### Scenario: a heading inside a fenced block
- **WHEN** the cards and the outline are built
- **THEN** it is neither a card nor a row, matching what every other reader counts

#### Scenario: a file marker outside a requirement card
- **WHEN** any document renders, living or not, carrying a marker no requirement pass consumed
- **THEN** nothing is drawn for it, because a marker is metadata and printing a comment's own source is not a rendering

#### Scenario: the outline reaches the page
- **WHEN** the document renders through the full pipeline rather than the outline pass alone
- **THEN** the outline is live markup the stylesheet applies to, and a requirement's file marker is metadata the reader never sees as prose or as a template disclosure

### The viewer can be told which requirement to bring into view

The viewer SHALL accept a requirement heading from the extension and scroll the matching requirement into view, honouring the reader's reduced-motion preference. A heading matching no rendered requirement SHALL leave the scroll position untouched. Being told to reveal a requirement is also a decision about which pane is showing: the document comes to the front, because scrolling a document the reader cannot see reveals nothing.

#### Scenario: the named requirement is on the page
- **WHEN** the viewer is told to reveal it
- **THEN** that requirement is scrolled into view

#### Scenario: the overview is showing when a requirement is revealed
- **WHEN** the extension names a requirement
- **THEN** the pane switches to the document before the requirement is brought into view

### An adopted requirement says where it came from, and can be approved in place

A requirement carrying an `adopted:` marker was transcribed by adoption from the project's own conventions and nothing has checked it since. Its card MUST say so and name the source it was transcribed from, so a reader can go and confirm it, and MUST offer an approval control that drops the marker for that requirement alone. The marker sits with the file marker at the top of the block in either order, and only the run of markers before the first ordinary line is consumed — filtering the whole block would delete a line further down that the outline's count, and both slicers, still read as prose. What reaches the card's attributes is a bare flag, never the transcribed source string, because the escaping used for element content does not escape attribute quotes.

#### Scenario: a requirement was transcribed by adoption
- **WHEN** its card renders
- **THEN** it names the source it was adopted from and offers an approval control for that requirement

#### Scenario: an adopted requirement is approved
- **WHEN** the reader picks that control
- **THEN** the heading it is keyed on is posted to the extension, which owns the change to the file

#### Scenario: the heading matches nothing rendered
- **WHEN** the viewer is told to reveal it
- **THEN** the document stays where the reader left it

## Uncovered

The following files were not read in full by the original adoption — their exported surface and role were established, but their bodies were not reviewed line by line:

- `webview/src/spec-viewer/markdown/preprocessors.ts` (read partially; only the first ~60 lines and the export inventory)
- `webview/src/spec-viewer/toc.ts`
- `webview/src/spec-viewer/highlighting.ts`
