# Move a Spec Forward — Living Spec

## Purpose

A person watches a run, sees which step it is on, and pushes it to the next step, re-runs a step, or closes the spec, all from the viewer. Without this the viewer is a reader only, and a wrong button at the wrong moment re-runs finished work or strands a spec with no way forward.

## Requirements

### Each rail entry shows the state of its step
<!-- touches: apps/vscode/webview/src/spec-viewer/components/StepTab.tsx, apps/vscode/webview/src/spec-viewer/stepInFlight.ts, apps/vscode/src/features/spec-viewer/stateDerivation.ts -->

A rail entry SHALL show one state: locked, in flight, done, current or not started, in that order of precedence. Done carries a check mark and requires the step's document to exist, even when the run recorded the step complete. In flight carries a spinning glyph and a timer counting from the step's recorded start, and it ends the moment a completion is recorded for that step, even if the spec's status has not caught up. A step before the run's current step counts as complete even when the run never recorded it.

#### Scenario: the record says done but the file is missing
- **WHEN** the run record marks plan complete and plan.md does not exist
- **THEN** the Plan entry shows no check mark

#### Scenario: a step finishes
- **WHEN** a completion is recorded for the running step
- **THEN** its spinner and timer disappear on the next refresh

### Implement progress is counted from the task checkboxes
<!-- touches: apps/vscode/webview/src/spec-viewer/components/StepTab.tsx, apps/vscode/src/features/spec-viewer/phaseCalculation.ts -->

While implement is running, the rail SHALL show a live percentage counted from the checked boxes in tasks.md, so it advances as work lands without waiting for the run to report. The percentage sits on the implement entry when the workflow gives implement a document, and otherwise on the last rail entry.

#### Scenario: the built-in workflow
- **WHEN** implement is running and 6 of 10 task boxes are checked
- **THEN** the Tasks entry shows a spinner and 60%

### One forward button advances the run, and only from the step the run is on
<!-- touches: apps/vscode/src/features/spec-viewer/footerActions.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/webview/src/spec-viewer/components/footer/CatalogFooter.tsx -->

The footer SHALL offer at most one forward button, labelled with the next step's own name and announced by a `Next: <step>` line. It shows only when the tab being read is the run's current step, that step has started, nothing later in the workflow has happened since, the step is not in flight, and the spec is not implemented, completed or archived. Pressing it SHALL record the current step complete, record the next step started, and send the next step's command to the configured AI provider, walking every step of the workflow in order so action-only steps are not skipped. The implement step offers no forward button unless the workflow places a real step after it.

#### Scenario: a past tab
- **WHEN** the run is on tasks and the person is reading the Spec tab
- **THEN** no forward button shows, so an old step cannot be dispatched again

#### Scenario: the step is still running
- **WHEN** the current step is in flight
- **THEN** the forward button is absent and the footer reads "Step running, actions unlock when it settles"

### Regenerate re-runs the step the run is on
<!-- touches: apps/vscode/src/features/spec-viewer/footerActions.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

Regenerate SHALL be offered when the step being read has started and the spec is not completed or archived. It SHALL re-run the run's current step, not the tab or sub-document being read, recording a fresh start for that step before sending its command.

#### Scenario: regenerate from a sub-document
- **WHEN** the person presses Regenerate while reading the data model and the run is on plan
- **THEN** the plan command is sent and a plan start is recorded

### Closing and reopening a spec happens only at the end of the run
<!-- touches: apps/vscode/src/features/spec-viewer/footerActions.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts -->

Mark Completed and Archive SHALL appear only once the spec is implemented or completed, so they never show while a step is being generated. Reactivate SHALL appear on a completed or archived spec. Each one writes the new status to the run record, refreshes the sidebar and the viewer, and confirms with a notification. A completed spec's footer reads "Run complete" and an archived one reads "Archived, read-only".

#### Scenario: implement finishes
- **WHEN** the spec's status becomes implemented
- **THEN** the footer offers Mark Completed and Archive and no forward button

#### Scenario: mid-run
- **WHEN** the spec is planning
- **THEN** neither Mark Completed nor Archive is offered

### Spec Kit's optional commands and the user's custom commands sit on the tab they belong to
<!-- touches: apps/vscode/src/features/spec-viewer/optionalCommands.ts, apps/vscode/src/features/spec-viewer/customCommands.ts, apps/vscode/webview/src/spec-viewer/components/footer/CatalogFooter.tsx -->

The footer's Other actions menu SHALL offer Clarify on the Spec tab, Checklist on the Plan tab and Analyze on the Tasks tab with no configuration, plus every `speckit.customCommands` entry written in object form whose step matches the tab being read or, for a step with no document, the run's current step. A custom command with the same command as a built-in one replaces it. The menu is hidden when it would be empty and once the spec is implemented, completed or archived. Choosing an entry sends that command, with the spec's path, to the configured AI provider.

#### Scenario: the plan tab
- **WHEN** an active spec's Plan tab is open and no custom commands are configured
- **THEN** Other actions lists Checklist only

#### Scenario: a spec at its closure gate
- **WHEN** the footer offers Mark Completed
- **THEN** the Other actions menu is not shown

### A run that has gone quiet offers a way out and never changes status on its own
<!-- touches: apps/vscode/src/features/spec-viewer/runRecovery.ts, apps/vscode/webview/src/spec-viewer/components/NavigationBar.tsx -->

When a step is in flight and nothing in the spec folder has been written for longer than that step's quiet threshold, the viewer SHALL show a strip saying how long it has been quiet. Within three days it asks whether the run is still going and leads with Resume. After three days, or whenever every task is already checked, it says the run looks finished or abandoned and leads with Mark complete. Both forms offer Set status. The viewer SHALL never change the status itself, and thresholds are longer for steps that think between writes (45 minutes for specify and plan) than for implement (25 minutes).

#### Scenario: implement stalls
- **WHEN** implement is in flight and no file changed for 30 minutes
- **THEN** a strip says nothing has happened for 30m, asks whether the run is still going, and offers Resume and Set status

#### Scenario: all tasks done but never closed
- **WHEN** implement is in flight, every task box is checked and the folder has been quiet past the threshold
- **THEN** the strip suggests marking the spec complete

### A finished step raises a notification
<!-- touches: apps/vscode/src/features/spec-viewer/stepCompletionNotifier.ts -->

While a spec's viewer is open, a step that goes from running to complete SHALL raise one notification naming the spec number and the step, with an Open spec action. Steps already complete when the viewer first saw the spec SHALL not notify, and the same completion never notifies twice. Setting `speckit.notifications.stepComplete` to false turns these off.

#### Scenario: opening a half-finished spec
- **WHEN** a viewer opens a spec whose specify and plan steps are already complete
- **THEN** no notification appears for either

#### Scenario: plan completes while the viewer is open
- **WHEN** the run record gains a completion for plan
- **THEN** one notification reads "Spec 041 · Plan complete"
