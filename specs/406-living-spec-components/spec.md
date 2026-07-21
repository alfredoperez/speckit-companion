# Living Spec Components

A living spec is a document you read to understand part of the system. Today it renders as one long markdown scroll where a requirement, its scenarios, its confidence, and its coverage all look identical. You cannot see the shape of a spec without reading all of it, so drafts get skimmed — and a skimmed draft never gets corrected. This feature renders the structures a living spec *repeats* as components inside the viewer we already ship, so a reader can scan a spec before committing to read it, while ordinary markdown keeps rendering exactly as it does now.

This is a rendering change, not a new product surface and not a change to how specs are authored. Same page chrome, same living mode, same contents list, same markdown flow, same line-comment behaviour. Only the repeating structures gain component treatment; anything unrecognized falls back to the current renderer.

## User Scenarios & Testing

### User Story 1 - Know it's a draft and why the capability exists (Priority: P1)

A reader opens a living spec and, before reading a word of the body, can tell two things: that this document is a surface-first *draft* rather than a verified record, and what the capability is *for*. The draft notice sits at the top as a clear trust boundary, and a short purpose callout gives the reason the capability exists the visual weight that makes it the first thing read. This story is the foundation: it establishes that component rendering applies only in living-spec mode, that feature specs are untouched, and that anything a component cannot handle falls through to the renderer we already ship.

**Why this priority**: This is the trust boundary and the safe-fallback contract. If a draft can be mistaken for a reviewed record, the honesty markers we deliberately add do nothing. If the fallback is wrong, every later component can take the whole document down — a reader who cannot see their spec at all is worse than one looking at an ugly one. It ships standalone and delivers value on its own.

**Independent Test**: Open a living spec that carries a draft marker and a purpose section — confirm the draft notice and purpose callout render at the top. Open a living spec with no purpose section — confirm the callout is omitted, not filled with placeholder text. Open an ordinary feature spec — confirm it renders exactly as before, with no component treatment.

**Acceptance Scenarios**:
1. **Given** a living spec whose body carries the draft marker, **When** the reader opens it, **Then** a draft notice renders at the top that makes it impossible to mistake the document for a verified record.
2. **Given** a living spec with a purpose section, **When** the reader opens it, **Then** a purpose callout renders prominently with the authored purpose text, unchanged.
3. **Given** a living spec with no purpose section, **When** the reader opens it, **Then** no purpose callout appears and no placeholder text is invented.
4. **Given** an ordinary feature spec, **When** the reader opens it, **Then** it renders identically to today with no component treatment applied.
5. **Given** a component that fails while rendering a region, **When** the page loads, **Then** the existing markdown renderer takes over that region and the rest of the document still renders.
6. **Given** any recognized or unrecognized markdown, **When** it renders through the composition layer, **Then** source-line identity is preserved so comment add, restore, edit, and delete behave exactly as they do today.

### User Story 2 - Scan requirements and their scenarios (Priority: P2)

A reader can scan the requirements in a living spec — each rule shown as a card with its confidence and its test coverage where they are reading, rather than summarised elsewhere — and read the scenarios under each requirement with the conditions visually separated from the outcomes. Today an inferred requirement looks identical to an observed one because the tag is a word buried mid-sentence, and scenarios read as an undifferentiated bullet list. This is the core reading unit and where the wall-of-markdown pain is felt most.

**Why this priority**: This is the largest single improvement to the reading experience, but it builds on the shell and fallback contract from Story 1, so it follows it. It is independently testable once the shell exists.

**Independent Test**: Open a living spec with a mix of observed and inferred requirements, some with coverage and some without — confirm each requirement renders as a card in document order with its exact authored wording, confidence shown only where stated, coverage shown only where determinable, and scenarios rendered with conditions separated from outcomes.

**Acceptance Scenarios**:
1. **Given** a living spec with several requirements, **When** it renders, **Then** each requirement appears as a card in the exact authored order with its wording unchanged.
2. **Given** a requirement tagged as inferred, **When** it renders, **Then** it reads as less trustworthy than an observed one, while an untagged requirement carries no per-card confidence badge.
3. **Given** a requirement whose coverage can be determined, **When** it renders, **Then** its coverage is shown on the card; **Given** a requirement whose coverage cannot be determined, **Then** coverage is omitted and never rendered as zero.
4. **Given** a requirement with scenarios, **When** it renders, **Then** the WHEN/THEN/AND steps are visually separable with conditions distinguished from outcomes, and neither reordered nor reworded.
5. **Given** a requirement with no scenarios, **When** it renders, **Then** the card renders cleanly with no empty scenario container.
6. **Given** a requirement card, **When** the reader uses the line-comment affordances on it, **Then** add, restore, edit, and delete work exactly as on plain markdown today.

