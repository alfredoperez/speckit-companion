# Feature Specification: Label fast-path folded steps instead of showing "<1s"

**Feature Branch**: `532-folded-steps-label`
**Created**: 2026-07-23
**Status**: Draft
**Input**: Issue #523 — Fast-path folded steps show a misleading "<1s" — label them "folded into Specify"

## User Scenarios & Testing

### User Story 1 - A fast-path run reads as folded, not broken (Priority: P1)

A developer runs a small change through the Companion fast path. Specify does the planning and task work inline, and the extension stamps the plan and tasks lifecycle boundaries back-to-back in the same instant. When the developer opens the spec viewer's Overview, the run timing strip currently shows `Plan <1s` and `Tasks <1s` — which reads like the pipeline skipped work or the clock broke. Instead, those phases should present as what they are: folded into the Specify run.

**Why this priority**: This is the whole issue — the near-zero duration is the misleading artifact users see on every fast-path run, and fast-path is the default behavior for small changes.

**Independent Test**: Open a fast-path spec (e.g. `specs/528-footer-done-guard`) in the viewer and look at the Run overview strip: Plan and Tasks must carry a folded label, not `<1s`.

**Acceptance Scenarios**:

1. **Given** a spec whose plan and tasks boundaries were stamped by the extension within the fold window right after specify completed, **When** the Overview's run timing strip renders, **Then** Plan and Tasks show a "folded into Specify" note instead of a duration.
2. **Given** the same spec, **When** the strip renders, **Then** the Specify phase still shows its real measured duration (e.g. 5m 47s).
3. **Given** a folded phase, **When** it renders, **Then** it is visually distinct from a measured phase (a reader can tell fold from measurement at a glance).

### User Story 2 - Real durations stay real (Priority: P2)

A developer runs the full pipeline where every phase did real work. Nothing about their timing display changes: measured phases keep their durations, in-flight phases keep their in-flight treatment, and untrusted spans keep showing no duration.

**Why this priority**: The fix must not misclassify genuine work as folded — a false "folded" label would be worse than the current false "<1s".

**Independent Test**: Open a normal-pipeline spec and confirm every phase renders exactly as before.

**Acceptance Scenarios**:

1. **Given** a spec whose plan step ran for minutes with extension-stamped boundaries, **When** the strip renders, **Then** the plan phase shows its real duration and no folded note.
2. **Given** a phase with an untrusted span (missing or AI-typed boundaries), **When** the strip renders, **Then** it shows no duration and no folded note — unchanged behavior.

### User Story 3 - One derivation, every surface agrees (Priority: P2)

The "this phase was folded" fact is derived once, next to where spans and trust are already derived, and every consumer reads that one flag. No component re-implements a near-zero threshold of its own.

**Why this priority**: Repo rule — one fact, one derivation. Two thresholds in two components will drift.

**Independent Test**: The derivation unit tests pin the folded flag; the renderer test only reads it.

**Acceptance Scenarios**:

1. **Given** the lifecycle history of a fast-path run, **When** step history is derived, **Then** the folded plan and tasks entries carry a folded marker and specify does not.
2. **Given** a same-instant fold (start equals complete, span untrusted), **When** step history is derived, **Then** the entry still carries the folded marker.

## Edge Cases

- Same-instant fold: the extension stamps start and complete at the same millisecond — the span is untrusted (no strictly positive duration) but the phase is still folded and must be labeled as such.
- A phase whose sub-second span is *not* adjacent to the previous phase's close (e.g. a manual instant re-run minutes later) must not claim "folded into Specify" — only the deterministic fast-path signature (own boundaries within the fold window of each other *and* of the previous phase's close) reads as folded.
- Tasks folds "into Specify" transitively — its immediate predecessor is the folded Plan; the label anchors to the nearest earlier phase that is not itself folded.
- The run-timing coverage ("N of M phases", total elapsed) must not change: folded phases still count as measured, so a completed fast-path run keeps reading 4 of 4 with the same elapsed total.
- Specs with no folded steps, in-flight specs, and legacy specs with AI-typed history render byte-identically to today.

## Requirements

### Functional Requirements

