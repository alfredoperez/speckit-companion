# Living Spec Header — Real Title, One DRAFT, Facts Worth Reading

**Feature**: 404-living-spec-header
**Source**: GitHub issue #457

## Why this exists

Opening an adopted capability in the spec viewer today shows a title that has been mangled by the machine, the word DRAFT three times over, and none of the facts that would tell a reader anything about the capability. The sidebar already works out useful things about the same capability — how much of it is covered by tests, whether the code has moved on since the spec was written — and shows them on a cramped tree row. The viewer, which has a whole page of room, shows none of it.

The most valuable missing fact is which files a capability claims. Right now the only way to answer "why did this spec load for this change?" is to open a config file by hand.

## User Scenarios & Testing

### User Story 1 - The title reads the way the author wrote it (Priority: P1)

A developer opens a living spec whose document begins with the heading "SpecKit Extension Capture — Living Spec". The viewer shows that name, capitalized the way a person wrote it, instead of a folder slug bent back into title case.

**Why this priority**: It is the first thing a reader sees and it is currently wrong on every multi-word capability. Product names are the worst case — "SpecKit" becomes "Speckit" — and it makes the whole panel look untrustworthy before anyone reads a word of it.

**Independent Test**: Open a capability whose heading differs from its folder name. The tab and the page heading both read the author's wording.

**Acceptance Scenarios**:

1. **Given** a living spec whose first heading is "SpecKit Extension Capture — Living Spec", **When** it is opened in the viewer, **Then** the header title reads "SpecKit Extension Capture".
2. **Given** a living spec whose first heading is "Billing" with no trailing suffix, **When** it is opened, **Then** the header title reads "Billing".
3. **Given** a living spec file with no heading at all, **When** it is opened, **Then** the header title falls back to the name derived from the file location, exactly as it does today.
4. **Given** a capability spec, **When** its title is shown anywhere in the viewer — the page header, the editor tab — **Then** both use the same title.

### User Story 2 - DRAFT is said once, in the place it belongs (Priority: P1)

A developer hovers over the DRAFT badge on a draft capability. Nothing pops up over the title. The badge and the in-body banner remain; the redundant hover text is gone.

**Why this priority**: The hover text repeats the badge word for word, adds nothing, and physically covers the title while it is showing. It is a pure subtraction with no design risk, and it ships alongside Story 1 in the same header.

**Independent Test**: Hover the badge on a draft living spec. No tooltip appears. Hover the badge on a feature spec that has a created date. The tooltip still appears and still names the date.

**Acceptance Scenarios**:

1. **Given** a living spec in draft, **When** the reader hovers the status badge, **Then** no hover text appears.
2. **Given** a feature spec with a created date, **When** the reader hovers the status badge, **Then** the hover text still shows the status and the date.
3. **Given** a living spec in draft, **When** it is rendered, **Then** the in-body draft banner is still present and still recognized by the code that decides whether a spec is a draft.

### User Story 3 - The header answers "what is this capability, and why did it load?" (Priority: P1)

A developer opens a capability and, without scrolling or opening a config file, can see how large it is, how well it is covered, whether the code has moved on without it, which files it claims, and where its spec file lives.

**Why this priority**: This is the substance of the ticket. Without it the header is decoration. The file-claim list in particular exists nowhere else in the product.

**Independent Test**: Open an adopted capability that has a coverage tier and drifted source files. The header shows its size, its coverage count, a drift marker, its claimed file patterns, and its spec location.

**Acceptance Scenarios**:

1. **Given** a capability spec containing numbered requirements, **When** it is opened, **Then** the header shows how many requirements it has.
2. **Given** a capability spec containing acceptance scenarios, **When** it is opened, **Then** the header shows how many scenarios it has.
3. **Given** a capability with a coverage tier, **When** it is opened, **Then** the header shows how many of its requirements have a mapped test, in the same "N/M covered" wording the sidebar uses.
4. **Given** a capability with no coverage tier, **When** it is opened, **Then** no coverage figure is shown at all — not a zero.
5. **Given** a capability whose matching source files changed since its spec was last committed, **When** it is opened, **Then** the header shows a drift marker with an explanation available on hover.
6. **Given** a capability whose drift cannot be determined (no repository, spec never committed, check timed out), **When** it is opened, **Then** no drift marker is shown — absence is not "no drift".
7. **Given** a capability that claims file patterns, **When** it is opened, **Then** those patterns are listed in the header.
8. **Given** a capability that claims many file patterns, **When** it is opened, **Then** the header shows a readable subset with the remainder available rather than filling the page.
9. **Given** any capability, **When** it is opened, **Then** the header shows where its spec file lives.
10. **Given** a capability whose facts cannot be read (missing or unreadable configuration), **When** it is opened, **Then** the viewer still opens and shows the title and badge, with the unavailable facts simply absent.
11. **Given** a feature spec (not a living spec), **When** it is opened, **Then** its header is unchanged — branch, created date and the existing badges behave exactly as before.

### User Story 4 - The two places that report a capability agree (Priority: P2)

A developer compares the coverage figure on a sidebar row with the one in the viewer header for the same capability. They match, always, because they are the same computation.

**Why this priority**: Two derivations of one fact that disagree is this repository's most persistent bug class. It costs nothing to prevent here and is expensive to unpick later.

