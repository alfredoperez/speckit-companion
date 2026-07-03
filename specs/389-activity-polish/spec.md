# Feature Specification: Activity panel polish — focus artifact, deduped counts, pill layout, heading case

**Feature**: 389-activity-polish
**Source**: [#405](https://github.com/alfredoperez/speckit-companion/issues/405)

## Overview

A design critique of the shipped Activity panel (impeccable source pass clean; findings are taste/visual-layer from the design-taste profile plus a screenshot review of the real render) surfaced eight fit-and-finish problems: the active tab draws a broken-looking focus box, the same coverage number appears four times, tab badges sum unrelated units, the Verified section renders three one-line facts as a ragged card grid with a hole, every heading shouts in the same all-caps voice, coverage rows carry two markers, metadata labels are too faint to read, and the viewer title renders as a lowercase slug. This change fixes all eight without touching capture, schema, or panel structure.

## User Scenarios & Testing

### User Story 1 - The tab bar looks intentional (Priority: P1)

A reviewer clicks between tabs and the active tab shows a deliberate underline — no stray vertical bars, no partial box. Keyboard users still get a clearly visible focus indicator.

**Why this priority**: It's the one finding that reads as a rendering bug rather than a taste choice; it undermines trust in the whole panel.

**Independent Test**: Open the panel, click each tab, and confirm no box artifact; Tab-key onto the bar and confirm a visible focus ring appears only then.

**Acceptance Scenarios**:
1. **Given** a tab is activated by mouse click, **When** it renders, **Then** it shows only the accent underline — no side or top outline.
2. **Given** the tab bar is reached by keyboard, **When** a tab has focus, **Then** a visible focus indicator renders around it.

### User Story 2 - Each number appears once (Priority: P1)

The coverage donut renders only in the hero chip. The Coverage section heading names the section without restating the count, and the tab badges stop summing unrelated things: Proof shows a warning-tinted badge only when requirements are uncovered, Notes only when concerns are open.

**Why this priority**: Duplicate representations are the loudest taste violation — four renditions of "6" teach the reader to skim past all of them.

**Independent Test**: Render a fully-covered spec and count donut instances (one) and coverage-count renditions (hero chip + disclosure summary only); render an uncovered/concerned spec and confirm the Proof/Notes badges appear warning-tinted.

**Acceptance Scenarios**:
1. **Given** a spec with coverage, **When** the Proof tab renders, **Then** the Coverage section shows no donut and its heading carries no count.
2. **Given** all requirements covered and no concerns, **When** the tab bar renders, **Then** Proof and Notes render without count badges.
3. **Given** 2 uncovered requirements, **When** the tab bar renders, **Then** Proof carries a warning-tinted "2" badge.
4. **Given** 1 open concern, **When** the tab bar renders, **Then** Notes carries a warning-tinted "1" badge.
5. **Given** decisions and tasks exist, **Then** Decisions and Work keep their plain single-unit count badges.

### User Story 3 - Checks read as a row of pills (Priority: P2)

The verified checks render as content-width pills that wrap like tags, not as a two-column card grid with a ghost hole and mismatched heights. The section is titled "Checks", matching the hero chip's word.

**Why this priority**: The ragged grid is the most visible layout flaw on the default (Proof) tab.

**Independent Test**: Render a spec with 3 checks and confirm the pills sit inline, sized to their text, with no empty grid cell.

**Acceptance Scenarios**:
1. **Given** three checks of different text lengths, **When** the Proof tab renders, **Then** each pill is sized to its content and the row wraps without holes.
2. **Given** the section renders, **Then** its heading reads "Checks", consistent with the hero chip label.

### User Story 4 - Headings have a hierarchy again (Priority: P2)

Section headings (Plan, Checks, Coverage, and the other card titles) render in Title Case at a readable size, while tiny uppercase treatment remains only on inline metadata prefixes (CONTEXT, OUT OF SCOPE, TESTS, WHY, REJECTED). Metadata labels also get a legible color derived from the theme foreground rather than the below-AA description color. Coverage rows drop their list bullets — the requirement chip is the marker. The viewer header title renders the spec name in Title Case instead of the lowercase slug.

**Why this priority**: These are the quiet fixes that make the panel feel designed; none changes behavior.

**Independent Test**: Render the Proof and Decisions tabs and confirm heading case/size, label legibility, bullet removal, and the title-cased header.

**Acceptance Scenarios**:
1. **Given** the Plan section renders, **Then** its heading reads "Plan" in Title Case, visually distinct from the inline CONTEXT/OUT OF SCOPE prefixes.
2. **Given** the Proof tab renders, **Then** "Checks" and "Coverage" are Title Case headings and TESTS remains an uppercase micro-prefix.
3. **Given** coverage rows render, **Then** no list bullet precedes the requirement chip.
4. **Given** a spec named "phases strip", **When** the viewer header renders, **Then** the title reads "Phases Strip".
5. **Given** metadata labels render on a dark theme, **Then** their color derives from the theme foreground (mixed toward transparent), not the description-foreground token.

## Edge Cases

- A spec with zero checks or zero coverage → those sections stay absent (existing contract unchanged).
- Uncovered count changes mid-run (viewer refresh) → the Proof badge appears/disappears accordingly; active tab stays valid.
- Long check text → the pill wraps its text rather than overflowing; the row still packs without holes.
- Hyphens/multiple spaces in spec dir names → title-casing must not merge or drop words.
- Light theme → the color-mixed labels and the focus ring stay visible (token-driven, no hardcoded colors).
- Reduced-motion and high-contrast themes → focus indicator relies on outline/border, not animation.

## Requirements

### Functional Requirements

- **FR-001**: The active tab MUST render only its accent underline on mouse activation; a visible focus indicator MUST render when (and only when) the tab has keyboard focus.
- **FR-002**: The coverage donut MUST render exactly once in the panel (hero chip); the Coverage section heading MUST NOT restate the covered count.
- **FR-003**: The Proof tab badge MUST show the uncovered-requirement count with warning treatment when it is above zero and be absent otherwise; the Notes tab badge MUST do the same for open concerns; Decisions and Work badges keep their single-unit counts.
- **FR-004**: Verified checks MUST render as content-width pills that wrap inline, with no fixed-column grid holes, under the heading "Checks".
- **FR-005**: Section headings MUST render in Title Case at a size visually distinct from inline metadata prefixes, which remain small uppercase.
- **FR-006**: Coverage requirement rows MUST NOT render a list bullet; the requirement chip is the row marker.
- **FR-007**: Metadata label color MUST derive from the theme foreground via color-mix rather than the secondary/description token.
- **FR-008**: The viewer header MUST render the spec name in Title Case.
- **FR-009**: Stories for the changed components MUST cover the new badge states (uncovered vs clean) and the pill layout; tab-model logic MUST be unit-tested.
- **FR-010**: All styling MUST remain token-driven and theme-safe; no capture or schema changes.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Clicking every tab produces zero outline artifacts in a screenshot review; keyboard focus shows a visible ring.
- **SC-002**: A fully-covered, concern-free spec renders exactly one donut and zero mixed-unit badges.
- **SC-003**: The checks row renders with no empty grid cell at common panel widths (600–900px).
- **SC-004**: All jest suites and both tsc configs pass; updated stories render the new states.

## Assumptions

- The hero status line and the viewer header status badge intentionally coexist (page chrome vs panel summary) — out of scope per the issue.
- "Checks" is the unified term (hero chip already says CHECKS); the card component keeps its name.
- Title-casing the header is a presentation transform only; the underlying spec name/slug is unchanged everywhere else.
