# Feature Specification: Living spec surface

**Feature Branch**: `611-living-spec-surface`
**Created**: 2026-09-10
**Status**: Draft
**Input**: GitHub issue #717, ticket LV-1: the living spec viewer as a surface built around the requirement, not the document.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a capability as a list of requirement cards (Priority: P1)

A developer opens a living spec from the Living Specs tree. Instead of a rendered document, they see the capability's name and purpose under a header line that counts its requirements, then one card per requirement in a single reading column. Each card shows the requirement heading in a boxed block with a coloured left edge, its body, and its scenarios with the keywords coloured the way the spec viewer already colours them. The common card, a confirmed requirement with one touches line, carries nothing else except a quiet link saying how many files it touches.

**Why this priority**: This is the surface itself. Every later ticket (approve, edit, remove, filters) acts on these cards.

**Independent Test**: Open any capability from the tree and compare the cards against the requirements in its spec file.

**Acceptance Scenarios**:

1. **When** a capability whose spec has three requirements is opened, **Then** exactly three cards appear, in file order.
2. **When** a requirement carries a touches marker naming two files, **Then** its card ends with a quiet link reading `touches 2 files`.
3. **When** a requirement carries no marker at all, **Then** its card shows heading, body and scenarios and nothing else.
4. **When** a scenario line starts with Given, When or Then, **Then** that keyword is coloured as in the spec viewer.

---

### User Story 2 - See each requirement's state at a glance (Priority: P1)

The developer needs to know which requirements are settled and which need attention without reading badges. The card's left edge carries the state: the accent colour for confirmed, purple for adopted, the warning colour for drifted, the success colour for new in this branch. Only the three non-resting states add a short word above the heading. Hovering the purple word names the file the requirement was adopted from. The header line counts the non-resting states, and the On this page rail repeats each card's colour as a small pip.

**Why this priority**: State is the reason to open a living spec. A surface that hides it is only a prettier document.

**Independent Test**: Open a capability with one adopted and one drifted requirement and check edge colours, words, header counts and rail pips.

**Acceptance Scenarios**:

1. **When** a requirement carries an adopted marker, **Then** its card has a purple edge and the word `adopted` above the heading.
2. **When** the reader hovers the word `adopted`, **Then** a tooltip names the source file from the marker.
3. **When** a file the requirement touches has changed since the capability was last synced, **Then** its card has the warning edge and the word `drifted`.
4. **When** a requirement is confirmed, **Then** its card has the accent edge and no state word.
5. **When** the capability has three requirements, one adopted, **Then** the header reads `3 requirements · 1 adopted, unconfirmed`.
6. **When** the rail lists a requirement, **Then** its entry carries a pip in the card's edge colour.

---

### User Story 3 - Act on the capability from the bar (Priority: P2)

The floating action bar at the bottom states the capability's condition on its left, for example "In sync" or "2 requirements drifted", and offers the capability-level actions on its right: Adopt an area, Validate, and Sync. Sync appears only when something has drifted. Each button dispatches the same command the Living Specs tree already dispatches.

**Why this priority**: Without actions the surface is read-only, and the tree already offers these actions, so this is reuse rather than new behaviour.

**Independent Test**: Open a drifted capability and a clean one, compare the bar, and press each button.

**Acceptance Scenarios**:

1. **When** no requirement has drifted, **Then** the bar shows Adopt an area and Validate and no Sync.
2. **When** at least one requirement has drifted, **Then** the bar shows Sync.
3. **When** the reader presses Validate, **Then** the same validate command the tree offers is dispatched for this capability.

---

### User Story 4 - Empty and single-requirement capabilities (Priority: P2)

A capability registered with no spec file yet shows one call to action in the body, `Adopt this area`, which dispatches adoption for that capability. A capability with a single requirement uses the same surface without the rail.

**Why this priority**: These are the first states a new adopter meets.

**Independent Test**: Register a capability without a spec file and open it; open a one-requirement capability.

