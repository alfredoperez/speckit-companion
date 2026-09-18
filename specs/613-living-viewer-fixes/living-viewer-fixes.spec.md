# Feature Specification: Living Viewer Fixes

**Feature Branch**: `613-living-viewer-fixes`
**Created**: 2026-09-17
**Status**: Draft
**Input**: GitHub issue #747, "Living spec viewer: seven fixes from the #744 review"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Approve clears a draft that has nothing left to approve (Priority: P1)

A reader opens a draft living spec whose requirements carry no adopted markers. Today Approve does nothing and the DRAFT badge can never be cleared. The reader approves the spec and the draft banner leaves the file.

**Why this priority**: 56 of this repo's 57 living specs are in this state, so the badge is permanent for almost every spec.

**Independent Test**: Open a draft spec with zero adopted markers, approve it, and confirm the banner is gone from the file and the badge from the panel.

**Acceptance Scenarios**:

1. **WHEN** the reader approves a whole draft spec that has no adopted markers, **THEN** the draft banner is removed from the file.
2. **WHEN** a draft spec with no adopted requirements is open, **THEN** the bar offers **Approve spec**.
3. **WHEN** a draft spec with three adopted requirements is open, **THEN** the bar's approve action reads **Approve all 3**.
4. **WHEN** approval is asked for a spec that has neither a banner nor a marker, **THEN** the file is left untouched.
5. **WHEN** the reader approves one requirement by heading and other markers remain, **THEN** the banner stays.

---

### User Story 2 - A draft spec shows DRAFT once (Priority: P1)

A reader opens a living spec whose first lines hold a reviewed marker. Today a grey "Template Instructions" bar appears and the draft banner renders under the DRAFT badge. The reader sees the badge alone.

**Why this priority**: It is a visible bug on every spec that drift acceptance has touched.

**Independent Test**: Open a spec whose line 3 is a reviewed marker and confirm it renders one badge, no banner text, and no disclosure.

**Acceptance Scenarios**:

1. **WHEN** a draft spec whose line 3 is a `reviewed:` marker is rendered, **THEN** the draft banner text does not appear in the document body.
2. **WHEN** a spec carries `reviewed:`, `aligns:` or `capability:` markers, **THEN** no "Template Instructions" disclosure is rendered for them.
3. **WHEN** a feature spec carries an ordinary template comment, **THEN** it still renders as a "Template Instructions" disclosure.

---

### User Story 3 - The tree groups capabilities and reads as words (Priority: P2)

A reader opens the Living Specs tree in a project where one folder holds many capability specs. Today those rows sit flat under one group and most start with the same word. The reader sees a group per folder with short leaf names.

**Why this priority**: It decides whether the tree can be scanned, but nothing is broken.

**Independent Test**: Point the tree at eight `commands-*` capabilities in one folder plus a single-spec folder and read the rows.

**Acceptance Scenarios**:

1. **WHEN** a folder holds two or more capability specs, **THEN** that folder is its own group in the tree.
2. **WHEN** a folder holds one capability spec, **THEN** the folder collapses into that leaf row.
3. **WHEN** every sibling in a group shares leading words, **THEN** each leaf label drops them and keeps at least one word.
4. **WHEN** a group row is drawn, **THEN** its label reads as words, such as **Companion Commands**.
5. **WHEN** the reader hovers a leaf, **THEN** the tooltip's first line is the exact capability name.
6. **WHEN** a capability is healthy, **THEN** its row has no icon.
7. **WHEN** a capability is drifted or missing, **THEN** its row keeps the warning or the outline circle icon.

---

### User Story 4 - The rail marks only what needs attention (Priority: P2)

A reader scans the "On this page" rail of a living spec. Today every requirement row has a left border and a dot. The reader sees a dot only on rows that need a look.

**Why this priority**: A mark on every row marks nothing.

**Independent Test**: Render a rail holding one confirmed, one adopted, one drifted and one new requirement.

**Acceptance Scenarios**:

