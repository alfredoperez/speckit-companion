# Viewer Living Spec — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

What the viewer does differently when the document is a living spec: the header prints facts and the title it is given, the footer carries the capability's actions, and the outline lists requirements the extension can ask the viewer to bring into view.

## Requirements

### The header renders the title it is given; casing is decided upstream

The header MUST render the title exactly as supplied and MUST NOT re-case it or branch on where it came from. The authored-versus-derived decision belongs to the extension's shared display-name resolver: a feature name is acronym-aware title-cased there (a slug like "cli install nudge" arrives as "CLI Install Nudge"), and an authored living-spec heading arrives verbatim. Because that decision is already made when the title reaches the header, the header no longer carries a separate CSS state to distinguish the two cases — it prints one title uniformly.

#### Scenario: a feature name with an acronym is shown
- **WHEN** the header receives a feature title resolved upstream
- **THEN** it prints it as given — acronyms already in canonical form, words already capitalised
- **AND** the header applies no casing of its own

#### Scenario: a living spec's authored heading is shown
- **WHEN** the title came from the document's own top-level heading
- **THEN** the header prints it exactly as authored, because the resolver returned it verbatim

### A living spec's actions sit in the footer bar; its header carries facts only
<!-- touches: webview/src/spec-viewer/components/ActivityPanel.tsx, webview/src/spec-viewer/components/ActivityPanel.stories.tsx -->

In living mode the footer MUST render the capability's two actions — update this spec when drifted, otherwise a drift re-check, and beside either an update of every drifted spec — in the same bar every other state uses, with a context line saying whether the code has moved. The header MUST NOT carry buttons: it shows a DRAFT badge only when the document is a draft, the drift marker, coverage, and where the capability applies and where its file lives, each once. A covers glob renders as a control with its full text, never truncated, that asks the extension to reveal it. The Activity panel's install banner renders whichever nudge the extension sent — an install, or an update naming the installed and expected versions — from the one frame the protocol layer builds, taking its classes, its label, its body and the prompt it carries in `data-*` from there rather than deciding any of them itself.

#### Scenario: a drifted living spec is open
- **WHEN** the footer renders
- **THEN** it offers "Update this spec" and "Update all drifted", and the header shows the drift marker without a button

#### Scenario: a glob longer than the header row
- **WHEN** it renders
- **THEN** it wraps rather than ending in an ellipsis

#### Scenario: the extension sends an update prompt
- **WHEN** the Activity panel renders it
- **THEN** the banner is the protocol's update frame, carrying both versions on the root a click reads them back from
- **AND** a state with no prompt at all renders no banner

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

The viewer SHALL accept a requirement heading from the extension and scroll the matching requirement into view, honouring the reader's reduced-motion preference. A heading matching no rendered requirement SHALL leave the scroll position untouched.

#### Scenario: the named requirement is on the page
- **WHEN** the viewer is told to reveal it
- **THEN** that requirement is scrolled into view

#### Scenario: the heading matches nothing rendered
- **WHEN** the viewer is told to reveal it
- **THEN** the document stays where the reader left it
