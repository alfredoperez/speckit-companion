# File Watchers — Living Spec

## Purpose

How the extension notices a spec, a steering file, or a task list changing on disk without the reader touching a tab, and keeps the sidebar, the open viewer and telemetry settled to what is actually there.

## Requirements

### A spec's recorded state change reaches the open viewer without a reload
<!-- touches: apps/vscode/src/features/fileWatchers.ts -->

When `.spec-context.json` changes under any configured spec directory, the panel showing that spec SHALL re-derive its state from the new file rather than wait for the reader to switch tabs.

#### Scenario: a step completes while its spec is open
- **WHEN** the run writes the step's completion to the context file
- **THEN** the open panel for that spec refreshes without the reader reloading

### A newly created spec clears the sidebar's welcome screen on its own
<!-- touches: apps/vscode/src/features/fileWatchers.ts -->

Creating a `.spec-context.json` under a configured spec directory SHALL re-scan the Specs sidebar, because the default `specs/` and `.specify/specs/` layouts sit outside the broader `.claude` watcher this feature also runs.

#### Scenario: a spec is created outside the `.claude` directory
- **WHEN** its context file first appears under `specs/<name>/`
- **THEN** the sidebar shows the new spec without a manual refresh

### A spec reaching `completed` reports telemetry exactly once
<!-- touches: apps/vscode/src/features/fileWatchers.ts -->

A transition into `completed` status SHALL be reported at most once per spec, even when more than one watcher observes the same file write, and an already-completed spec read at startup SHALL NOT be reported as a fresh completion.

#### Scenario: two watchers see the same completing write
- **WHEN** both the `.claude` watcher and the per-directory context watcher fire for the same change
- **THEN** the completion event is sent once

#### Scenario: the extension activates on a workspace with specs already completed
- **WHEN** startup seeds its baseline from the files on disk
- **THEN** none of those already-completed specs are reported as completing

### All tasks checked closes an in-progress implement step
<!-- touches: apps/vscode/src/features/fileWatchers.ts -->

When a watched `tasks.md` changes and every task in it is now checked while a spec's `implement` step is open, the watcher SHALL close that step the same way any other completion path does, because implement is the one step some dispatch paths never report through on their own.

#### Scenario: the last task in tasks.md is checked
- **WHEN** the watcher re-parses the file
- **THEN** the implement step for that spec is marked complete without the reader taking an action

### A phase completing in tasks.md notifies once, if notifications are on
<!-- touches: apps/vscode/src/features/fileWatchers.ts -->

Detecting a newly completed phase in `tasks.md` SHALL show a notification only when the single completion-notification setting is enabled, and rapid successive saves SHALL collapse into one check rather than one per keystroke.

#### Scenario: a phase's last task is checked with notifications on
- **WHEN** the debounced handler runs
- **THEN** one phase-complete notification is shown, naming the spec and the phase

#### Scenario: the setting is off
- **WHEN** the same phase completes
- **THEN** no notification is shown

### A spec document's viewer stays current with the file on disk
<!-- touches: apps/vscode/src/features/fileWatchers.ts -->

A change, creation, or deletion of a markdown file under a configured spec pattern SHALL refresh the open viewer if it is displaying that file, or tell it the file is gone.

#### Scenario: an open document is edited outside the viewer
- **WHEN** the watcher's debounce elapses
- **THEN** the viewer re-renders the new content

#### Scenario: an open document is deleted
- **WHEN** the delete event fires
- **THEN** the viewer is told the file is gone rather than continuing to show stale content

## Uncovered

_None: the whole file was read._