**Acceptance Scenarios**:

1. **When** a registered capability has no spec file, **Then** the body shows `Adopt this area` and no cards.
2. **When** the reader presses `Adopt this area`, **Then** adoption is dispatched for that capability.
3. **When** a capability has exactly one requirement, **Then** no rail is shown.

---

### Edge Cases

- A spec file that exists but has no requirement headings renders the header with `0 requirements` and no cards, not the empty-state call to action.
- A heading inside a fenced code block is never a card, matching the existing requirement count.
- A requirement that is both adopted and drifted shows the drifted edge: drift is the state that needs action first.
- Drift that cannot be computed (no git, time-out) shows no drifted cards and the bar says the condition is unknown rather than "In sync".
- New in this branch is out of scope here; the success edge is defined but no card receives it until LV-10.
- Saving the spec file while the surface is open redraws the cards.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Opening a capability from the Living Specs tree MUST show the requirement surface instead of the rendered document.
- **FR-002**: The surface MUST render one card per requirement heading, in file order, using the same requirement parse that counts the capability's requirements.
- **FR-003**: Each card MUST show the heading in a boxed block with a 3px coloured left edge, then the body and scenarios.
- **FR-004**: Given, When and Then keywords in scenarios MUST be coloured as the spec viewer colours them.
- **FR-005**: A card MUST show at most one link naming how many files the requirement touches, and none when it touches nothing.
- **FR-006**: The left edge MUST use the accent colour for confirmed, purple for adopted, the warning colour for drifted, and the success colour for new in this branch.
- **FR-007**: Non-resting states MUST show a short state word above the heading; confirmed MUST show none.
- **FR-008**: The adopted word MUST carry a tooltip naming the source file from the adopted marker; the card face MUST NOT show that source.
- **FR-009**: A requirement MUST count as drifted when any file it touches is among the capability's drifted files.
- **FR-010**: The header MUST show the capability name, its purpose, and a count line of total requirements plus each non-resting state present.
- **FR-011**: The On this page rail MUST list every card with a pip in the card's edge colour, and MUST be hidden when there is one requirement or none.
- **FR-012**: The action bar MUST state the capability's condition on the left and offer Adopt an area and Validate, plus Sync only when a requirement has drifted.
- **FR-013**: Bar buttons MUST dispatch the same commands the Living Specs tree dispatches for that capability.
- **FR-014**: A registered capability with no spec file MUST show an `Adopt this area` call to action in the body that dispatches adoption for it.
- **FR-015**: The surface MUST redraw when the capability's spec file changes on disk.
- **FR-016**: Readable text on the surface MUST use the readable text tokens; purple words MUST use the review ink colour.

### Key Entities

- **Capability**: a registered living-spec area with a name, a purpose, an optional spec file, and a drift result.
- **Requirement card**: one requirement heading with its body, scenarios, touched files, optional adopted source, and a derived state.
- **Requirement state**: one of confirmed, adopted, drifted, new in this branch; derived, never written.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every living spec in this repository, the card count on the surface equals the requirement count the tree reports.
- **SC-002**: A reader can name every adopted and drifted requirement in a capability from the header and edges alone, without scrolling into card bodies.
- **SC-003**: The common card (confirmed, one touches marker) shows exactly three kinds of content: heading, body with scenarios, one touches link.
- **SC-004**: Every bar action on the surface reaches the same command as its tree counterpart, verified for all three actions.

## Assumptions

- The surface replaces the rendered document only for living capability specs; feature specs keep the spec viewer unchanged.
- The existing living overview, living footer and tier tabs stay in place for other paths until LV-9 retires them.
- Only the explorer's capability row is required as an entry point here; other entry points are LV-8.
- The touches link opens the first touched file; a picker for several files can come later.
- Approve, Remove, edit, relationships, new-in-branch detection, density and filters are later tickets (LV-2 to LV-11).

## Verbatim Constraints