### User Story 3 - Understand what the spec did not read (Priority: P3)

A reader can see, as a first-class part of the document, the files a surface-first draft could not fully read — the honest headline of an adopted spec. The section opens with a count and a plain statement of how much of the area the spec actually saw, then discloses the specific files grouped by *why* each was skipped, in disclosures that stay closed until asked for. Today this is a plain list at the bottom of a long scroll, which is exactly where nobody looks.

**Why this priority**: It is the one place a spec concretely admits it is a starting point rather than a verified record, so it matters more than it looks. It is the least foundational of the three and depends on the shell, so it ships last.

**Independent Test**: Open a living spec whose uncovered section lists several files across more than one omission reason — confirm the section opens with a count and scope statement, groups files by reason, and keeps each group closed by default and keyboard-openable. Open a spec that read everything — confirm it says so plainly without a large empty banner.

**Acceptance Scenarios**:
1. **Given** a living spec with an uncovered section, **When** it renders, **Then** the section opens with a count and a scope statement before any file list.
2. **Given** uncovered files skipped for different reasons, **When** the section renders, **Then** files are grouped by reason for omission rather than shown as one flat list.
3. **Given** the grouped disclosures, **When** the reader navigates by keyboard, **Then** each disclosure is reachable and operable and is closed by default.
4. **Given** a spec that read every file in its area, **When** it renders, **Then** it says so plainly and does not render a large empty banner.
5. **Given** an uncovered section whose authored format the parser does not recognize, **When** it renders, **Then** the content falls back to plain markdown rather than dropping any line.

### Edge Cases

- A living spec with no requirements, no scenarios, and no uncovered section — the shell, draft notice, and purpose callout still render and nothing shows an empty container.
- A requirement heading that repeats verbatim elsewhere in the document — identity must stay tied to the exact heading text so comments and fold-back still resolve.
- An uncovered section that lists zero files but is present — treated as "read everything," not as an empty shell.
- A very long purpose paragraph, a very long requirement title, and a single omission reason with a long file list — each renders without breaking layout in narrow widths.
- A confidence or coverage value the document does not state — omitted entirely, never shown as zero and never inferred.
- The document is reloaded or navigated away from and back — component state and comment identity survive because the viewer swaps content in place rather than reloading.

## Requirements

### Functional Requirements

- **FR-001**: Component rendering MUST apply only in living-spec mode; ordinary feature specs MUST render identically to today, with no component treatment.
- **FR-002**: Any markdown the composition layer does not recognize MUST fall through to the current markdown renderer losslessly.
- **FR-003**: If a component throws while rendering a region, the existing markdown renderer MUST take over that region so the page still renders.
- **FR-004**: Every component MUST preserve the exact authored wording and the document order of the content it renders; this is a rendering change, never an editing one.
- **FR-005**: Every component MUST preserve source-line identity so line-comment add, restore, edit, and delete behave exactly as they do on plain markdown today.
- **FR-006**: The draft notice MUST render at the top of a draft living spec and make it impossible to mistake a draft for a verified record, without breaking the existing draft-marker detection that other features rely on.
- **FR-007**: The purpose callout MUST render only when the document actually has a purpose section, with the authored text unchanged; a missing purpose MUST be omitted, never filled with placeholder text.
- **FR-008**: Each requirement MUST render as a card keyed on its exact requirement heading text, with no normalization, trimming, or re-casing that could diverge from what fold-back matches on.
- **FR-009**: Confidence MUST be shown only when the document states it; an untagged requirement is observed by default and MUST NOT carry a per-card confidence badge.
- **FR-010**: An inferred requirement MUST read as less trustworthy than an observed one, without turning a spec that has several inferred requirements into a wall of warnings.
- **FR-011**: Per-requirement coverage MUST be shown when it can be determined and omitted when it cannot; a requirement with no coverage tier MUST NOT render as zero.
- **FR-012**: Scenario steps MUST render WHEN/THEN/AND so conditions are visually separable from outcomes, without reordering or rewording them.
- **FR-013**: A requirement with no scenarios MUST render cleanly with no empty scenario container.
- **FR-014**: The uncovered section MUST open with a count and a scope statement before any file list.
- **FR-015**: Uncovered files MUST be grouped by their reason for omission rather than shown as one flat list.
- **FR-016**: Uncovered disclosures MUST be keyboard accessible and closed by default.
- **FR-017**: A spec that read every file in its area MUST say so plainly and MUST NOT render a large empty banner.
- **FR-018**: The uncovered section MUST be parsed defensively; unrecognized content MUST fall back to plain markdown rather than silently dropping any line.
- **FR-019**: Any count (uncovered files, coverage, scenarios) that cannot be determined MUST be omitted, never guessed, and never shown as zero.
- **FR-020**: No document content may be interpolated into an HTML attribute through string-built markup; markup carrying authored text MUST be built so attribute values cannot break out.
- **FR-021**: Anything an accessibility description points at MUST use a visually-hidden class rather than being hidden from the accessibility tree, so the description is announced.
- **FR-022**: Every component MUST render correctly in dark, light, high-contrast, narrow, and reduced-motion modes through the existing viewer tokens, including the reduced-motion path for the disclosure transition.
- **FR-023**: Each modified component that has a sibling story file MUST have its stories cover the enumerated states: draft, non-draft, missing purpose, very long purpose, fallback path; observed, inferred, covered, uncovered, unknown-coverage, no-scenarios, many-scenarios, long requirement title; nothing uncovered, one file, many files across reasons, and a single reason with a long file list.

