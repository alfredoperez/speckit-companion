# Feature Specification: Activity panel redesign — brief, tabs, and signature data elements

**Feature**: 387-activity-redesign
**Source**: [#400](https://github.com/alfredoperez/speckit-companion/issues/400)

## Overview

The Activity panel has the reasoning trail but presents it as eleven flat cards in one long scroll — an inventory, not a brief. This redesign makes the panel answer a reviewer's questions in reading order: a hero strip says how the run stands at a glance, an always-visible Plan section presents the full Intent/Context/Expectations triad plus the approach, and everything else lives behind a compact tab bar. Signature visual elements (a coverage donut, big-numeral chips, check pills, state-colored requirement chips, proportional duration bars) make the data legible before a single word is read.

## User Scenarios & Testing

### User Story 1 - Orient in two seconds (Priority: P1)

A reviewer opens the panel and immediately sees how the run stands: status, size, honest active time, and four stat chips — tasks done, requirements covered, checks passed, concerns open. Clicking a chip jumps to the matching detail tab.

**Why this priority**: The summary is the design's spine; every other section hangs off it.

**Acceptance Scenarios**:
1. **Given** a completed rich spec, **When** the panel renders, **Then** the hero shows status, size verdict, active time (trusted spans only), and the four chips with correct counts.
2. **Given** a chip is clicked, **Then** the matching tab activates and scrolls into view.
3. **Given** concerns > 0, **Then** the concerns chip carries a visible warning treatment.

### User Story 2 - Read the plan without scrolling (Priority: P1)

Below the hero, the Plan section presents the ICE triad — the intent as a large lede sentence, the context the run worked from, the out-of-scope fence — plus the approach and the sizing call, always visible.

**Why this priority**: "What was this for and what did it know" is the first substantive question; it must not hide in a tab.

**Acceptance Scenarios**:
1. **Given** a spec with intent/context/expectations/approach, **Then** all four render in the Plan section in that order.
2. **Given** none of those fields, **Then** the section is absent entirely.

### User Story 3 - Everything else one tab away (Priority: P1)

The remaining content sits behind a tab bar — Decisions, Work (timeline + tasks + files), Proof (verified + coverage), Notes (concerns + comments + living specs) — with count badges, keyboard navigation, and only non-empty tabs rendered.

**Why this priority**: The tabs are what kill the wall-of-lists scroll.

**Acceptance Scenarios**:
1. **Given** a rich spec, **Then** four tabs render with correct count badges and the existing cards inside.
2. **Given** a spec with no verified/coverage, **Then** the Proof tab is absent.
3. **Given** keyboard focus on the tab bar, **Then** arrow keys move between tabs (tablist semantics).
4. **Given** anything uncovered or concerning, **Then** Proof is the default tab; otherwise Decisions.

### User Story 4 - Data reads as data (Priority: P2)

The signature elements land: a coverage donut (hero chip + Proof), big-numeral chips, verified as pass/warning pills, requirement chips tinted by covered state, circled ordinals on decisions, and duration bars on the timeline proportional to trusted spans.

**Why this priority**: This is the "cool elements" ask — the difference between readable and glanceable.

**Acceptance Scenarios**:
1. **Given** partial coverage, **Then** the donut shows the gap in warning tint and the uncovered requirement chips are amber.
2. **Given** a verification with warnings, **Then** its pill renders amber; passes render green-tinted.
3. **Given** untrusted step spans, **Then** no duration bar is drawn for them (bars only for trusted durations).

### User Story 5 - Old specs degrade gracefully (Priority: P2)

A pre-capture spec renders a sensible panel: the hero shows what exists (status, tasks), Plan collapses away, and only populated tabs appear — roughly today's content without the new chrome pretending data exists.

**Acceptance Scenarios**:
1. **Given** a legacy spec with only history/tasks, **Then** the panel renders hero (status + tasks chip) + Work tab and nothing else.
2. **Given** an empty context, **Then** the existing "No activity recorded yet" state is preserved.

## Edge Cases

- Narrow panel widths → chips wrap, tabs scroll horizontally, nothing overflows.
- Very long intent/approach strings → wrap as prose, never clip.
- Tab with data arriving mid-run (viewer refresh) → tab appears; active tab stays if still valid, else falls back to the default rule.
- All user strings render as text nodes (no attribute/HTML injection).
- Light and dark themes → all tints via tokens/`color-mix`, no hardcoded colors.

## Requirements

### Functional Requirements

- **FR-001**: The panel MUST open with a hero strip: status, size verdict, trusted active time, and stat chips (tasks, covered, checks, concerns) that activate their tab.
- **FR-002**: A Plan section MUST render intent (lede), context, expectations, approach + sizing — always visible, absent only when all are missing.
- **FR-003**: Remaining content MUST render inside an accessible tab bar (tablist/tab/tabpanel semantics, arrow-key navigation) with count badges; empty tabs MUST not render.
- **FR-004**: The default tab MUST be Proof when uncovered requirements or concerns exist, else Decisions, else the first non-empty tab.
- **FR-005**: Coverage MUST render a donut/progress visual plus state-tinted requirement chips (covered vs uncovered).
- **FR-006**: Verified MUST render as pass/warning pills with the check name and result.
- **FR-007**: The phase timeline MUST draw duration bars proportional to trusted spans only.
- **FR-008**: Decisions MUST render with circled ordinal markers and their why/rejected detail.
- **FR-009**: Legacy specs MUST degrade to hero + populated tabs with no empty chrome; the empty state is preserved.
- **FR-010**: All styling MUST be token-driven and theme-safe; color encodes state only.
- **FR-011**: New/changed components MUST have stories covering rich, sparse, and mid-pipeline payloads, and the tab/hero logic MUST be unit-tested.
- **FR-012**: The change MUST pass a visual verification loop: Storybook screenshots reviewed, an impeccable detect pass on rendered stories and source styles with findings fixed, and a design-taste critique applied.
- **FR-013**: The README's Activity section MUST be rewritten to match, with the root changelog entry, in the same change.

### Key Entities

- **Hero stats**: derived counts — tasks done/total, covered/total, checks, concerns — plus trusted active time.
- **Tab**: id, label, count, content (existing cards), non-empty predicate.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Opening spec 385/386 shows the hero + full Plan (ICE triad) + 4 tabs; total above-the-fold height ≤ ~2 viewport-thirds at 900px width.
- **SC-002**: A pre-capture demo spec renders with zero empty sections and no visual regression versus intent.
- **SC-003**: impeccable detect reports zero findings on the new/changed styles and rendered stories.
- **SC-004**: All suites green; stories cover the three payload classes; screenshots attached to the PR.

## Assumptions

- Existing cards render inside tabs unchanged where possible; the redesign is composition + hero + tabs + element styling.
- Tab state is in-memory only (no persistence across reopens).
- The Phases timeline remains the Work tab's centerpiece; duration bars extend it rather than replacing it.
- Screenshot capture uses Storybook + a headless browser; final shots ride the PR body.
