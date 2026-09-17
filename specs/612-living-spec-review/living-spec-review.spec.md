# Feature Specification: Reviewing a living spec

**Feature Branch**: `612-living-spec-review`
**Created**: 2026-09-17
**Status**: Draft
**Input**: GitHub issue #744, "Reviewing a living spec: approve all, new requirements, links, undo, open from anywhere"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Approve every adopted requirement at once, with undo (Priority: P1)

A reader opens a freshly adopted living spec and finds a dozen requirements still marked as adopted. They read through, agree with all of them, and press one button in the bar at the bottom to approve them together. If they pressed it too early, they have five seconds to undo and get the file back exactly as it was.

**Why this priority**: Approving card by card is the slowest part of reviewing an adoption, and it is the step every adopted spec must pass through before anyone trusts it.

**Independent Test**: Open a living spec with several adopted requirements, press Approve all, confirm only the adopted markers and the draft banner are gone, then press Undo and confirm the file is byte-identical to before.

**Acceptance Scenarios**:

1. **When** the spec on screen has 4 adopted requirements, **Then** the bottom bar offers "Approve all 4".
2. **When** the spec on screen has no adopted requirements, **Then** the bottom bar offers no approve-all action.
3. **When** the reader presses Approve all, **Then** every adopted marker is removed in a single write and no other line of the file changes.
4. **When** Approve all removes the last adopted marker, **Then** the draft banner is removed in the same write.
5. **When** the reader presses Undo within 5 seconds of approving, **Then** the file is restored byte for byte.
6. **When** 5 seconds pass without Undo, **Then** the Undo action disappears from the bar.

---

### User Story 2 - Requirements added on this branch are marked new (Priority: P1)

A reviewer looking at a living spec on a feature branch wants to see at a glance which requirements this branch introduced. Those cards carry a green edge and a New pill, and the header counts them. Nothing is written to the file, so the marks vanish on their own once the branch merges.

**Why this priority**: Reviewing a branch means reviewing what changed. Without the mark, a reviewer has to diff the file by hand to find the new requirements.

**Independent Test**: On a branch, add one requirement to a living spec that exists on `main`. Open the viewer and confirm only that card shows New and the header counts 1 new. Merge and confirm the mark is gone.

**Acceptance Scenarios**:

1. **When** a requirement heading exists in the working copy but not in `main`'s copy of the file, **Then** its card shows the green edge and a New pill.
2. **When** a requirement heading exists in both copies, **Then** its card shows no New mark, even if its body changed.
3. **When** the viewer shows new requirements, **Then** the header states how many are new.
4. **When** the file does not exist on `main` at all, **Then** no card is marked New.
5. **When** the repository has no `main` branch or git cannot be read, **Then** no card is marked New and the header omits the new count.
6. **When** the viewer marks requirements New, **Then** the spec file on disk is unchanged.

---

### User Story 3 - Each card shows what it leans on and what leans on it (Priority: P2)

A reader deciding whether to change or remove a requirement wants to know what depends on it. Under each card's files, Leans on lists the requirements this one aligns to, and Leaned on by lists requirements in other specs that align to this one. A link to a heading that no longer exists stays visible and reads as broken. Commands can ask the same question through the resolver.

**Why this priority**: It makes cross-spec dependencies visible before a change breaks them, but reviewing works without it.

**Independent Test**: Give requirement A an aligns link to requirement B in another capability. Open A and confirm Leans on names B. Open B and confirm Leaned on by names A. Point A's link at a heading that does not exist and confirm it reads as broken.

**Acceptance Scenarios**:

1. **When** a card has aligns links, **Then** a Leans on list names each linked requirement.
2. **When** a requirement in another spec aligns to this card, **Then** a Leaned on by list names that requirement and its capability.
3. **When** a card has no links in either direction, **Then** neither list is shown.
4. **When** an aligns link names a capability or heading that does not exist, **Then** the link is shown with its original text and marked broken.
5. **When** a Leans on or Leaned on by entry that resolves is activated, **Then** the viewer opens that spec scrolled to that requirement.
6. **When** a command runs `resolve-spec-paths.py --leaned-on-by <capability>#<heading>`, **Then** it receives every requirement whose aligns link names that heading.

---

### User Story 4 - Removing a requirement can be undone, and is remembered (Priority: P2)

A reader removes a requirement they believe is obsolete. For five seconds the bar offers Undo. Once the removal stands, it is recorded against the capability, so drift checks and the doctor treat the requirement as removed on purpose rather than lost.

