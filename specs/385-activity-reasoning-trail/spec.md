# Feature Specification: Activity panel renders the reasoning trail

**Feature**: 385-activity-reasoning-trail
**Source**: [#397](https://github.com/alfredoperez/speckit-companion/issues/397)

## Overview

The spec context now captures a run's reasoning trail — the goal and non-goals, decisions with the why and the rejected alternative, what was verified, and a requirement→task→test coverage map — but the spec viewer's Activity panel predates it. Structured decisions are silently filtered out (a regression: the Decisions card renders nothing for newly-captured specs), and the other new fields have no surface at all. This feature makes the Activity panel show what the product now records.

## User Scenarios & Testing

### User Story 1 - Decisions show again, now with their reasoning (Priority: P1)

A developer opens a spec that was run through the current pipeline. The Decisions card lists every decision — and for structured entries, the why and the alternative that was rejected — instead of rendering nothing.

**Why this priority**: This is a regression: data the product writes today is invisible. Everything else is additive; this is broken.

**Independent Test**: Open a spec whose context carries structured decisions (e.g. spec 384); the card lists all five with their detail. Open an old spec with string decisions; it renders as before.

**Acceptance Scenarios**:
1. **Given** a context with structured decision entries, **When** the Activity panel renders, **Then** each decision's text appears, with its why and rejected alternative visible.
2. **Given** a context with legacy string decisions, **When** the panel renders, **Then** they render exactly as before.
3. **Given** a context mixing both shapes, **When** the panel renders, **Then** all entries appear in order.

### User Story 2 - See the goal and the fence (Priority: P1)

The panel shows what the spec was *for* — the one-line intent — and what was deliberately left out (the expectations list), so a reviewer or resumer orients without re-reading the spec document.

**Why this priority**: Intent/expectations are the first things a resume needs; they're cheap to render and already captured.

**Independent Test**: Open spec 384; the panel shows the intent sentence and its four out-of-scope items.

**Acceptance Scenarios**:
1. **Given** a context with `intent`, **When** the panel renders, **Then** the goal appears in its own card.
2. **Given** `expectations` entries, **When** the panel renders, **Then** they appear as an out-of-scope list in the same card.
3. **Given** neither field, **Then** the card is absent — no empty shell.

### User Story 3 - See what was verified (Priority: P2)

The panel lists the checks that proved the work: what was checked, the command, the result, and any warnings that were seen and dismissed.

**Why this priority**: The audit-critical record; second only to the regression fix and the goal.

**Independent Test**: Open spec 384; the panel shows both checks (jest suite, compile) with results, including the dismissed ts-jest warning.

**Acceptance Scenarios**:
1. **Given** `verified` entries, **When** the panel renders, **Then** each shows its what + result (command and warnings when present).
2. **Given** a bare-string verification, **Then** it renders as its text.

### User Story 4 - Requirement coverage at a glance (Priority: P2)

The panel shows the requirement coverage map — for each requirement, the tasks that built it and the tests that cover it — with a covered/total rollup, so "is FR-7 tested?" is answerable from the panel.

**Why this priority**: The richest structured capture; valuable but denser UI, so after the essentials.

**Independent Test**: Open spec 384; the coverage card shows 11 requirements, each with tasks and tests, and the rollup count.

**Acceptance Scenarios**:
1. **Given** a `coverage` map, **When** the panel renders, **Then** each requirement lists its tasks and tests.
2. **Given** entries with tests present, **Then** the card's header shows a covered/total rollup (covered = has ≥1 test).
3. **Given** no coverage map, **Then** the card is absent.

### User Story 5 - The sizing call is visible (Priority: P3)

The panel surfaces the classification behind the pipeline's sizing — projected files/tasks and scope signal alongside the verdict — so a reader can judge whether the size call was borderline.

**Why this priority**: Small, contextual; rides along with the approach display.

**Independent Test**: Open spec 384; near the approach, the panel shows "normal · 8 files / 12 tasks projected".

**Acceptance Scenarios**:
1. **Given** a `classification` object, **When** the panel renders, **Then** its inputs and verdict appear near the approach.
2. **Given** only the legacy scalar `size`, **Then** the panel renders as today.

## Edge Cases

- Mixed string/object entries in the same list → all render, each by its shape.
- Malformed entries (object without the identity key, unexpected types) → skipped silently, never a blank panel or a thrown render.
- Very long why/rejected/warning strings → wrap, never overflow the card (existing card conventions).
- User data in all new fields must be rendered safely (no HTML injection via decision text etc.).
- Old specs with none of the new fields → panel is byte-for-byte what it is today.

## Requirements

### Functional Requirements

- **FR-001**: The viewer state derivation MUST normalize `decisions` entries of both shapes (string, structured) into a single renderable form, preserving order.
- **FR-002**: The Decisions card MUST render structured detail (why, rejected alternative) when present.
- **FR-003**: The panel MUST render `intent` and `expectations` in a goal card, absent when neither field exists.
- **FR-004**: The panel MUST render `verified` entries (what, result, command, warnings), tolerating bare strings.
- **FR-005**: The panel MUST render the `coverage` map with per-requirement tasks/tests and a covered/total rollup.
- **FR-006**: The panel MUST surface `classification` (inputs + verdict) alongside the approach when present.
- **FR-007**: All new rendering MUST degrade to today's output when the fields are absent, and MUST skip malformed entries without failing the render.
- **FR-008**: User-supplied strings in the new fields MUST be rendered via safe DOM/text paths (no attribute/HTML injection).
- **FR-009**: New/changed cards MUST have Storybook stories covering the new states, and the derivation normalization MUST be unit-tested.
- **FR-010**: The README's Reading Specs section and the relevant docs MUST describe the new panel content in the same change.
- **FR-011**: The capture writer MUST accept a requirement title on coverage upserts (non-destructive, like tasks/tests), and the tasks step MUST emit it — so requirements are captured as readable text, not just ids.
- **FR-012**: The Coverage card MUST render the requirement title beside its id when present, and the id alone when not.
- **FR-013**: Before the feature is finished, the rendered panel MUST pass a design critique (design-taste principles + webview invariants), and accepted findings MUST be applied in the same change.

### Key Entities

- **Normalized decision**: `{decision, why?, rejected?}` — from either capture shape.
- **Normalized verification**: `{what, result?, command?, warnings?}`.
- **Coverage row**: requirement id → `{tasks[], tests[]}`, covered = has ≥1 test.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Opening spec 384 shows 5 decisions with detail, the intent + 4 expectations, 2 verifications, and an 11-requirement coverage card — where today it shows zero of these.
- **SC-002**: Opening a pre-#392 spec renders the Activity panel identically to today (no new empty cards, no regressions).
- **SC-003**: 100% of new cards/states are covered by stories and the normalization by unit tests, green in CI.
- **SC-004**: No unsafe interpolation of user data introduced (review checklist webview rules hold).

## Assumptions

- The Activity panel's existing card conventions (absent-when-empty, Preact, string `style`) carry over; no visual redesign.
- Classification renders as a compact line within/near the existing Approach card rather than a separate card.
- Living-specs rendering (#394) remains out of scope — kept last deliberately.
- No `.spec-context.json` schema changes; this is read-side only.
