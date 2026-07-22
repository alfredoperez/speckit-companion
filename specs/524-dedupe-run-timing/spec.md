# Dedupe Run Timing

The same run-timing summary shows up twice in the spec viewer's Activity panel. The always-visible Overview at the top shows a "Run overview" line ("3 of 4 phases") with a strip of phase names and their durations. The collapsed Run log below repeats the identical coverage line and phase strip inside its Phases card. Same numbers, two places. This spec picks one home for each level of detail so a reader sees the at-a-glance summary once and the full breakdown once, with no overlap.

## User Scenarios & Testing

### User Story 1 - Timing summary appears once, at a glance (Priority: P1)

A developer opens a spec in the viewer and looks at the Overview to see how the run is going. They see the compact timing summary — the coverage line and the phase strip with durations — exactly once, at the top, without opening anything. The identical strip is gone from the Run log below, so nothing reads as a copy-paste bug.

**Why this priority**: This is the whole point of the ticket. The duplicate is the visible defect; removing it from the one place a reader lands first is the MVP.

**Independent Test**: Open any spec that has recorded phase timing (e.g. a completed demo fixture). Confirm the "Run overview" summary and phase strip render once in the always-visible Overview. Expand the Run log and confirm the same coverage line and phase strip are not repeated there.

**Acceptance Scenarios**:

1. **Given** a spec with timing for several phases, **When** the viewer opens, **Then** the coverage summary ("N of M phases" or elapsed) and the per-phase strip with durations appear once, in the always-visible Overview.
2. **Given** the Run log is expanded, **When** the reader scans the Phases card, **Then** the same coverage line and the same phase-name strip are not shown a second time.
3. **Given** a spec with no recorded timing, **When** the viewer opens, **Then** neither the Overview summary nor the Phases card show empty timing scaffolding.

### User Story 2 - Run log keeps the detail the Overview can't hold (Priority: P2)

A developer expands the Run log to dig into a run. The Phases card still gives them what the compact Overview strip cannot: the overall Started / Elapsed / Ended timestamps and the per-phase recorded events (the timeline of what happened inside each phase). This is the "differentiate granularity" half — the two views stop overlapping but nothing is lost.

**Why this priority**: The fix must not delete real information. The detailed per-phase event breakdown only lives in the Phases card, so the card must survive with its unique content intact. It is P2 because it is a preservation requirement rather than the headline change.

**Independent Test**: Expand the Run log for a spec that has per-phase events. Confirm the Phases card still shows the Started/Elapsed/Ended block (when the run is complete) and the grouped per-phase event timeline, even though its redundant strip is gone.

**Acceptance Scenarios**:

1. **Given** a completed run, **When** the Phases card renders, **Then** the overall Started / Elapsed / Ended stats still appear there.
2. **Given** a spec whose phases have recorded events, **When** the Phases card renders, **Then** the per-phase grouped event timeline still appears.
3. **Given** the redundant strip is removed from the Phases card, **When** the card would otherwise have nothing unique to show, **Then** the card does not render an empty shell.

## Edge Cases

- A run with timing recorded but **not complete** (no elapsed total): the Overview still shows the coverage line; the Phases card shows only its unique detail (per-phase events), not a duplicate coverage line.
- A run with **no timing at all**: neither surface renders empty timing scaffolding.
- A spec with phases but **no per-phase events and no completed totals**: the Phases card has nothing unique left, so it must collapse to nothing rather than render an empty card.
- A **single-phase** run: the summary still renders once; the strip is not duplicated.

## Requirements

### Functional Requirements

- **FR-001**: The compact run-timing summary (the coverage line and the per-phase strip with durations) MUST render in exactly one always-visible location in the Overview.
- **FR-002**: The Run log's Phases card MUST NOT repeat the coverage line or the per-phase name strip that the Overview already shows.
- **FR-003**: The Phases card MUST retain the information the Overview does not carry — the overall Started / Elapsed / Ended stats and the per-phase recorded event timeline.
- **FR-004**: When the Phases card has no unique content left to show for a given spec, it MUST render nothing rather than an empty card.
- **FR-005**: When a spec has no recorded timing, neither the Overview summary nor the Phases card MUST render empty timing scaffolding.
- **FR-006**: The change MUST be render-only — it MUST NOT alter what timing data is captured or stored in `.spec-context.json`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: For a spec with recorded phase timing, the coverage line and per-phase duration strip appear exactly once across the entire Activity panel (Overview + expanded Run log).
- **SC-002**: The overall Started / Elapsed / Ended stats and the per-phase event timeline remain reachable in the viewer after the change (zero loss of previously shown detail).
- **SC-003**: A spec with no timing shows zero empty timing elements in either surface.
- **SC-004**: No field in `.spec-context.json` changes as a result of this feature.

## Assumptions

- **The Overview keeps the compact summary; the Phases card keeps the detail.** The ticket says to "pick one home (or differentiate granularity)" and decide by eye. The informed default is to differentiate: the always-visible Overview owns the at-a-glance strip (a reader should not have to expand anything to see it), and the collapsed Phases card owns the deeper detail (overall stamps + per-phase event timeline). This keeps the summary where it is seen first and the detail where a reader goes digging. If the maintainer prefers the opposite home by eye, only which component keeps the strip changes — the dedupe outcome is the same.
- Existing timing honesty rules are unchanged: a phase shows a duration only when its span was extension-stamped (trusted); journaled-only phases stay name-only.

## Approach

Differentiate the two components rather than delete either.

- **`webview/src/spec-viewer/components/OverviewDossier.tsx`** — `OverviewTiming` stays as-is; it already owns the compact coverage summary + phase strip in the always-visible Intent section. No change expected beyond confirming it is the single home.
- **`webview/src/spec-viewer/components/cards/PhasesCard.tsx`** — remove the redundant `phases-coverage` line and the `phases-strip` (name + duration) block. Keep the `phases-overall` Started/Elapsed/Ended block and the `phases-events` per-phase timeline. Add the guard so the card renders `null` when it has no overall stats and no events left to show (so it does not become an empty shell).
- **`webview/src/spec-viewer/components/cards/PhasesCard.stories.tsx`** — update the stories to reflect the trimmed card (drop strip-only variants, keep/verify the overall-stats and events variants, add an empty-collapses-to-null variant).
- **CSS (`webview/styles/spec-viewer/_activity.css`)** — drop now-unused `phases-strip` / `phases-coverage` rules if nothing else uses them; leave `phases-overall` / `phases-events` intact.
- **`docs/viewer-states.md`** — update the Activity-panel description if it documents the Phases card's strip.

Dependencies: none. Render-only; no capture or schema change.

## MODIFIED Requirements
<!-- capability: viewer-ui -->

### The Activity panel shows each run-timing detail in exactly one place

The compact run-timing summary (the "N of M phases" coverage line and the per-phase strip with durations) renders only in the always-visible Overview. The collapsed Run log's Phases card no longer repeats it; the card keeps only the overall Started / Elapsed / Ended stamps and the per-phase recorded event timeline, and renders nothing when it has neither.

#### Scenario: Timing summary is not duplicated
- **WHEN** a spec with recorded phase timing is opened and its Run log is expanded
- **THEN** the coverage line and per-phase strip appear once, in the Overview, and are absent from the Phases card

#### Scenario: Phases card collapses when it has no unique content
- **WHEN** the Phases card has no completed timing totals and no recorded per-phase events
- **THEN** it renders nothing rather than an empty card