1. **WHEN** a requirement is confirmed, **THEN** its rail row has no dot.
2. **WHEN** a requirement is adopted, drifted or new, **THEN** its rail row has a dot.
3. **WHEN** a requirement row is drawn in a living spec, **THEN** it has no left border and no guide indent.
4. **WHEN** a feature spec's rail is drawn, **THEN** its heading guide is unchanged.
5. **WHEN** the project has no coverage files, **THEN** no rail row shows an unknown-coverage ring.

---

### User Story 5 - Requirement buttons look like buttons (Priority: P3)

A reader looks at a requirement card's Approve and Remove buttons. Today they are squeezed flat inside a padded card. The reader sees buttons with room, and Remove turns red only under the pointer.

**Why this priority**: Cosmetic.

**Independent Test**: Render a requirement card and inspect both buttons at rest and on hover.

**Acceptance Scenarios**:

1. **WHEN** a requirement card is drawn, **THEN** Approve and Remove are at least 24px tall and use the bar's sans font.
2. **WHEN** Remove is at rest, **THEN** it is neutral.
3. **WHEN** the pointer is over Remove, **THEN** it is red.

---

### User Story 6 - The Overview says what the run did to each living spec (Priority: P3)

A reader opens a run's Overview. Today the Living specs card shows raw capability names and stamps "FOLDED BACK" on chips. The reader sees readable names under two labelled groups.

**Why this priority**: The card is correct today, only hard to read.

**Independent Test**: Render the card for a run that synced one capability and only loaded two more.

**Acceptance Scenarios**:

1. **WHEN** a run synced some capabilities and only loaded others, **THEN** the card shows them under **Updated by this run** and **Read for context**.
2. **WHEN** one of the two groups is empty, **THEN** that group is omitted.
3. **WHEN** a chip is drawn, **THEN** its name matches the name the tree shows for that capability.
4. **WHEN** the card is drawn, **THEN** no chip carries "FOLDED BACK".

### Edge Cases

- A group whose siblings share every word: each leaf keeps its last word.
- A group of one after filtering: it collapses like any single-spec folder.
- A capability name that is already one word: shown as is.
- A reviewed marker below the first ten lines: unchanged, it was never in the banner's way.
- Undo after Approve spec on a zero-marker draft: restores the banner, as it restores markers today.
- A requirement that is both new and adopted: one dot.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Approving a whole spec MUST remove the draft banner even when no adopted marker was removed.
- **FR-002**: Approval MUST leave the file untouched only when neither a marker nor the banner changed.
- **FR-003**: The bar MUST offer approve whenever the spec is a draft, labelled **Approve all N** when N is above zero and **Approve spec** otherwise.
- **FR-004**: `reviewed:`, `aligns:` and `capability:` markers MUST NOT render as a "Template Instructions" disclosure or as body text.
- **FR-005**: A draft spec MUST render its draft state once, as the badge.
- **FR-006**: Approve and Remove on a requirement card MUST be at least 24px tall, padded 2px by 10px, in the bar's sans font.
- **FR-007**: Remove MUST be neutral at rest and red on hover only.
- **FR-008**: A requirement row in the rail MUST NOT inherit the heading guide's border and indent. Feature-spec rails MUST stay as they are.
- **FR-009**: A rail row MUST show a dot only when its requirement is adopted, drifted or new.
- **FR-010**: The rail MUST NOT show an unknown-coverage ring.
- **FR-011**: A folder holding two or more capability specs MUST be its own tree group. A folder holding one MUST collapse into its leaf.
- **FR-012**: Leaf labels in a group MUST drop the leading words every sibling shares, keeping at least one word.
- **FR-013**: Group and leaf labels MUST read as words. The exact capability name MUST stay the tooltip's first line.
- **FR-014**: A healthy capability row MUST have no icon. Drifted, missing, folder and tier rows MUST keep theirs.
- **FR-015**: The Overview card MUST name capabilities by the same rule as the tree.
- **FR-016**: The Overview card MUST group chips under **Updated by this run** and **Read for context**, omit an empty group, and drop the per-chip "FOLDED BACK".
- **FR-017**: `docs/viewer-states.md`, `docs/sidebar.md`, the changelog and the generated screenshots MUST match the new behaviour.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A draft spec with zero adopted markers loses its banner in one approve action.
- **SC-002**: A spec whose line 3 is a reviewed marker renders zero banners and zero disclosures.
- **SC-003**: Eight `commands-*` capabilities in one folder produce one **Companion Commands** group whose leaves read `Assembly`, `Capture`, `Completion`, `Living`, `Living Load`, `Living Markers`, `Nodes`, `Pipeline`.
- **SC-004**: In a rail of confirmed requirements, zero rows carry a dot or a left border.
- **SC-005**: Each of the six stories has at least one automated test that fails without the fix.

