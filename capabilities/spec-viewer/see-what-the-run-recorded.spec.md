# See What the Run Recorded — Living Spec

## Purpose

A person opens a spec someone else ran and reads, in one page, why the work was done, what was ruled out, what was checked, which choices were made and which requirements have no evidence behind them. Without this, the only record of a run is a diff and a chat log that nobody else can see, and every question about a finished spec is answered by guessing.

## Requirements

### Every document carries the spec's standing above it
<!-- touches: apps/vscode/webview/src/spec-viewer/components/SpecHeader.tsx, apps/vscode/webview/src/spec-viewer/components/RunStrip.tsx -->

A band above the document SHALL show the spec's recorded name, its status, its branch and the date it was created, read from the same run record the sidebar reads so the two cannot disagree. Beside it sits a strip of run facts the status and the rail do not already say: tasks done out of total, requirements traced, concerns, checks, elapsed time and a link to the pull request. Facts SHALL drop from the least important end as the pane narrows, and the strip SHALL not render when there is nothing to say.

#### Scenario: nothing recorded but the name
- **WHEN** a spec has a name and a status but no counts, no timing and no pull request
- **THEN** the band shows the name and status and no facts strip

### The Overview is a reading of the record, and nothing on it acts
<!-- touches: apps/vscode/webview/src/spec-viewer/components/ActivityPanel.tsx, apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx -->

The Overview SHALL present what the run wrote down in a fixed order: intent, then the fence around the work, then what was checked, then the decisions, then coverage. A region with nothing recorded in it SHALL not render at all, so the shape of the page reports how much of the run was recorded. Nothing on the page runs, re-runs or re-checks anything.

#### Scenario: a run that recorded only its intent
- **WHEN** the run wrote an intent and nothing else
- **THEN** the page shows the intent region alone, not empty frames for the rest

#### Scenario: a spec with an empty record
- **WHEN** the Overview is opened on a spec whose record holds nothing
- **THEN** it says no activity was recorded yet

### Each region's head carries the count worth skimming
<!-- touches: apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx -->

Every region SHALL name itself, say what it is for, and carry a count, so the reader can tell which region deserves a close read without reading any of them. A count that reports a gap, such as requirements without evidence or checks that warned, SHALL be marked as a warning rather than reading like every other number.

#### Scenario: partial coverage
- **WHEN** four of seven requirements have evidence
- **THEN** the coverage head reads four of seven traced, in a warning tone

### What something else measured is kept apart from what the run claimed
<!-- touches: apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx -->

A verification produced by something other than the assistant SHALL be shown as checked, and one the assistant reported about itself SHALL be shown separately as its own account. The count SHALL say how many of each. Warnings the run judged benign are kept beside their check rather than dropped.

#### Scenario: a mix
- **WHEN** three checks were measured and one is the assistant's own report
- **THEN** the head reads three checked and one reported, and the reported one is set apart

### Coverage has three states, and the gaps come first
<!-- touches: apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx -->

A coverage row SHALL land in one of three states: it has tests, it has none, or it names tests that are not on disk. The third SHALL never render like the first, because a test that does not exist reads as coverage that does. Rows with no evidence SHALL sort above rows that have it, only the first few show, and the rest sit behind a disclosure. The check is existence only: nothing is run and nothing is proved to pass.

#### Scenario: a named test that is not there
- **WHEN** a requirement names two tests and neither file exists
- **THEN** the row says both tests were not found, rather than showing two tests as evidence

#### Scenario: nothing traced at all
- **WHEN** requirements were recorded and none of them has evidence
- **THEN** the table still renders and says so

### A phase claims a duration only when both ends were recorded
<!-- touches: apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx -->

The run overview SHALL list one entry per phase and show an elapsed time only for a phase whose start and finish were both recorded and trusted. Otherwise it reports how many phases were measured out of how many were expected, or that timing was not recorded. A phase the run collapsed into an earlier one SHALL say which one it folded into, and a phase still running SHALL be marked in flight with no duration.

#### Scenario: a half-measured run
- **WHEN** two of four phases have both ends recorded
- **THEN** the head reads timing coverage two of four phases and the unmeasured phases show no number

### The granular work log stays out of the first read
<!-- touches: apps/vscode/webview/src/spec-viewer/components/ActivityPanel.tsx, apps/vscode/webview/src/spec-viewer/components/cards/** -->

The per-phase timeline, the per-task records, the concerns, the files touched and the review comments SHALL sit behind one collapsed disclosure below the durable record, and its summary SHALL say how many task records are inside. It renders only when at least one of those has something in it.

#### Scenario: looking for the files a run touched
- **WHEN** the reader opens the run log
- **THEN** the latest finishes, the phase timeline, the task records, the concerns, the files touched and the review comments are there

### One failing region does not take the page down
<!-- touches: apps/vscode/webview/src/spec-viewer/components/ActivityErrorBoundary.tsx -->

A region that fails while rendering SHALL be replaced by a notice pointing at the extension's log, and the rest of the viewer SHALL keep working.

#### Scenario: a malformed record
- **WHEN** one region's recorded data makes it throw while rendering
- **THEN** the page shows a notice in place of the Overview and the document, rail and footer still work
