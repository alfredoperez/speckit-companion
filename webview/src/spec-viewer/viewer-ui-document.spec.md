# Viewer UI Document — Living Spec

<!-- reviewed: d589a63e -->

> Adopted from existing code on 2026-07-19 and split by concern on 2026-09-07. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The rendering pipeline that turns a spec's markdown into a document a person can read, annotate and navigate by requirement, without letting document text reach the page as live markup.

## Requirements

### Rendered markdown is a commentable document, not just formatted text

The pipeline MUST emit each source line as an addressable, hoverable unit carrying its line number and an add-comment affordance, so annotation works anywhere without a separate mode. Generator scaffolding (front matter, notation legends, metadata already shown in the header) SHALL be stripped rather than rendered. Recurring structures (user stories, phased task lists, requirement blocks, acceptance scenarios, callouts) SHOULD render as their own components, and those components stay commentable.

The add-comment affordance MUST name the line it targets in its accessible label, so repeated controls are distinguishable to assistive technology. Its glyph is decorative and MUST be hidden from that tree.

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

Markup carrying document content (a link target, image description, file reference or title) MUST be built so the value cannot end the attribute it sits in. Element-content escaping does not escape attribute quotes, so such markup SHALL use DOM APIs or an attribute-safe escape. The content policy MUST NOT be relied on as a substitute.

A destination taken from the document, such as a link target or image source, MUST also be restricted to schemes safe to navigate to or load. A script-executing destination SHALL NOT render as an active link or a loading image, and renders as inert text instead.

#### Scenario: a document contains a quote inside a file reference
- **WHEN** the value is placed into an attribute
- **THEN** the quote cannot close the attribute
- **AND** no additional attribute or handler can be introduced from document text

#### Scenario: a link points at a script-executing destination
- **WHEN** the document supplies a `javascript:` target
- **THEN** it is not rendered as an activatable link
- **AND** nothing the reader can click executes it

### A living spec is navigable by requirement

A living spec SHALL be navigable by requirement from the viewer's existing document outline, not from a second outline beside it. That outline SHALL list the requirements by default, without the subsections toggle a feature spec needs. Each row SHALL show the requirement's coverage when known and unknown when not, never zero, plus the number of path patterns its marker names when it has one. The count is of patterns, not files, because one pattern can claim a whole directory. These marks SHALL be drawn and hidden from assistive technology, with the row's single accessible name saying what they mean in words. The outline SHALL read what it shows off the rendered requirement cards, never by parsing the document again. A feature spec's outline is unchanged.

#### Scenario: a large living spec is opened
- **WHEN** it renders
- **THEN** every requirement appears once in the outline, in document order, without the reader turning on subsections

#### Scenario: a requirement appended past the uncovered-files section
- **WHEN** the cards and the outline are built
- **THEN** it is a card and a row like any other, because fold-back appends to the end of the file and position says nothing about what is a requirement
- **AND** the uncovered section between them stays outside every card rather than joining the one above it

#### Scenario: a requirement whose coverage was never computed
- **WHEN** its row renders
- **THEN** it reads as unknown, not as zero, which would mean none

#### Scenario: a heading inside a fenced block
- **WHEN** the cards and the outline are built
- **THEN** it is neither a card nor a row, matching what every other reader counts

#### Scenario: a file marker outside a requirement card
- **WHEN** any document renders, living or not, carrying a marker no requirement pass consumed
- **THEN** nothing is drawn for it, because a marker is metadata

#### Scenario: the outline reaches the page
- **WHEN** the document renders through the full pipeline rather than the outline pass alone
- **THEN** the outline is live markup the stylesheet applies to, and a requirement's file marker stays metadata the reader never sees as prose or as a template disclosure

### The viewer can be told which requirement to bring into view

The viewer SHALL accept a requirement heading from the extension and scroll that requirement into view, honouring the reader's reduced-motion preference. A heading that matches no rendered requirement SHALL leave the scroll position untouched. A reveal also brings the document pane to the front, since scrolling a hidden document reveals nothing.

#### Scenario: the named requirement is on the page
- **WHEN** the viewer is told to reveal it
- **THEN** that requirement is scrolled into view

#### Scenario: the overview is showing when a requirement is revealed
- **WHEN** the extension names a requirement
- **THEN** the pane switches to the document before the requirement is brought into view

### An adopted requirement says where it came from, and can be approved in place

A requirement with an `adopted:` marker was transcribed by adoption and has not been checked since. Its card MUST show the word adopted above the heading, name the source in that word's tooltip rather than on the card face where a line number would go stale, and offer an approval control that drops the marker for that requirement alone. The marker may sit before or after the file marker at the top of the block, and only the markers before the first ordinary line are consumed. The marker MUST reach the requirement pass intact through the full pipeline, never turned into a template disclosure first. Transcribed text that reaches an attribute MUST have its quotes escaped, because element-content escaping does not escape them.

#### Scenario: a requirement was transcribed by adoption
- **WHEN** its card renders
- **THEN** the word adopted sits above the heading with the source in its tooltip

#### Scenario: an adopted requirement is approved
- **WHEN** the reader picks the approval control
- **THEN** the heading it is keyed on is posted to the extension, which owns the change to the file

#### Scenario: the source contains a quote
- **WHEN** the card renders
- **THEN** the tooltip holds the whole source and no attribute is broken out of

## Uncovered

The original adoption did not read these files in full. Their exported surface and role were established, but their bodies were not reviewed line by line:

- `webview/src/spec-viewer/markdown/preprocessors.ts` (read partially; only the first ~60 lines and the export inventory)
- `webview/src/spec-viewer/toc.ts`
- `webview/src/spec-viewer/highlighting.ts`

### A living requirement shows its state on its heading's left edge

Each requirement card SHALL take the shape of the specify step's user-story card: a bordered block with a meta row, the title, and a 3px left edge in the state's colour. Confirmed uses the accent colour, adopted the review colour, drifted the warning colour. New is its own `data-req-new` attribute with the success colour and a New pill: it outranks adopted for the edge, and a new drifted card keeps the drifted edge and shows both pills. Only non-resting states SHALL place a pill in the meta row, naming the state in the matching ink with a dot in the edge colour, so a confirmed card has no pill. The adopted pill's tooltip names the source, and Approve sits beside it. A scenario title SHALL render with a capital first letter whatever case it was written in. A card whose requirement names files SHALL end with one quiet link counting them. The outline SHALL repeat each card's state as the colour of its row's dot, and SHALL be absent when the capability has one requirement or none.

#### Scenario: a requirement whose touched file changed
- **WHEN** the extension reports it among the drifted requirements
- **THEN** its card redraws with the warning edge and a Drifted pill

#### Scenario: a new requirement that also drifted
- **WHEN** its card renders
- **THEN** it keeps the warning edge and shows both the Drifted and the New pill

#### Scenario: a capability with a single requirement
- **WHEN** it renders
- **THEN** no outline is shown

### A requirement card lists what it leans on and what leans on it

Under its files a card SHALL list Leans on and Leaned on by, each only when non-empty. A resolved entry SHALL be a button carrying the capability, spec path and heading, built with attribute escaping, that opens that spec at that requirement. A broken entry SHALL be a non-interactive span showing the link as written.

#### Scenario: a link names a heading that does not exist
- **WHEN** the card renders
- **THEN** the link shows its original text, marked broken

#### Scenario: a resolved entry is clicked
- **WHEN** the reader activates it
- **THEN** the viewer opens that spec scrolled to that requirement
