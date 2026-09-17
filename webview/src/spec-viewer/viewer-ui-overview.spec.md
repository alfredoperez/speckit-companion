# Viewer UI Overview — Living Spec

> Adopted from existing code on 2026-07-19 and split by concern on 2026-09-07. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The overview and activity panel, which renders the run's durable context, its timing and its log from what the extension summarised.

## Requirements

### The overview degrades section by section, and a failure never blanks the page

Every overview section MUST hide itself when its data is empty. A render failure anywhere in the overview subtree MUST be caught, reported to the extension, and replaced with an inline notice, so one bad section cannot take the reading surface down.

#### Scenario: a section's data is absent
- **WHEN** a spec recorded no decisions
- **THEN** the decisions section does not render at all

Coverage is the exception to hiding when empty. Its empty state is a finding, and the header strip reports the count whether or not the section renders.

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

Elapsed time and per-phase coverage MUST be read from the timing summary the extension sends, never recomputed from per-step timestamps. The webview SHALL NOT sum step spans, cap idle gaps or derive any working-time figure of its own, and renders the summary's completion flag, elapsed figure and measured-of-expected phase count as given. A run that has not settled shows "N of M phases", and only a summary that reports itself complete shows a start, an elapsed figure and an end.

Recorded substep events are journal moments, ordered by and shown as "recorded at" their timestamp. The webview SHALL NOT present the gap between a substep's start and finish as a duration.

#### Scenario: a run is still in flight
- **WHEN** the timing summary reports itself not yet complete
- **THEN** the run surfaces measured-of-expected phase coverage
- **AND** no start, elapsed or end figure is shown as if the run had settled

#### Scenario: a spec was driven entirely through the CLI
- **WHEN** the extension marks a CLI run's step spans as measured (both boundaries from an authoritative-enough writer) and reports them in the summary
- **THEN** the viewer shows that coverage as given rather than "0 of N"
- **AND** the webview still sums nothing: the change is in the summary it renders, not in a webview derivation

#### Scenario: a recorded substep event is displayed
- **WHEN** a tracked substep is rendered in the phase history
- **THEN** it reads as "recorded at" its journal timestamp
- **AND** the span between its start and finish is not presented as a work duration

### A folded phase is presented as folded, never as a near-zero duration

A phase marked folded (a fast-path plan or tasks whose boundaries were stamped inside the specify run) MUST NOT render its span as a duration. The run timing strip SHALL show a "folded into" note naming the nearest earlier non-folded phase, or a plain "folded" when there is none, styled distinctly from a measured phase. Measured phases, coverage counts and the elapsed total render unchanged.

#### Scenario: a fast-path spec is opened
- **WHEN** the run timing strip renders a phase carrying the folded marker
- **THEN** the phase shows "folded into Specify" instead of a sub-second duration
- **AND** the specify phase keeps its real measured duration

### Durable context leads the panel; the granular run history stays collapsed

The activity panel MUST lead with the run's lifecycle signal and durable context (intent, run timing overview, touched living specs, verified proof, decisions, coverage) and demote the granular run history (phase events, tasks, concerns, files, comments) into a collapsed log below. The touched living specs and the run timing overview render inline in the overview's intent, not as separate run-log cards. A living-spec chip is always a link that opens its capability by name, whether or not a stored spec path rides along.

#### Scenario: a spec touched living specs
- **WHEN** the overview renders
- **THEN** the touched capabilities appear as links inside the intent, not as a separate card
- **AND** selecting one opens that capability by name

### Evidence and assertion do not wear the same mark

A verification the pipeline derived SHALL keep the check mark and show what it actually got back. One the run merely reported SHALL be visibly quieter, grouped apart, and still readable, because a run's account is worth reading but must not look like proof. The section's count SHALL say how many of each.

#### Scenario: a spec carries both kinds
- **WHEN** the Overview renders
- **THEN** the derived ones are marked and grouped apart from the reported ones, and the count names both

#### Scenario: every entry predates provenance
- **WHEN** the Overview renders
- **THEN** they all read as reported, because that is what they are

### A living spec's overview is the capability itself, not a run

In living mode the overview pane MUST render the capability instead of the activity panel: its authored purpose, the paths it covers, its health, and its requirements in document order. Health reads as sentences: how many requirements have a mapped test, whether the source moved since the spec was last updated, and how many requirements are still adopted but unconfirmed, with the tier's "Approve spec" control beside that count. A requirement row opens that requirement, switching the pane to the document within the spec tier, or asking the extension to open the spec there from another tier. The pane renders behind the same failure boundary as the run overview.

#### Scenario: a living spec is opened
- **WHEN** the overview pane renders
- **THEN** it shows purpose, covers, health and one row per requirement, and no run-log cards

#### Scenario: every requirement has been confirmed
- **WHEN** the health section renders
- **THEN** it says so plainly and offers no approval control, because there is nothing left to approve

#### Scenario: a requirement row is chosen from a tier other than the spec
- **WHEN** the reader selects it
- **THEN** the extension is asked to open the spec at that requirement, rather than the pane scrolling a document it is not showing

## Uncovered

The original adoption did not read these files in full. Their exported surface and role were established, but their bodies were not reviewed line by line:

- `webview/src/spec-viewer/relativeTime.ts`
- `webview/src/spec-viewer/activityHeroModel.ts`
- `webview/src/spec-viewer/elapsedFormat.ts`
- `webview/src/spec-viewer/components/cards/TasksCard.tsx`
- `webview/src/spec-viewer/components/cards/FilesCard.tsx`
- `webview/src/spec-viewer/components/cards/ConcernsCard.tsx`
- `webview/src/spec-viewer/components/cards/CommentsCard.tsx`
- `webview/src/spec-viewer/components/cards/toStringArray.ts`