## Assumptions

- The review ran on 0.33.0, so the Approve all, undo, links and new marks from #744 are the starting point, not part of this change.
- "Approve spec" with zero markers uses the same undo window as Approve all.
- The shared naming rule lives where both the extension and the webview can import it.
- The reviewed, aligns and capability markers stay in the file. Only their rendering changes.

## Verbatim Constraints

- Labels: `Approve spec`, `Approve all N`, `Updated by this run`, `Read for context`
- Classes: `.living-req-remove`, `.living-req-approve`, `.spec-toc-link--requirement`
- Button metrics: `min-height: 24px; padding: 2px 10px`
- Markers passed through: `reviewed:`, `aligns:`, `capability:`, alongside `touches:` and `adopted:`
- Icons kept: `warning` for drifted, `circle-outline` for missing
- Group label: `Companion Commands`
- Shared naming function: `readableName`

## MODIFIED Requirements
<!-- capability: spec-viewer-living -->

### Approving an adopted requirement only ever removes what adoption claimed

Approving SHALL delete the `adopted` marker, for one requirement by heading or for every requirement in the tier on screen, and change nothing else. When the last marker goes, the `[DRAFT]` banner SHALL go with it, and approving the whole spec SHALL remove the banner even when no marker was left to remove. A request that would write outside the workspace or to a non-tier file MUST be refused and logged, and one that changes neither a marker nor the banner MUST leave the file untouched.

#### Scenario: the last adopted requirement in a tier is approved
- **WHEN** the reader approves it
- **THEN** that requirement's marker is removed along with the document's draft banner
- **AND** the panel re-renders without the DRAFT badge

#### Scenario: approval is asked for a document that is not a living tier
- **WHEN** the request names a file outside the workspace root, or one that is not a tier file
- **THEN** nothing is written and the refusal is logged

#### Scenario: a draft with no adopted markers is approved whole
- **WHEN** the reader approves the spec
- **THEN** the draft banner is removed from the file

## MODIFIED Requirements
<!-- capability: viewer-ui-chrome -->

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

## MODIFIED Requirements
<!-- capability: viewer-ui-document -->

### A living spec is navigable by requirement

A living spec SHALL be navigable by requirement from the viewer's existing document outline, not from a second outline beside it. That outline SHALL list the requirements by default, without the subsections toggle a feature spec needs. A row SHALL carry a dot only when its requirement is adopted, drifted or new on this branch, and a confirmed row SHALL carry none. A requirement row SHALL NOT take the subsection guide's border or indent. Each row SHALL show the number of path patterns its marker names when it has one, and say its coverage in its accessible name only when coverage is known. The count is of patterns, not files, because one pattern can claim a whole directory. These marks SHALL be drawn and hidden from assistive technology, with the row's single accessible name saying what they mean in words. The outline SHALL read what it shows off the rendered requirement cards, never by parsing the document again. A feature spec's outline is unchanged.

#### Scenario: a large living spec is opened
- **WHEN** it renders
- **THEN** every requirement appears once in the outline, in document order, without the reader turning on subsections

#### Scenario: a requirement appended past the uncovered-files section
- **WHEN** the cards and the outline are built
- **THEN** it is a card and a row like any other, because fold-back appends to the end of the file and position says nothing about what is a requirement
- **AND** the uncovered section between them stays outside every card rather than joining the one above it

#### Scenario: a confirmed requirement whose coverage was never computed
- **WHEN** its row renders
- **THEN** it has no dot and no coverage mark

#### Scenario: a heading inside a fenced block
- **WHEN** the cards and the outline are built
- **THEN** it is neither a card nor a row, matching what every other reader counts

