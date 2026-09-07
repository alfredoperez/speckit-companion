# Viewer Activity — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The overview and activity panel: durable context first with the run history collapsed below, sections that hide when empty and never blank the page, and run timing rendered from the summary the extension provides rather than summed in the webview.

## Requirements

### The overview degrades section by section, and a failure never blanks the page

Every section of the overview MUST hide itself when its data is empty, so a spec that recorded little shows a short page rather than a page of empty headings. A render-time failure anywhere in the overview subtree MUST be caught, reported back to the extension for diagnosis, and replaced with an inline notice — one bad section may not take the reading surface down with it.

#### Scenario: a section's data is absent
- **WHEN** a spec recorded no decisions
- **THEN** the decisions section does not render at all

Coverage is the exception to the hide-when-empty rule, because its empty state is a finding rather than an absence, and because the header strip reports the count whether the section renders or not — hiding the section left the page showing the zero and withholding the explanation.

#### Scenario: coverage has rows but nothing is traced
- **WHEN** the coverage rows exist but no requirement has a linked test
- **THEN** the Coverage section renders and states "0 of N traced" plainly
- **AND** each untraced requirement is listed, so the gap is readable rather than merely counted

#### Scenario: a requirement names a test that is not on disk
- **WHEN** a requirement's linked test path does not resolve in the workspace
- **THEN** that row renders in a state distinct from both a confirmed test and an unmapped requirement
- **AND** the label says how many of the named tests were found, so a partially-real link is not read as whole

#### Scenario: a section throws while rendering
- **WHEN** the overview subtree fails
- **THEN** an inline notice replaces it, the error is reported to the extension, and the rest of the viewer keeps working

### Run timing is a summary the extension provides, not a duration the webview sums

Elapsed time and per-phase coverage MUST be read from the timing summary the extension sends, never recomputed in the webview from per-step activity timestamps. The webview SHALL NOT sum step spans, cap idle gaps, or otherwise derive a working-time figure of its own; it renders the summary's completion flag, its elapsed figure, and its measured-of-expected phase count as given. A run that has not settled surfaces phase coverage — "N of M phases" — not a fabricated wall-clock total; only a summary that reports itself complete surfaces a start, an elapsed figure, and an end.

Recorded substep events are journal moments, not measured work. Each event carries the timestamp at which it was recorded, is ordered by it, and is shown as "recorded at" that moment. The webview SHALL NOT present the gap between a substep's start and finish as a duration, because an AI or CLI finish is a cadence record rather than a measured piece of work.

#### Scenario: a run is still in flight
- **WHEN** the timing summary reports itself not yet complete
- **THEN** the run surfaces measured-of-expected phase coverage
- **AND** no start, elapsed, or end figure is shown as if the run had settled

#### Scenario: a spec was driven entirely through the CLI
- **WHEN** the extension now marks a CLI-run's step spans as measured (both boundaries from an authoritative-enough writer) and reports them in the summary
- **THEN** the viewer surfaces that trusted coverage as given rather than "0 of N"
- **AND** the webview still sums nothing itself — the change is in the summary it renders, not in a webview derivation

#### Scenario: a recorded substep event is displayed
- **WHEN** a tracked substep is rendered in the phase history
- **THEN** it reads as "recorded at" its journal timestamp
- **AND** the span between its start and finish is not presented as a work duration

### Durable context leads the panel; the granular run history stays collapsed

The activity panel MUST lead with the run's lifecycle signal and durable context — intent, the run's timing overview, the living specs it touched, verified proof, decisions, coverage — and demote the granular run history (phase events, tasks, concerns, files, comments) into a collapsed log below. The living specs a feature touched and its run-timing overview belong to that durable context and render inline in the overview's intent, not as separate run-log cards. A living-spec chip is always a link that opens its capability by name; a stored spec path, when present, rides along but is not required for the chip to be clickable.

#### Scenario: a spec touched living specs
- **WHEN** the overview renders
- **THEN** the touched capabilities appear as links inside the intent, not as a separate card
- **AND** selecting one opens that capability by name

### A folded phase is presented as folded, never as a near-zero duration

A phase the derivation marks as folded (a fast-path plan or tasks whose boundaries were stamped inside the specify run) MUST NOT render its span as a duration. The run timing strip SHALL render a "folded into" note naming the nearest earlier non-folded phase (a plain "folded" when none exists), with a visual distinct from a measured phase, while measured phases, coverage counts, and the elapsed total render unchanged.

#### Scenario: a fast-path spec is opened
- **WHEN** the run timing strip renders a phase carrying the folded marker
- **THEN** the phase shows "folded into Specify" instead of a sub-second duration
- **AND** the specify phase keeps its real measured duration

## Uncovered

The following files were not read in full — their exported surface and role were established, but their bodies were not reviewed line by line:

- `webview/src/spec-viewer/relativeTime.ts`
- `webview/src/spec-viewer/activityHeroModel.ts`
- `webview/src/spec-viewer/elapsedFormat.ts`
- `webview/src/spec-viewer/components/cards/TasksCard.tsx`
- `webview/src/spec-viewer/components/cards/FilesCard.tsx`
- `webview/src/spec-viewer/components/cards/ConcernsCard.tsx`
- `webview/src/spec-viewer/components/cards/CommentsCard.tsx`
- `webview/src/spec-viewer/components/cards/toStringArray.ts`
