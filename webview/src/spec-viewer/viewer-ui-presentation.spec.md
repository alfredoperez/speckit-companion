# Viewer Presentation — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The rules every rendered surface obeys regardless of what it shows: legible tokens and announced controls, microcopy that reads as plain sentences, and capture stories that compose the shipped components rather than fork them.

## Requirements

### Presentation must stay legible and announced

Readable content MUST use the body and primary text tokens; the secondary and muted tokens fall below the accessibility contrast floor on dark themes and are reserved for genuine metadata. Anything a control points at for its accessible description MUST be visually hidden rather than removed from the accessibility tree. Truncation MUST carry its full set of rules or it silently wraps instead. Motion MUST have a still equivalent for readers who ask for reduced motion, and purely decorative glyphs MUST be hidden from assistive technology.

#### Scenario: a status glyph accompanies a label
- **WHEN** the glyph carries no information the label does not
- **THEN** it is hidden from assistive technology
- **AND** the label alone conveys the state

#### Scenario: a reader has asked for reduced motion
- **WHEN** a step is in flight
- **THEN** the in-flight indicator renders without animation

A button that fills itself with the accent colour SHALL take the accent's own ink token; a hardcoded white is unreadable on the accent in the default dark theme, which is mint. This holds for a button assembled imperatively as much as for one rendered from the shared variant map — a control built outside that map still has to meet the contrast floor, and three shipped at 1.54:1 before anyone measured.

#### Scenario: a control is built imperatively rather than through the shared button
- **WHEN** it renders
- **THEN** it carries the same class the variant map would have given it, so one rule paints both

#### Scenario: a story stands in for a control the product builds another way
- **WHEN** the story renders a synthetic stand-in rather than the real control
- **THEN** the baseline is not evidence, and the story mounts what production mounts instead

### The viewer's own microcopy reads as plain sentences

The short strings the webview composes itself — a footer context line, a section summary title, a sizing line — MUST read as ordinary prose: clauses join with a comma, a list of figures is introduced with a colon, and a dash SHALL NOT stand in as the connective. This copy sits beside content the reader authored, and dash-joined fragments read as generated boilerplate where a plain sentence reads as the surface explaining its state.

#### Scenario: the footer explains a locked action set
- **WHEN** a running step withholds the forward action and the footer says why
- **THEN** the explanation reads as one plain sentence joined with a comma
- **AND** no dash stands in for the pause

#### Scenario: a verdict is shown with its inputs
- **WHEN** a summary line pairs a verdict with the figures behind it
- **THEN** a colon introduces the figures

### The capture stories are published copies of the real viewer, never forks of it
<!-- touches: webview/src/spec-viewer/__stories__/sidebarTree.tsx, webview/src/spec-viewer/__stories__/SidebarCapture.stories.tsx -->

The stories and fixtures that produce the project's documentation imagery MUST compose the shipped viewer components with fixture data rather than re-implement any surface, because their output is published copy: what they render is what readers of the documentation are told the product looks like. A change to a component's behavior, styling, or tokens therefore makes the captured imagery stale, and the response SHALL be to regenerate it from the stories, never to hand-edit the imagery or let a story drift onto its own rendering of the surface.

#### Scenario: a viewer component's rendering changes
- **WHEN** a component the capture stories compose changes its markup, styling, or tokens
- **THEN** the stories render the changed component as shipped, with no captured surface still showing the old behavior
- **AND** the generated imagery is regenerated from the stories rather than edited by hand

#### Scenario: a story needs to show a particular viewer state
- **WHEN** a capture story stages a state for imagery
- **THEN** it drives the real components with fixture data
- **AND** it does not re-implement the surface it is capturing

A scene several captures share SHALL be exported once and composed by each of them, and the shared building blocks SHALL be excluded from the published story list so they appear as imagery sources rather than as stories in their own right. A second copy of a shared scene drifts from the first, and the two captures then disagree about what the product looks like.

#### Scenario: two captures need the same staged document
- **WHEN** a still and a clip both frame it
- **THEN** both compose the one exported scene
- **AND** that scene is not itself listed as a story

Where a capture stands in for editor chrome the webview does not build — the sidebar frames — the stand-in SHALL match what the real view contributes: its title-bar actions in the order the menu declares them, painted on the one pane the frame is about and left off its neighbours the way the editor paints them, and a slot whose icon depends on state read off the fixture rows rather than hard-coded.

#### Scenario: a sidebar frame is captured
- **WHEN** the pane the frame is about renders
- **THEN** it shows that view's title-bar actions in the contributed order, and the collapse-or-expand slot matches the tree on screen
- **AND** the neighbouring panes stay bare

## Uncovered

The following files were not read in full — their exported surface and role were established, but their bodies were not reviewed line by line:

- All `*.stories.tsx` files and all files under `__tests__/`