- **FR-001**: A phase whose lifecycle boundaries were folded into the specify run MUST NOT render a near-zero duration in the viewer; it MUST render a folded note instead.
- **FR-002**: The folded note MUST name the phase the work was folded into, anchored to the nearest earlier non-folded phase (for the fast path: "folded into Specify").
- **FR-003**: Folded detection MUST be derived exactly once, in the shared step-history derivation, and exposed as a flag on the derived step entry; viewer components MUST read the flag rather than re-deriving a threshold.
- **FR-004**: A phase reads as folded only on the deterministic fast-path signature: both boundaries extension-stamped at step level, its own span inside the fold window, and its start inside the fold window of the previous phase's close. Anything else keeps today's rendering.
- **FR-005**: A same-instant fold (start equals complete) MUST also read as folded, even though its span is not a trusted duration.
- **FR-006**: Folded phases MUST keep counting as measured phases in the run-timing summary — coverage counts and total elapsed are unchanged.
- **FR-007**: A folded phase MUST be visually distinct from measured phases in the run timing strip.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Opening a real fast-path spec shows zero "<1s" phase durations; the folded phases carry the folded note (verify by eye against `specs/528-footer-done-guard`).
- **SC-002**: All existing viewer timing tests pass unchanged for non-folded specs — zero regressions in rendered output.
- **SC-003**: New tests pin both directions: a folded plan/tasks never renders "<1s", and a genuinely fast-but-unfolded phase never renders the folded note.

## Assumptions

- The fold window is 1 second: the extension stamps the whole fold chain back-to-back in one hook run (observed real gaps are under 350ms), while any real phase run through an AI command takes multiple seconds. A constant in the derivation, not a user setting.
- The folded note's wording is "folded into <Phase>" (sentence case phase name), matching the issue's suggested phrasing.
- The Phases card needs no change: folded steps record no substep events, so the card already renders nothing for them; the only misleading surface is the Run overview strip in the Overview dossier.

## Approach

- Derive a `folded` flag in `deriveStepHistory` (`src/features/specs/stepHistoryDerivation.ts`), where spans and trust are already computed: a step is folded when it has a single extension-stamped step-level start, an extension-stamped step-level complete within 1s of it, and that start lands within 1s of the previous step group's extension-stamped close. Add `folded?: boolean` to `StepHistoryEntry` in `src/core/types/specContext.ts` and mirror it in `webview/src/spec-viewer/types.ts`.
- In `OverviewTiming` (`webview/src/spec-viewer/components/OverviewDossier.tsx`), render `folded into <anchor>` (nearest earlier non-folded phase) instead of the duration, with an `is-folded` phase class; style the note in the dossier CSS partial.
- Tests: derivation cases (fast-path fold, same-instant fold, non-adjacent sub-second span, normal run) + renderer cases (folded label present, `<1s` absent, anchor naming). Update `ActivityPanel`/`PageChrome` stories with a fast-path folded variant.
- Docs: `docs/viewer-states.md` timing section + root `CHANGELOG.md` under Unreleased.

## ADDED Requirements
<!-- capability: viewer-ui -->

### A folded phase is presented as folded, never as a near-zero duration

A phase the derivation marks as folded (a fast-path plan or tasks whose boundaries were stamped inside the specify run) MUST NOT render its span as a duration. The run timing strip SHALL render a "folded into" note naming the nearest earlier non-folded phase (a plain "folded" when none exists), with a visual distinct from a measured phase, while measured phases, coverage counts, and the elapsed total render unchanged.

#### Scenario: a fast-path spec is opened
- **WHEN** the run timing strip renders a phase carrying the folded marker
- **THEN** the phase shows "folded into Specify" instead of a sub-second duration
- **AND** the specify phase keeps its real measured duration

## ADDED Requirements
<!-- capability: specs -->

### A fast-path folded step is derived as folded, once

The shared step-history derivation SHALL mark a step folded when its own extension-stamped step-level start/complete pair spans under one second and its start lands within one second of the previous step's extension-stamped close — anchored on the stamped pair, never on the derived close, which can be a much later next-step start. The flag is independent of duration trust (a same-instant fold is folded but untrusted), is set nowhere else, and folded steps keep counting as measured timing coverage.

#### Scenario: a fast-path run's history is derived
- **WHEN** plan and tasks were stamped back-to-back inside the specify run
- **THEN** their derived entries carry the folded marker and specify's does not

#### Scenario: a sub-second step far from the previous close
- **WHEN** a step's stamped pair spans under a second but starts minutes after the previous step closed
- **THEN** its entry carries no folded marker
