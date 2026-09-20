# Spec Viewer State — Living Spec

<!-- reviewed: 763a4a8b -->

## Purpose

The viewer's judgements about where a spec stands: timing coverage, staleness, quiet-run recovery and completion notices.

## Requirements

### Steps before the recorded current step read as completed
<!-- touches: apps/vscode/src/features/specs/stepHistoryDerivation.ts -->

When the recorded context names a current step but has no entries for the steps before it, those steps SHALL read as completed by their position in the workflow, so none is left pulsing as in flight.

#### Scenario: an external tool advanced the run without per-step detail
- **WHEN** the record's current step is tasks and it holds no specify or plan entries
- **THEN** specify and plan read as completed

### A run without trusted timing shows phase coverage instead of a span
<!-- touches: apps/vscode/src/features/specs/stepHistoryDerivation.ts -->

When any step's duration is not trusted, the viewer SHALL show "X of Y phases" timed instead of a started, elapsed and ended span.

#### Scenario: one step's boundaries are missing
- **WHEN** a step has a start but no trusted close
- **THEN** the viewer shows phase coverage and claims no duration for that step

### Untimed steps are left out of the phase count
<!-- touches: apps/vscode/src/features/spec-viewer/stateDerivation.ts, apps/vscode/src/features/specs/stepHistoryDerivation.ts -->

The phase count's total SHALL exclude steps the workflow declares untimed, such as the status-only completion step.

#### Scenario: a completed run ends with the completion step
- **WHEN** every other step was timed
- **THEN** the run reads as fully covered and shows its started, elapsed and ended span

### One fact has exactly one derivation
<!-- touches: apps/vscode/src/features/living-specs/livingHeaderMeta.ts, apps/vscode/src/features/living-specs/livingSpecsModel.ts -->

A fact the viewer shares with another surface SHALL show the same value in both.

#### Scenario: a capability's coverage is shown in two places
- **WHEN** the viewer header and the Living Specs tree both display a capability's coverage
- **THEN** the two numbers agree

#### Scenario: a requirement count and a coverage ratio are displayed together
- **WHEN** the header shows both a requirement count and a covered-of-total ratio
- **THEN** the count equals the ratio's total

### A document is stale when a document it was built from changed after it
<!-- touches: apps/vscode/src/features/spec-viewer/staleness.ts -->

Staleness SHALL be reported per document: a document is stale when an earlier document in the workflow was modified after it.

#### Scenario: the spec is edited after the plan was written
- **WHEN** the plan's tab renders
- **THEN** the plan is marked stale and the spec is not

### A completed or archived spec shows no staleness
<!-- touches: apps/vscode/src/features/spec-viewer/staleness.ts -->

Staleness SHALL NOT be computed for a completed or archived spec, so the notice and every per-step mark disappear together.

#### Scenario: a spec is marked completed
- **WHEN** its panel renders
- **THEN** no stale notice or stale mark is shown

### A quiet run prompts the reader and never changes status itself
<!-- touches: apps/vscode/src/features/spec-viewer/runRecovery.ts -->

When an in-flight step has had no spec activity past its quiet threshold, the viewer SHALL offer to resume or set the status by hand, judged at render time from disk with no polling. The spec's status SHALL change only when the reader acts.

#### Scenario: a step has been quiet past its threshold
- **WHEN** the panel renders
- **THEN** it asks whether the run is still running and the status is unchanged

### A run quiet for three days leads with closing it out
<!-- touches: apps/vscode/src/features/spec-viewer/runRecovery.ts -->

Once an in-flight spec has been quiet for three days or more, the prompt SHALL say the run looks abandoned and lead with marking it done instead of resuming.

#### Scenario: a long-abandoned run
- **WHEN** an in-flight spec has been quiet for a week
- **THEN** the prompt says it looks abandoned and leads with marking it done

### A quiet run with every task checked leads with marking it complete
<!-- touches: apps/vscode/src/features/spec-viewer/runRecovery.ts -->

When a quiet in-flight spec has every task checked, the prompt SHALL lead with marking the spec complete, at any age past the quiet threshold.

#### Scenario: the work is finished and nobody closed the step
- **WHEN** the spec has been quiet past its threshold with every task checked
- **THEN** the prompt leads with marking it complete

### A step's completion is announced exactly once
<!-- touches: apps/vscode/src/features/spec-viewer/stepCompletionNotifier.ts -->

When a step's recorded completion appears, the viewer SHALL tell the reader once per spec, step and run, and offer to open the spec. The first observation of a spec SHALL seed that memory silently.

#### Scenario: a panel is reopened on a finished spec
- **WHEN** the viewer first observes a spec whose steps are already complete
- **THEN** nothing is announced, and a later new completion is announced once

### Step completion notices can be turned off
<!-- touches: apps/vscode/src/features/spec-viewer/stepCompletionNotifier.ts -->

With `speckit.notifications.stepComplete` off, no step completion SHALL be announced.

#### Scenario: the setting is off and a step completes
- **WHEN** the completion is recorded
- **THEN** no notice appears

### Created and Last Updated are read from history, and hidden rather than guessed
<!-- touches: apps/vscode/src/features/spec-viewer/phaseCalculation.ts -->

Created SHALL come from specify's recorded start, falling back to the earliest recorded start of any step. Last Updated SHALL be the latest of every recorded start and completion, and SHALL be hidden when it would equal Created or when no second timestamp exists. Either date SHALL be hidden, never guessed, when the record is missing, unparseable or carries no step history.

#### Scenario: only one timestamp exists in the record
- **WHEN** the header renders
- **THEN** Created shows and Last Updated is omitted rather than repeating it

## Uncovered

_None: every file in the area was read, though test files under `__tests__/` were read only for the contracts they pin._