**Why this priority**: Remove already works. Undo prevents an expensive mistake, and the record stops a deliberate removal from showing up as a false alarm later.

**Independent Test**: Remove a requirement, press Undo, confirm the file is byte-identical. Remove it again, let the 5 seconds pass, confirm a removal record exists and a drift check does not report the requirement missing.

**Acceptance Scenarios**:

1. **When** the reader confirms Remove, **Then** the bar offers Undo for 5 seconds.
2. **When** the reader presses Undo within 5 seconds, **Then** the file is restored byte for byte.
3. **When** a removal is undone, **Then** no removal record is kept.
4. **When** a removal stands past the Undo window, **Then** one removal line naming the requirement is appended to the capability's `.spec-context.json`.
5. **When** drift or the doctor looks for a requirement that has a removal record, **Then** it does not report that requirement as missing.

---

### User Story 5 - Open a living spec from anywhere, at the right requirement (Priority: P3)

A developer wants to jump straight to a requirement without navigating the sidebar. From the command palette they run SpecKit: Open Living Spec, pick a capability, optionally pick a requirement, and the viewer opens scrolled to that card. The tree row, the status bar item and a spec's loaded-living-specs links all open the same way.

**Why this priority**: Most entry points already exist. This adds the command palette path and makes all of them agree on scrolling.

**Independent Test**: Run the command, pick a capability and a requirement, and confirm the viewer opens scrolled to that card. Pick a capability and skip the requirement, and confirm the viewer opens at the top.

**Acceptance Scenarios**:

1. **When** the reader runs SpecKit: Open Living Spec, **Then** a picker lists every registered capability.
2. **When** the reader picks a capability, **Then** a second picker lists its requirements with an option to skip.
3. **When** the reader picks a requirement, **Then** the viewer opens scrolled to that card.
4. **When** the reader skips the requirement picker, **Then** the viewer opens at the top of the spec.
5. **When** the reader dismisses the capability picker, **Then** nothing opens.
6. **When** living specs are not configured, **Then** the command says so and opens nothing.
7. **When** the tree row, the status bar item or a loaded-living-specs link names a requirement, **Then** the viewer opens scrolled to that card.

### Edge Cases

- A second Approve all or Remove happens while an Undo is still offered: the earlier Undo is withdrawn and only the latest action can be undone.
- The file changes on disk during the Undo window, from an editor or another process: Undo does not overwrite it and tells the reader the file changed.
- The panel closes or switches to another capability during the Undo window: the action stands, and a pending removal is recorded.
- Two requirements share a heading: New, Leans on and Leaned on by match by heading, so both cards get the same result.
- An aligns link points back into the same capability: it shows under Leans on like any other link.
- A requirement aligns to itself: it is listed once under Leans on and not repeated under Leaned on by.
- The capability has no `.spec-context.json` yet when a removal stands: the file is created to hold the record.
- The requirement named by an open request no longer exists: the spec opens at the top with no error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The living-spec bar MUST offer "Approve all N" whenever the spec on screen has N ≥ 1 adopted requirements, and MUST NOT offer it when N is 0.
- **FR-002**: Approve all MUST remove every adopted marker, plus the draft banner once no marker remains, in one write that changes no other line.
- **FR-003**: After Approve all or Remove, the bar MUST offer Undo for 5 seconds, and Undo MUST restore the file byte for byte.
- **FR-004**: Undo MUST NOT write when the file changed on disk after the action, and MUST tell the reader why.
- **FR-005**: A requirement whose heading is absent from `main`'s copy of the same file MUST show a green edge and a New pill, and the header MUST count them.
- **FR-006**: The New mark MUST be computed without writing to the spec file, and MUST be omitted when `main`'s copy cannot be read.
- **FR-007**: Each card MUST list its own aligns links under Leans on, and the requirements in other specs that align to it under Leaned on by, showing each list only when non-empty.
- **FR-008**: An aligns link whose capability or heading does not resolve MUST be shown with its original text and marked broken.
- **FR-009**: The resolver MUST accept `--leaned-on-by <capability>#<heading>` and return every requirement whose aligns link names that heading.
- **FR-010**: A removal that outlives its Undo window MUST append one record naming the requirement to the capability's `.spec-context.json`. An undone removal MUST leave no record.
- **FR-011**: Drift and the doctor MUST NOT report a requirement with a removal record as missing.
- **FR-012**: A `SpecKit: Open Living Spec` command MUST let the reader pick a capability, then optionally a requirement, and open the viewer scrolled to that requirement.
- **FR-013**: The tree row, the status bar item and a spec's loaded-living-specs links MUST open the viewer scrolled to the requirement they name.
- **FR-014**: Tests MUST cover each story, and `docs/viewer-states.md`, `docs/sidebar.md`, the changelog and the generated screenshots MUST be updated.

