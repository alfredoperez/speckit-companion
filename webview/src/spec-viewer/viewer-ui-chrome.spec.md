# Viewer UI Chrome — Living Spec

<!-- reviewed: d589a63e -->

> Adopted from existing code on 2026-07-19 and split by concern on 2026-09-07. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The frame around the document: the header, the footer bar, the shared tokens and microcopy, and the stories that publish what the viewer looks like. It keeps casing, contrast and wording consistent across surfaces, and keeps the documentation imagery true to the product.

## Requirements

### The header renders the title it is given; casing is decided upstream

The header MUST render the title exactly as supplied and MUST NOT re-case it or branch on where it came from. The extension's shared display-name resolver makes that decision: a feature name arrives acronym-aware title-cased ("cli install nudge" becomes "CLI Install Nudge"), and an authored living-spec heading arrives verbatim.

#### Scenario: a feature name with an acronym is shown
- **WHEN** the header receives a feature title resolved upstream
- **THEN** it prints it as given, with acronyms and capitals already in place
- **AND** the header applies no casing of its own

#### Scenario: a living spec's authored heading is shown
- **WHEN** the title came from the document's own top-level heading
- **THEN** the header prints it exactly as authored, because the resolver returned it verbatim

### A living spec's actions sit in the footer bar; its header carries facts only
<!-- touches: webview/src/spec-viewer/components/ActivityPanel.tsx, webview/src/spec-viewer/components/ActivityPanel.stories.tsx -->

In living mode the footer MUST state the capability's condition on its left in words: in sync, how many requirements drifted, drift unknown, or no spec yet. It MUST offer approve whenever the spec is a draft or N requirements are adopted, labelled "Approve all N" when N is above zero and "Approve spec" otherwise, always offer adopting another area and validating living specs, and offer syncing this spec to its code only once drift has been found. While the extension reports a pending undo, the footer MUST show Undo for the time left and post its token when pressed. The header MUST NOT carry buttons: while the document is a draft, DRAFT reads as part of the title. The header shows, once each, the requirement count, how many are adopted and unconfirmed, how many are new, how many drifted, coverage, where the capability applies and where its file lives. A covers glob renders as a control with its full text, never truncated, that asks the extension to reveal it. The Activity panel's install banner renders the nudge the extension sent from the one frame the protocol layer builds, taking its classes, label, body and `data-*` prompt from there rather than deciding them itself.

#### Scenario: a drifted living spec is open
- **WHEN** the footer renders
- **THEN** it offers "Adopt an area", "Validate" and "Sync" beside a line counting the drifted requirements

#### Scenario: a living spec in step with its code
- **WHEN** the footer renders
- **THEN** it offers "Adopt an area" and "Validate" beside the words "In sync"

#### Scenario: an adopted living spec with four adopted requirements
- **WHEN** the footer renders
- **THEN** it offers "Approve all 4" and the header holds no button

#### Scenario: the extension sends an update prompt
- **WHEN** the Activity panel renders it
- **THEN** the banner is the protocol's update frame, carrying both versions on the root a click reads them back from

#### Scenario: a draft living spec with nothing adopted
- **WHEN** the footer renders
- **THEN** it offers "Approve spec"

### Presentation must stay legible and announced

Readable content MUST use the body and primary text tokens, because the secondary and muted tokens fall below the contrast floor on dark themes and are reserved for metadata. An element a control points at for its accessible description MUST be visually hidden, not removed from the accessibility tree. Truncation MUST carry its full set of rules, or it silently wraps instead. Motion MUST have a still equivalent for readers who ask for reduced motion, and purely decorative glyphs MUST be hidden from assistive technology.

#### Scenario: a status glyph accompanies a label
- **WHEN** the glyph carries no information the label does not
- **THEN** it is hidden from assistive technology
- **AND** the label alone conveys the state

#### Scenario: a reader has asked for reduced motion
- **WHEN** a step is in flight
- **THEN** the in-flight indicator renders without animation

A button filled with the accent colour SHALL take the accent's own ink token, since a hardcoded white is unreadable on the default dark theme's mint accent. This holds for a button assembled imperatively as much as for one rendered from the shared variant map.

#### Scenario: a control is built imperatively rather than through the shared button
- **WHEN** it renders
- **THEN** it carries the same class the variant map would have given it, so one rule paints both

#### Scenario: a story stands in for a control the product builds another way
- **WHEN** the story renders a synthetic stand-in rather than the real control
- **THEN** the baseline is not evidence, and the story mounts what production mounts instead

### The viewer's own microcopy reads as plain sentences

Short strings the webview composes itself (a footer context line, a section summary title, a sizing line) MUST read as plain prose: clauses join with a comma, a list of figures follows a colon, and a dash SHALL NOT stand in as the connective. Dash-joined fragments beside authored content read as generated boilerplate.

#### Scenario: the footer explains a locked action set
- **WHEN** a running step withholds the forward action and the footer says why
- **THEN** the explanation reads as one plain sentence joined with a comma
- **AND** no dash stands in for the pause

#### Scenario: a verdict is shown with its inputs
- **WHEN** a summary line pairs a verdict with the figures behind it
- **THEN** a colon introduces the figures

### The capture stories are published copies of the real viewer, never forks of it
<!-- touches: webview/src/spec-viewer/__stories__/sidebarTree.tsx, webview/src/spec-viewer/__stories__/SidebarCapture.stories.tsx -->

The stories and fixtures that produce documentation imagery MUST compose the shipped viewer components with fixture data rather than re-implement any surface, because their output is published as what the product looks like. When a component's behavior, styling or tokens change, the imagery SHALL be regenerated from the stories, never hand-edited, and no story may drift onto its own rendering of the surface.

#### Scenario: a viewer component's rendering changes
- **WHEN** a component the capture stories compose changes its markup, styling or tokens
- **THEN** the stories render the changed component as shipped, with no captured surface still showing the old behavior
- **AND** the generated imagery is regenerated from the stories rather than edited by hand

#### Scenario: a story needs to show a particular viewer state
- **WHEN** a capture story stages a state for imagery
- **THEN** it drives the real components with fixture data
- **AND** it does not re-implement the surface it is capturing

A scene several captures share SHALL be exported once and composed by each, and shared building blocks SHALL be excluded from the published story list. A second copy of a shared scene drifts from the first, and the captures then disagree about what the product looks like.

#### Scenario: two captures need the same staged document
- **WHEN** a still and a clip both frame it
- **THEN** both compose the one exported scene
- **AND** that scene is not itself listed as a story

Where a capture stands in for editor chrome the webview does not build, such as the sidebar frames, the stand-in SHALL match what the real view contributes. Its title-bar actions appear in the order the menu declares, only on the pane the frame is about, and an icon slot that depends on state reads that state off the fixture rows rather than being hard-coded.

#### Scenario: a sidebar frame is captured
- **WHEN** the pane the frame is about renders
- **THEN** it shows that view's title-bar actions in the contributed order, and the collapse-or-expand slot matches the tree on screen
- **AND** the neighbouring panes stay bare

## Uncovered

The original adoption did not read these files in full. Their exported surface and role were established, but their bodies were not reviewed line by line:

- `webview/src/spec-viewer/components/index.ts`
- All `*.stories.tsx` files and all files under `__tests__/`