## Key Entities

- **Living spec document**: The capability spec being read in living mode. Composed of a draft marker, an optional purpose section, an ordered list of requirements, and an optional uncovered section.
- **Requirement**: A single rule authored under an exact heading. Carries the rule text, an optional confidence marker (observed or inferred), an optional coverage tier, and zero or more scenarios. Its identity is the exact heading text.
- **Scenario**: A checkable case under a requirement, expressed as WHEN/THEN/AND steps that separate conditions from outcomes.
- **Uncovered evidence entry**: One file the draft could not fully read, attributed to a reason for omission (unreadable, too large, read at surface level only).
- **Draft marker / purpose**: The trust boundary and the orientation of a living spec — the two things read before the body.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Feature specs render with zero content or visual differences from today (byte-for-byte for the rendered content).
- **SC-002**: A reader can tell a draft living spec from a reviewed one at a glance, without scrolling, in every supported theme and mode.
- **SC-003**: 100% of authored requirement, scenario, purpose, and uncovered text is preserved verbatim and in document order.
- **SC-004**: Zero cases where an undeterminable confidence, coverage, or count renders as zero or an invented value.
- **SC-005**: Line-comment add, restore, edit, and delete succeed on every component region at parity with plain markdown (100% of tested comment operations).
- **SC-006**: The uncovered section renders with zero authored lines dropped relative to its source.
- **SC-007**: When any single component fails, the document still renders in full via fallback in 100% of injected-failure cases.
- **SC-008**: Every enumerated component state has a corresponding Storybook story.

## Assumptions

- Per-requirement coverage data already exists in the coverage tooling (each requirement carries a covered/uncovered flag and its mapped tests), but today only the capability-wide total reaches the viewer header. Surfacing it per requirement is a plumbing change, not new data. If that plumbing lands separately, requirement cards ship coverage-less rather than inventing a number — never rendered as zero.
- The component set is the one named in the proposal: a living-document composition layer plus draft notice, purpose callout, requirement card, scenario steps, evidence summary, and evidence disclosure.
- How loud confidence should be, and how prominent the uncovered summary should be, are design judgment calls to settle against the mock during planning. The default is quiet-when-empty and louder-when-there-is-something-to-report; neither shouts on every line.
- This feature is delivered as three dependent slices matching the epic's children: the shell (Story 1) first, then requirement cards (Story 2), then uncovered evidence (Story 3).

## Verbatim Constraints

The render keys on these authored tokens; downstream steps and the implementation MUST match them exactly:

- Draft marker: `[DRAFT]`
- Inferred-confidence tag: `[inferred]`
- Uncovered section heading: `## Uncovered`
- Read-everything sentinel line: `_None — every file in the area was read._`
- Scenario step keywords: `WHEN`, `THEN`, `AND`
- Requirement identity is the exact `###` heading text (the same key fold-back matches on).