**Independent Test**: Read a capability's coverage and drift from the sidebar row and from the viewer header. Confirm both come from one shared computation rather than two.

**Acceptance Scenarios**:

1. **Given** a capability shown in both the sidebar and the viewer, **When** its coverage is reported in both, **Then** the figures are identical.
2. **Given** a capability shown in both places, **When** drift is reported, **Then** both agree on whether it has drifted.

## Edge Cases

- A heading that is empty, or only the "— Living Spec" suffix, must not produce a blank title — fall back to the derived name.
- A heading with leading or trailing whitespace, or inline emphasis markers, must be cleaned before display.
- A file whose first heading appears after front matter must still be found.
- A capability with zero requirements shows no requirement count rather than "0".
- A capability with no claimed file patterns shows no pattern list rather than an empty one.
- The drift check touches the repository. It must never delay the viewer opening, and a slow or failed check must leave the marker absent.
- Capability names, file patterns and titles are author-written text and must be rendered as text, never treated as markup.
- A very long title or a long file pattern must truncate rather than push the header wide or wrap into a wall.

## Requirements

### Functional Requirements

- **FR-001**: The viewer MUST use a living spec document's own first heading as the displayed title when the document has one.
- **FR-002**: The viewer MUST strip a trailing "— Living Spec" style suffix from that heading before displaying it.
- **FR-003**: The viewer MUST fall back to the name derived from the spec's file location when the document has no usable heading.
- **FR-004**: The derived title MUST be used consistently for the page header and the editor tab.
- **FR-005**: The status badge MUST NOT carry hover text that merely repeats the badge's own wording.
- **FR-006**: The status badge MUST keep its hover text where that text adds information the badge does not already show.
- **FR-007**: The in-body draft banner MUST remain unchanged, including the marker the code relies on to recognize a draft.
- **FR-008**: For a living spec, the header MUST show how many requirements the capability declares, when that number can be determined.
- **FR-009**: For a living spec, the header MUST show how many acceptance scenarios the capability declares, when that number can be determined.
- **FR-010**: For a living spec, the header MUST show the capability's test coverage as a covered-of-total figure, using the same wording as the sidebar, when a coverage tier exists.
- **FR-011**: For a living spec, the header MUST show a drift marker when the capability's source files have changed since its spec was last committed.
- **FR-012**: For a living spec, the header MUST list the file patterns the capability claims.
- **FR-013**: The header MUST keep a long list of file patterns readable, showing a subset with the remainder reachable rather than rendering all of them inline.
- **FR-014**: For a living spec, the header MUST show where the spec file lives.
- **FR-015**: Coverage and drift shown in the header MUST come from the same computation the sidebar uses, not a second implementation.
- **FR-016**: Any capability fact that cannot be determined MUST be omitted entirely rather than shown as a zero, an empty value, or a guess.
- **FR-017**: A failure to read capability facts MUST NOT prevent the viewer from opening or block rendering of the document.
- **FR-018**: The header for a feature spec (branch, created date, phases, task progress) MUST be unchanged by this work.
- **FR-019**: All author-written values shown in the header MUST be rendered as text and MUST NOT be able to inject markup.
- **FR-020**: Readable header content MUST use the body/primary text tokens; only true metadata may use the secondary/muted tokens.

### Key Entities

- **Capability** — a named area of the codebase with a living spec. Has a name, a spec file location, whether that location is central or beside the code, the file patterns it claims, and the patterns it excludes.
- **Capability facts** — the derived, best-effort view of a capability shown in the header: requirement count, scenario count, coverage figure, drift state. Any field may be absent, and absent must be distinguishable from zero.
- **Living spec title** — the display name for a capability, preferring the document's own heading over the name derived from its file location.

## Success Criteria

### Measurable Outcomes

- **SC-001**: For every capability whose document carries a heading, the displayed title matches that heading character for character after suffix removal — 100% of cases.
- **SC-002**: The word DRAFT appears in at most two places in a draft living spec's view: the badge and the in-body banner.
- **SC-003**: A reader can answer "which files does this capability claim?" without leaving the viewer, in zero additional clicks.
- **SC-004**: Coverage and drift figures shown in the viewer match the sidebar's for the same capability in 100% of cases.
- **SC-005**: Opening a living spec is not measurably slower than before; the header renders without waiting on the drift check.
- **SC-006**: Feature-spec headers are byte-identical in behavior to before the change — no existing feature-spec test changes.

## Assumptions

- Requirement counting follows the existing convention already used for coverage: identifiers of the FR/NFR form found in the spec document.
- Scenario counting follows the acceptance-scenario form the adoption command writes into living specs.
- The header shows facts read-only. Nothing in it edits the capability, its configuration, or its files.
- "Where the spec lives" is shown as the spec's repository-relative path, which serves both the central and beside-the-code cases without needing separate wording.
- A subset of file patterns means the first few, with the rest reachable on hover or via an expand affordance — the exact count is a layout decision made during design.

## Verbatim Constraints

- `— Living Spec` — the trailing title suffix to strip.
- `N/M covered` — the coverage wording the sidebar already uses and the header must match.
- `[DRAFT]` — the in-body banner marker that must not change.