### Key Entities

- **Living spec**: one capability's requirements file. It has requirements, a draft banner while any requirement is adopted, and a `.spec-context.json` beside it.
- **Requirement**: a heading plus its body and scenarios. It carries optional markers: adopted, touches, aligns.
- **Aligns link**: a pointer from one requirement to another, written as capability and heading. It resolves or is broken.
- **Removal record**: an entry in a capability's `.spec-context.json` saying a named requirement was removed on purpose, and when.
- **Pending undo**: the file's content before the last Approve all or Remove, held for 5 seconds.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Approving all adopted requirements in a spec takes 1 action, down from 1 action per requirement.
- **SC-002**: Approve all followed by Undo, and Remove followed by Undo, leave the file byte-identical in 100% of tests.
- **SC-003**: On a branch, 100% of requirements added by the branch show New and 0% of requirements from `main` do.
- **SC-004**: A requirement removed on purpose produces 0 drift or doctor reports of a missing requirement.
- **SC-005**: A reader reaches any requirement from the command palette in 3 picks or fewer.
- **SC-006**: Every broken aligns link is visible on its card, with 0 hidden.

## Assumptions

- "New" compares against a local branch named `main`. Projects with another default branch see no New marks until that is configurable, which is out of scope here.
- Comparison is by heading text. A renamed requirement reads as new.
- Undo is held in the open panel only. It does not survive a reload of the window.
- Approve all acts on the spec on screen, the same scope the existing header approve action uses.
- The removal record is appended to the capability's history the same append-only way other lifecycle events are, so existing readers ignore it until drift and the doctor learn to read it.
- The status bar item and the loaded-living-specs links already open at a requirement. This feature keeps that behavior and brings the tree row and the new command in line with it.

## Verbatim Constraints

- `git show main:<path>`
- `--leaned-on-by <capability>#<heading>`
- `SpecKit: Open Living Spec`
- `Approve all N`
- `Undo`
- `New`
- `Leans on`
- `Leaned on by`
- `adopted:`
- `docs/viewer-states.md`
- `docs/sidebar.md`

## MODIFIED Requirements
<!-- capability: spec-viewer-living -->

### A requirement can be removed from the viewer, unless something still leans on it

The viewer SHALL offer Remove on every requirement card, deleting that requirement up to the next heading after the reader confirms. When a requirement in another capability aligns to it, removal SHALL be refused with a message naming those capabilities. A link from the requirement's own capability, including a self-link, SHALL NOT block it. A removal that outlives its Undo window SHALL append one `requirement-removed` record naming the capability and the heading to the `.spec-context.json` beside the spec, creating the file when absent.

#### Scenario: nothing in another capability aligns to the requirement
- **WHEN** the reader confirms Remove
- **THEN** the requirement and its scenarios are gone from the file and the panel redraws

#### Scenario: another capability aligns to it
- **WHEN** the reader picks Remove
- **THEN** nothing is written and the message names the capability that leans on it

#### Scenario: a removal stands past its Undo window
- **WHEN** the window runs out, a newer action replaces it, or the panel closes
- **THEN** one removal record is appended beside the spec

## ADDED Requirements
<!-- capability: spec-viewer-living -->

### Approve all and Remove can be undone for five seconds

The panel SHALL hold one pending undo in the extension, carrying the file text before and after the write, because every write regenerates the webview page. The webview SHALL receive a token and an expiry only while the window is open. Undo SHALL restore the earlier text byte for byte when the file still reads as the action left it, and otherwise SHALL write nothing and tell the reader the file changed. An undone removal SHALL leave no record, and a stale token SHALL be ignored.

#### Scenario: Undo right after Approve all
- **WHEN** the reader presses Undo within 5 seconds
- **THEN** the file is byte-identical to before the approval

#### Scenario: the file changed during the window
- **WHEN** the reader presses Undo
- **THEN** nothing is written and a warning says the file changed

### Requirements added on the branch are marked new without writing the spec

After first paint the extension SHALL compare the spec's headings with `git show main:<path>` and push the headings `main` lacks as `newRequirements`. A body-only change SHALL NOT count as new. When `main`'s copy cannot be read for any reason, `newRequirements` SHALL be absent. The spec file SHALL never be written.

#### Scenario: a branch added one requirement
- **WHEN** the health push resolves
- **THEN** `newRequirements` names only that heading

