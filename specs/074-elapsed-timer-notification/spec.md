# Spec: Elapsed Timer and Step-Complete Notification

<!-- Template variables: {Feature Name}, {TODAY}, {NNN}, {slug}, {NNN}-{slug} -->

**Slug**: 074-elapsed-timer-notification | **Date**: 2026-04-23

## Summary

Two paired UX improvements for long-running dispatches in the spec viewer: a live elapsed-time counter shown under the active step tab (e.g. "running for 3m 22s") and a VS Code information message plus native OS notification when a dispatched step completes. Together they give concrete progress feedback during runs and let users tab away without having to babysit the viewer.

## Requirements

- **R001** (MUST): While a step is in-flight (its `stepHistory[step].startedAt` is set and `completedAt` is null), the step tab renders a live elapsed-time indicator beneath the step label, updating at least once per second.
- **R002** (MUST): Elapsed time is formatted as `Ns` while under 60 seconds, `Mm Ss` between 1 and 60 minutes, and `Hh Mm` at one hour or more (e.g. `42s`, `3m 22s`, `1h 07m`).
- **R003** (MUST): The elapsed-time indicator stops updating and disappears once the step's `completedAt` is written or the step is no longer the active step.
- **R004** (MUST): When a dispatched step transitions from in-flight to completed (observed via `stepHistory[step].completedAt` flipping from null to a timestamp), the extension displays a `vscode.window.showInformationMessage` naming the spec and step that finished (e.g. "Spec 074 · Plan complete").
- **R005** (MUST): The completion notification fires at most once per step-run — the same `startedAt` → `completedAt` transition must not be announced twice, even if the viewer is reopened or the context file is re-read.
- **R006** (MUST): No notification fires on initial viewer load for steps whose `completedAt` is already in the past — only live transitions trigger it.
- **R007** (SHOULD): The information message includes a "Open spec" action button that focuses the spec viewer for the completed spec when clicked.
- **R008** (SHOULD): The timer survives a webview reload (e.g. user switches away and back) — it derives elapsed time from `startedAt` rather than a running counter, so reopening mid-run shows the correct value without a restart glitch.
- **R009** (MAY): A settings toggle `speckit.notifications.stepComplete` (default `true`) lets users disable the completion notification while keeping the in-viewer timer.

## Scenarios

### Dispatching a step shows a live timer

**When** the user dispatches the Plan step from the spec viewer footer and the extension writes `startedAt` to `.spec-context.json`
**Then** the Plan step tab shows `0s`, then ticks to `1s`, `2s`, ... once per second until completion, with no reload required

### Step completes while viewer is focused

**When** the AI completes the Plan step, advancing `currentStep` and writing `stepHistory.plan.completedAt`
**Then** the timer on the Plan tab disappears, a VS Code information message reads `Spec 074 · Plan complete` with an "Open spec" button, and the underlying OS notification surface is triggered (VS Code routes info messages to the OS when the window is unfocused)

### Step completes while user is in another app

**When** the AI completes the Tasks step while the user has switched to another app
**Then** the OS notification appears on the user's desktop so they can tab back without manually checking the viewer

### Viewer reopened mid-run

**When** the user closes and reopens the spec viewer while Plan is still running (5 minutes into the run)
**Then** the Plan tab timer immediately shows `5m 00s` (derived from `startedAt`) and continues ticking forward

### Viewer reopened after completion

**When** the user reopens the viewer an hour after the step finished
**Then** no "complete" notification fires — only live `null → timestamp` transitions trigger it

### Two specs running in parallel

**When** two spec viewers are open and both have running steps
**Then** each viewer shows its own independent timer, and completion notifications fire per-spec with the correct spec name in the message

## Non-Functional Requirements

- **NFR001** (MUST): Timer tick loop must not cause measurable CPU use when idle — at most one interval per viewer, cleared on webview dispose or when no step is in-flight.
- **NFR002** (SHOULD): Notification dedupe state persists only in-memory within the extension host — no new fields written to `.spec-context.json`.
- **NFR003** (MAY): Elapsed-time indicator respects existing VS Code theme variables for muted text color.

## Out of Scope

- Tracking or displaying elapsed time for substeps (only top-level steps).
- Persisting historical run durations after a step completes.
- Progress bars, ETA estimates, or streaming token counts.
- Notifications for spec creation, archival, or error conditions — only step-complete.
- Sound alerts or custom notification styling beyond what VS Code provides.
