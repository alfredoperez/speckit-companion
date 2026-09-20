# Viewer UI Overview — Living Spec

## Purpose

The Overview and its run log, which render a run's durable context, timing and history from what the extension summarised.

## Requirements

### An empty Overview section is not rendered
<!-- touches: apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx -->

Every Overview section except Coverage SHALL hide itself when it has no data.

#### Scenario: a spec recorded no decisions
- **WHEN** the Overview renders
- **THEN** there is no Decisions section

### A failing Overview section is replaced by a notice, never a blank page
<!-- touches: apps/vscode/webview/src/spec-viewer/components/ActivityErrorBoundary.tsx -->

A render failure in the Overview SHALL be caught, reported to the extension, and replaced with an inline notice while the rest of the viewer keeps working.

#### Scenario: a section throws while rendering
- **WHEN** the Overview subtree fails
- **THEN** an inline notice replaces it and the rail and document still work

### Coverage with nothing traced still renders and states the zero
<!-- touches: apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx -->

When coverage rows exist but no requirement has a linked test, the Coverage section SHALL render, state "0 of N traced", and list each untraced requirement.

#### Scenario: coverage has rows but nothing is traced
- **WHEN** the Overview renders
- **THEN** the Coverage section reads "0 of N traced" and lists the untraced requirements

### A named test missing from disk reads differently from a found one
<!-- touches: apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx -->

A row whose named test does not exist SHALL render in a state distinct from both a confirmed test and an unmapped requirement, told apart without colour, and its label SHALL say how many of its named tests were found.

#### Scenario: a requirement names two tests and one is missing
- **WHEN** the Coverage section renders
- **THEN** that row renders in its own state and its label says one of two was found

### Run timing renders the extension's summary as given
<!-- touches: apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx -->

The Overview SHALL show the completion flag, elapsed figure and measured-of-expected phase count the extension sends, and derive no duration of its own. Only a summary that reports itself complete shows a start, elapsed time and end.

#### Scenario: a run is still in flight
- **WHEN** the timing summary reports itself not yet complete
- **THEN** the Overview shows "N of M phases" and no start, elapsed or end figure

### A substep event reads as a recorded moment, not a duration
<!-- touches: apps/vscode/webview/src/spec-viewer/components/TimelineEvent.tsx -->

A recorded substep SHALL read as "recorded at" its timestamp, and the gap between its start and finish SHALL NOT be shown as a duration.

#### Scenario: a tracked substep is shown in the phase history
- **WHEN** it renders
- **THEN** it reads "recorded at" its timestamp with no duration beside it

### A folded phase is presented as folded, never as a near-zero duration
<!-- touches: apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx -->

A phase marked folded SHALL show "folded into" the nearest earlier phase that was not folded, or "folded" when there is none, styled apart from measured phases.

#### Scenario: a fast-path spec is opened
- **WHEN** the run timing strip renders a folded plan phase
- **THEN** it shows "folded into Specify" and the specify phase keeps its measured duration

### Durable context leads the Overview; the run history stays collapsed
<!-- touches: apps/vscode/webview/src/spec-viewer/components/ActivityPanel.tsx -->

The Overview SHALL lead with the run's lifecycle signal and durable context (intent, run timing, touched living specs, verified proof, decisions, coverage), and put phase events, tasks, concerns, files and comments in a collapsed log below.

#### Scenario: a run with a long event history is opened
- **WHEN** the Overview renders
- **THEN** the intent and run timing show first and the event history is collapsed

### Touched living specs are grouped by whether the run updated them
<!-- touches: apps/vscode/webview/src/spec-viewer/components/cards/LivingSpecsCard.tsx -->

Touched living specs SHALL render inside the intent under "Updated by this run" for synced capabilities and "Read for context" for the rest, with an empty group omitted.

#### Scenario: a run synced one capability and only read two
- **WHEN** the Overview renders
- **THEN** one chip sits under "Updated by this run" and two under "Read for context"

### Evidence and assertion do not wear the same mark
<!-- touches: apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx -->

A verification the pipeline ran SHALL keep the check mark and show what it got back. One the run only reported SHALL be quieter and grouped apart, and the section's count SHALL say how many of each. An entry recorded before provenance existed reads as reported.

#### Scenario: a spec carries both kinds
- **WHEN** the Overview renders
- **THEN** the derived ones are marked and grouped apart from the reported ones, and the count names both

#### Scenario: every entry predates provenance
- **WHEN** the Overview renders
- **THEN** they all read as reported

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