- `Adopt this area`
- `touches 2 files` (pattern: `touches N files`, `touches 1 file`)
- `3 requirements · 1 adopted, unconfirmed` (header count pattern)
- Card column width: 760px
- Edge width: 3px
- Tokens: `--review`, `--review-ink`, `--warning`, `--success`

## ADDED Requirements
<!-- capability: viewer-ui-document -->

### A living requirement shows its state on its heading's left edge

Each requirement card SHALL carry exactly one state, drawn as the 3px left edge of its heading block: confirmed in the accent colour, adopted in the review colour, drifted in the warning colour, and new in the success colour. Drifted wins over adopted, because it is the state that needs action first. Only the non-resting states SHALL print a short word above the heading, in the matching ink; a confirmed card carries no word. A card whose requirement names files SHALL end with one quiet link counting them, which reveals the first pattern. The outline SHALL repeat each card's state as the colour of its row's dot, and SHALL be absent when the capability has one requirement or none.

#### Scenario: a requirement whose touched file changed
- **WHEN** the extension reports it among the drifted requirements
- **THEN** its card redraws with the warning edge and the word drifted

#### Scenario: a confirmed requirement
- **WHEN** its card renders
- **THEN** it shows no state word

#### Scenario: a capability with a single requirement
- **WHEN** it renders
- **THEN** no outline is shown

## MODIFIED Requirements
<!-- capability: viewer-ui-document -->

### An adopted requirement says where it came from, and can be approved in place

A requirement carrying an `adopted:` marker was transcribed by adoption from the project's own conventions and nothing has checked it since. Its card MUST say so with the word adopted above its heading, name the source it was transcribed from in that word's tooltip rather than on the card face, where a line number would rot on the next edit to that file, and offer an approval control that drops the marker for that requirement alone. The marker sits with the file marker at the top of the block in either order, and only the run of markers before the first ordinary line is consumed. The marker MUST reach the requirement pass intact through the full rendering pipeline, never turned into a template disclosure first. Any transcribed text that reaches an attribute MUST have its quotes escaped, because the escaping used for element content does not escape them.

#### Scenario: a requirement was transcribed by adoption
- **WHEN** its card renders
- **THEN** the word adopted sits above the heading with the source in its tooltip

#### Scenario: an adopted requirement is approved
- **WHEN** the reader picks the approval control
- **THEN** the heading it is keyed on is posted to the extension, which owns the change to the file

#### Scenario: the source contains a quote
- **WHEN** the card renders
- **THEN** the tooltip holds the whole source and no attribute is broken out of

## MODIFIED Requirements
<!-- capability: viewer-ui-chrome -->

### A living spec's actions sit in the footer bar; its header carries facts only
<!-- touches: webview/src/spec-viewer/components/ActivityPanel.tsx, webview/src/spec-viewer/components/ActivityPanel.stories.tsx -->

In living mode the footer MUST state the capability's condition on its left in words: in sync, how many requirements drifted, drift unknown, or no spec yet. It MUST offer adopting another area and validating living specs at all times, and syncing this spec to its code only once drift has been found. The header MUST NOT carry buttons except the draft's own approval: while the document is still a draft, DRAFT reads as part of the title with an "Approve spec" control beside it. Otherwise the header counts the requirements, how many are adopted and unconfirmed, and how many drifted, and shows coverage and where the capability applies and where its file lives, each once. A covers glob renders as a control with its full text, never truncated, that asks the extension to reveal it. The Activity panel's install banner renders whichever nudge the extension sent from the one frame the protocol layer builds, taking its classes, its label, its body and the prompt it carries in `data-*` from there rather than deciding any of them itself.

#### Scenario: a drifted living spec is open
- **WHEN** the footer renders
- **THEN** it offers "Adopt an area", "Validate" and "Sync" beside a line counting the drifted requirements

#### Scenario: a living spec in step with its code
- **WHEN** the footer renders
- **THEN** it offers "Adopt an area" and "Validate" beside the words "In sync"