#### Scenario: a file marker outside a requirement card
- **WHEN** any document renders, living or not, carrying a marker no requirement pass consumed
- **THEN** nothing is drawn for it, because a marker is metadata

#### Scenario: the outline reaches the page
- **WHEN** the document renders through the full pipeline rather than the outline pass alone
- **THEN** the outline is live markup the stylesheet applies to, and a requirement's file marker stays metadata the reader never sees as prose or as a template disclosure

## ADDED Requirements
<!-- capability: viewer-ui-document -->

### A living spec's marker comments render nothing, and a draft shows once

The `touches`, `adopted`, `reviewed`, `aligns` and `capability` comments SHALL pass through comment preprocessing untouched and be dropped while rendering, never becoming a template disclosure. A draft's banner line SHALL be stripped from the rendered body, so the badge is the only draft mark on screen. Any other comment still renders as a template disclosure.

#### Scenario: a draft whose third line is a reviewed marker
- **WHEN** it renders in living mode
- **THEN** no banner text and no template disclosure appear

#### Scenario: an ordinary comment in a feature spec
- **WHEN** it renders
- **THEN** it is a template disclosure, as before

## ADDED Requirements
<!-- capability: specs-living-model -->

### The capability tree groups by folder and labels its rows as words

A folder holding two or more capability specs SHALL be its own group, and a folder holding one SHALL collapse into its leaf. Group and leaf labels SHALL read as words, from the one naming rule the viewer's Overview also uses. Leaves in one group SHALL drop the leading words every sibling shares, keeping at least one word. The exact capability name stays on the leaf.

#### Scenario: eight specs share one folder and one leading word
- **WHEN** the tree is built
- **THEN** the folder is one group and each leaf label omits the shared word

#### Scenario: a folder holds a single spec
- **WHEN** the tree is built
- **THEN** the folder is not a group and the leaf sits under its parent

## ADDED Requirements
<!-- capability: specs-living-view -->

### An icon on a capability row means look here

A healthy capability row SHALL have no icon. A drifted row keeps the warning icon, a row with no spec keeps the outline circle, and folder and tier rows keep theirs. The row's label is the tree's readable label, and its tooltip's first line starts with the exact capability name.

#### Scenario: a healthy capability is drawn
- **WHEN** its row renders
- **THEN** it has no icon

## MODIFIED Requirements
<!-- capability: viewer-ui-overview -->

### Durable context leads the panel; the granular run history stays collapsed

The activity panel MUST lead with the run's lifecycle signal and durable context (intent, run timing overview, touched living specs, verified proof, decisions, coverage) and demote the granular run history (phase events, tasks, concerns, files, comments) into a collapsed log below. The touched living specs and the run timing overview render inline in the overview's intent, not as separate run-log cards. Touched living specs SHALL sit under two labels, "Updated by this run" for the synced ones and "Read for context" for the rest, with an empty group omitted and no per-chip stamp. A chip SHALL show the capability's readable name, by the same rule as the Living Specs tree. A living-spec chip is always a link that opens its capability by name, whether or not a stored spec path rides along.

#### Scenario: a spec touched living specs
- **WHEN** the overview renders
- **THEN** the touched capabilities appear as links inside the intent, not as a separate card
- **AND** selecting one opens that capability by name

#### Scenario: a run synced one capability and only read two
- **WHEN** the overview renders
- **THEN** one chip sits under "Updated by this run" and two under "Read for context"

## ADDED Requirements
<!-- capability: core-primitives -->

### Capability names are made readable by one rule

A capability or folder name SHALL be turned into words by one shared function, splitting on dashes and underscores and capitalising each word, so every surface that shows a capability agrees on its name. Sibling labels SHALL be shortened by dropping the leading words they all share, never past the shortest label's last word.

#### Scenario: siblings share a leading word
- **WHEN** `commands-living` and `commands-living-load` are labelled together
- **THEN** they read as "Living" and "Living Load"

#### Scenario: one label is a prefix of its sibling
- **WHEN** `viewer-ui` and `viewer-ui-chrome` are labelled together
- **THEN** they read as "Ui" and "Ui Chrome"
