# See Changes From Disk — Living Spec

## Purpose

Specs are written mostly by AI CLIs running in a terminal, outside the editor's knowledge. The extension watches the disk so the sidebar, the viewer and notifications keep up without a reload. Without this the user stares at a stale viewer while a run finishes.

## Requirements

### The folders in `speckit.specDirectories` are the ones watched
<!-- touches: apps/vscode/src/core/specDirectoryResolver.ts, apps/vscode/src/features/fileWatchers.ts, package.json -->

Spec markdown, `tasks.md` and `.spec-context.json` files SHALL be watched under every entry of `speckit.specDirectories`, which defaults to `specs` and `.specify/specs`. A plain name lists its child folders as specs, a pattern ending in a wildcard treats each match as a spec, and a pattern ending in a plain name after a wildcard names a folder of specs. A folder counts as a spec only when it holds markdown or a context file, and a folder a custom workflow declares as reference material is never a spec.

#### Scenario: a spec created by the stock CLI layout
- **WHEN** a run creates `.specify/specs/012-login/` with a context file and no settings were changed
- **THEN** the spec appears in the Specs view

#### Scenario: a monorepo pattern
- **WHEN** `speckit.specDirectories` holds `apps/*/specs`
- **THEN** `apps/web/specs/001-cart` is a spec and `apps/web/specs` is not

### The sidebar and an open viewer keep up with a run
<!-- touches: apps/vscode/src/features/fileWatchers.ts -->

A new spec context file SHALL make the spec appear in the Specs view. A write to a spec's context file SHALL refresh an open viewer's steps and timeline for that spec, and a change to a markdown file SHALL re-render it if it is the document on screen, a moment after the writes settle. Deleting the displayed document SHALL be handled by the viewer rather than leaving stale content. A context file that cannot be parsed is ignored.

#### Scenario: a step finishes in the terminal
- **WHEN** an AI run records the plan step as complete while the viewer shows that spec
- **THEN** the viewer shows the step complete without the user doing anything

### Steering and Living Specs views refresh when their files change
<!-- touches: apps/vscode/src/features/fileWatchers.ts, apps/vscode/src/extension.ts -->

The Steering view SHALL refresh when files under `.claude/` or `.specify/` change, when a `CLAUDE.md` is created or deleted in the project or in `~/.claude`, and when `~/.claude/settings.json` changes. The Living Specs view SHALL refresh when `living-specs.yml`, anything under `capabilities/`, or any `*.spec.md` changes, and an open living spec SHALL redraw when its file changes. Bursts of changes are collapsed into one refresh.

#### Scenario: a sync rewrites several living specs
- **WHEN** a living-specs sync edits five spec files within a second
- **THEN** the Living Specs view rebuilds once, and the capability open in the viewer shows its new text

### A finished task phase is announced once
<!-- touches: apps/vscode/src/features/fileWatchers.ts, apps/vscode/src/speckit/taskProgressService.ts, apps/vscode/src/core/utils/notificationUtils.ts -->

When a save of `tasks.md` checks the last open task of a phase, a notification SHALL name the phase and spec and offer Open Tasks. Phases already complete when the window opened or when the file first appeared SHALL NOT be announced. `speckit.notifications.stepComplete` set to `false` silences it.

#### Scenario: opening a project with finished phases
- **WHEN** a project opens with a `tasks.md` whose first two phases are fully checked, and an unrelated task is then checked
- **THEN** no notification appears for the first two phases

### Checking the last task closes the implement step
<!-- touches: apps/vscode/src/features/fileWatchers.ts, apps/vscode/src/features/specs/implementCloseGuard.ts, apps/vscode/src/features/specs/stepLifecycle.ts -->

When every task in `tasks.md` is checked while the spec's implement step is underway, the extension SHALL record implement as complete, however the run was started. It SHALL never move a spec backwards or close a step twice, and a failure to write is logged without interrupting anything.

#### Scenario: a stock SpecKit run in an IDE chat
- **WHEN** the assistant checks the final task and nothing else reports the step finished
- **THEN** the spec's implement step is recorded complete