#### Scenario: an adopted living spec is still a draft
- **WHEN** the header renders
- **THEN** DRAFT sits inside the title with "Approve spec" beside it

#### Scenario: the extension sends an update prompt
- **WHEN** the Activity panel renders it
- **THEN** the banner is the protocol's update frame, carrying both versions on the root a click reads them back from

## ADDED Requirements
<!-- capability: spec-viewer-living -->

### An open living spec follows its file and names what drifted

An open living-spec panel SHALL redraw when its capability's spec file is changed or created on disk, wherever the capability lives. Once drift resolves, the panel SHALL be told which requirements drifted: those whose touches marker matches a drifted file, computed from the same drift result the sidebar uses. A requirement with no touches marker never drifts, and when drift cannot be computed the list is absent rather than empty.

#### Scenario: adoption writes the spec an empty panel was showing
- **WHEN** the file appears on disk
- **THEN** the open panel redraws with its cards

#### Scenario: a drifted file matches one requirement's marker
- **WHEN** health resolves
- **THEN** only that requirement is named as drifted

## ADDED Requirements
<!-- capability: specs-living-view -->

### A capability with no spec file opens to the call to adopt it

A registered capability whose spec file does not exist yet SHALL still open from its row. The viewer SHALL show only one call to action, "Adopt this area", which starts adoption. The view's commands SHALL include one that validates the shape of every living spec through the active AI provider.

#### Scenario: the reader clicks a capability marked not created
- **WHEN** the viewer opens
- **THEN** it shows "Adopt this area" and no cards

## MODIFIED Requirements
<!-- capability: spec-viewer-living -->

### A living spec is presented as a capability, not a run

A living-spec panel MUST drop the workflow machinery entirely — no run state, no phases, no workflow forward action — and present the capability's tiers as the only navigation. Its title comes from the capability's own spec document whichever tier is displayed, so the title belongs to the capability rather than to the tab on screen. The header carries facts only: a DRAFT badge when the document declares itself a draft (a "living" badge says nothing the panel title does not), the drift marker, coverage, what the capability covers and where its file lives — stated once each. Its actions sit in the same footer bar every other viewer state uses, beside a line stating the capability's condition: adopting another area and validating living specs are offered whatever the capability's state, and syncing this spec to its code only once drift has been found. Each resolves the capability's spec tier from the panel's own source anchor and hands off to the shared living-specs commands, so the panel and the sidebar build the same prompts. A covers glob is a place in the repository, so it is a control that reveals that place in the Explorer.

A tier is resolved by the naming convention the resolver writes, and a convention that has been renamed SHALL still resolve the file a project already has: where the rules tier's current name is absent, its previous name is accepted in its place and shown as that tier.

#### Scenario: the project predates the rules tier's rename
- **WHEN** the capability's rules file still carries the old suffix
- **THEN** it is listed as the rules tier rather than reported missing

#### Scenario: the architecture tier is selected
- **WHEN** a non-spec tier is displayed
- **THEN** the header still shows the capability's title as authored in its spec tier
- **AND** no workflow status or forward action appears

#### Scenario: the reader asks to update a drifted living spec
- **WHEN** the reader triggers the update from the footer bar
- **THEN** the capability's spec-tier path is resolved from the panel's source anchor, not from the tab on screen
- **AND** the request is routed through the same living-specs update command the sidebar uses, so both entry points fold back identically

#### Scenario: the capability has not drifted
- **WHEN** the panel renders
- **THEN** the footer offers adoption and validation and no sync, so the bar never offers work with no subject

#### Scenario: a covers glob is activated
- **WHEN** the reader clicks it
- **THEN** the glob's static prefix is confined to the workspace and revealed in the Explorer; a prefix that is not a real path falls back to a find-in-files scoped to the glob

#### Scenario: the document carries a draft banner near its top
- **WHEN** the spec declares itself a draft
- **THEN** the header badges it as a draft
- **AND** the in-document banner is left intact