#### Scenario: the repository has no `main`
- **WHEN** the health push resolves
- **THEN** `newRequirements` is absent

## MODIFIED Requirements
<!-- capability: viewer-ui-chrome -->

### A living spec's actions sit in the footer bar; its header carries facts only

In living mode the footer MUST state the capability's condition on its left in words: in sync, how many requirements drifted, drift unknown, or no spec yet. It MUST offer "Approve all N" while N requirements are adopted, always offer adopting another area and validating living specs, and offer syncing this spec to its code only once drift has been found. While the extension reports a pending undo, the footer MUST show Undo for the time left and post its token when pressed. The header MUST NOT carry buttons: while the document is a draft, DRAFT reads as part of the title. The header shows, once each, the requirement count, how many are adopted and unconfirmed, how many are new, how many drifted, coverage, where the capability applies and where its file lives. A covers glob renders as a control with its full text, never truncated, that asks the extension to reveal it. The Activity panel's install banner renders the nudge the extension sent from the one frame the protocol layer builds, taking its classes, label, body and `data-*` prompt from there rather than deciding them itself.

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

## MODIFIED Requirements
<!-- capability: viewer-ui-document -->

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

## ADDED Requirements
<!-- capability: viewer-ui-document -->

### A requirement card lists what it leans on and what leans on it

Under its files a card SHALL list Leans on and Leaned on by, each only when non-empty. A resolved entry SHALL be a button carrying the capability, spec path and heading, built with attribute escaping, that opens that spec at that requirement. A broken entry SHALL be a non-interactive span showing the link as written.

#### Scenario: a link names a heading that does not exist
- **WHEN** the card renders
- **THEN** the link shows its original text, marked broken

#### Scenario: a resolved entry is clicked
- **WHEN** the reader activates it
- **THEN** the viewer opens that spec scrolled to that requirement

## ADDED Requirements
<!-- capability: specs-living-model -->

### Requirement links are computed in-process over the requirement slicer

`requirementLinks` SHALL read every registered capability's spec through `requirementSlices` and return, per heading, the requirement's own aligns links marked resolved or broken, and the requirements in other capabilities that align to it. Headings match exactly, and requirements sharing a heading share their lists. The cards and the Remove refusal SHALL both read this one function.

#### Scenario: a requirement aligns to itself
- **WHEN** its links are computed
- **THEN** the self-link appears under Leans on and not under Leaned on by

#### Scenario: a link names an unregistered capability
- **WHEN** its links are computed
- **THEN** that link is marked broken with no spec path

## ADDED Requirements
<!-- capability: specs-living-view -->

### Any requirement opens from the command palette

`SpecKit: Open Living Spec` SHALL list every registered capability, then that capability's requirement headings under an "Open at the top" item, and open the viewer through `speckit.viewSpecDocument` with `{ living: true, requirement? }`. Dismissing either picker SHALL open nothing, and without living specs configured the command SHALL say so and open nothing.

#### Scenario: the reader picks a requirement
- **WHEN** the second picker closes on a heading
- **THEN** the viewer opens scrolled to that requirement

#### Scenario: living specs are not set up
- **WHEN** the command runs
- **THEN** a message says so and nothing opens

## ADDED Requirements
<!-- capability: capture-runtime-living-resolve -->

### The resolver answers what leans on a requirement

`resolve-spec-paths.py --leaned-on-by <capability>#<heading>` SHALL return every requirement, in any capability including the target's own, whose aligns marker names that heading exactly, each with its capability, heading, touches and body. No match and a disabled registry SHALL both give an empty `matches` list. Without `--json` it SHALL print one `capability#heading` per line.

#### Scenario: two capabilities align to one heading
- **WHEN** a command asks who leans on it
- **THEN** both requirements are returned

#### Scenario: nothing aligns to the heading
- **WHEN** a command asks who leans on it
- **THEN** `matches` is empty

## ADDED Requirements
<!-- capability: capture-runtime-living-fold -->

### A requirement removed on purpose is not reported as a missing heading

Validation SHALL read the `requirement-removed` records beside each living spec, scoped to that capability, and SHALL NOT raise `delta-heading-not-found` for a heading so recorded. A record naming another capability in a shared file SHALL NOT suppress the finding.

#### Scenario: a delta names a heading with a removal record
- **WHEN** validation runs
- **THEN** no `delta-heading-not-found` is reported for it

#### Scenario: the record names another capability
- **WHEN** validation runs
- **THEN** `delta-heading-not-found` is still reported
