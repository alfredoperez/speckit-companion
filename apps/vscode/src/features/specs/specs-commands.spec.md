# Specs Commands — Living Spec

<!-- reviewed: a9c0b02b -->

## Purpose

The Specs sidebar tree and the commands that act on a spec: dispatching a step to the AI, filtering and ordering the tree, and bulk and destructive actions.

## Requirements

### Commands that need the companion piece are gated by family, not by list
<!-- touches: apps/vscode/src/features/specs/dispatchStep.ts, apps/vscode/src/features/specs/profileDispatch.ts -->

Without the companion extension installed, a Companion step SHALL run its stock equivalent, and a Companion-only action with no stock equivalent SHALL dispatch nothing. A command the AI cannot resolve is never sent. Any command in the Companion namespace counts, including one added later.

#### Scenario: a Companion step runs without the companion extension
- **WHEN** the step has a stock equivalent
- **THEN** the stock command runs and the user is warned, with an install action, without being blocked

#### Scenario: a Companion-only action runs without the companion extension
- **WHEN** it has no stock equivalent
- **THEN** nothing is dispatched and the user is told why

### The fallback warning is shown once per run, not once per step
<!-- touches: apps/vscode/src/features/specs/dispatchStep.ts -->

The fallback warning SHALL show at most once per ten-minute window, while every fallback is still logged. It is a cooldown, not a once-ever flag, so a failed or cancelled install is warned about again later.

#### Scenario: a four-step Companion run without the companion extension
- **WHEN** every step falls back to stock
- **THEN** the warning is shown once and each fallback is logged

### Every surface dispatches a step the same way
<!-- touches: apps/vscode/src/features/specs/dispatchStep.ts, apps/vscode/src/features/specs/specCommands.ts -->

The sidebar and the viewer SHALL produce the same command, the same fallback behaviour and the same reported dispatch event for the same step. Only how the finished prompt is run differs between them.

#### Scenario: the sidebar and the viewer run the same step
- **WHEN** each dispatches it for the same spec
- **THEN** both send the same command line and report one `phase.dispatched` event each

### The specs tree presents recorded state, and its view controls are per-workspace and idempotent
<!-- touches: apps/vscode/src/features/specs/specExplorerProvider.ts, apps/vscode/src/features/specs/specsFilterState.ts, apps/vscode/src/features/specs/specsSortState.ts, apps/vscode/src/features/specs/specsSortMode.ts -->

The tree SHALL group specs by their recorded status and regroup a spec when its record changes on disk. The filter and sort order SHALL persist per workspace.

#### Scenario: a spec finishes while the tree is open
- **WHEN** its record changes on disk
- **THEN** the spec moves to the matching group without a manual refresh

#### Scenario: the window is reloaded
- **WHEN** the tree is drawn again
- **THEN** the filter and sort order set before the reload still apply

### Collapse All never expands the tree
<!-- touches: apps/vscode/src/features/specs/specCommands.ts, apps/vscode/src/features/specs/specExplorerProvider.ts -->

A command whose name asserts an end state SHALL enforce that state rather than toggle it.

#### Scenario: Collapse All runs on an already-collapsed tree
- **WHEN** the command runs
- **THEN** the tree stays collapsed

### The Specs title bar carries six actions in a fixed order
<!-- touches: package.json -->

The view's title bar SHALL carry, in order: refresh, filter, sort, one collapse-or-expand button matching the tree's state, the pipeline builder when the companion extension is installed, and new spec. It has no overflow menu of its own.

#### Scenario: the tree is expanded
- **WHEN** the reader looks at the title bar
- **THEN** one button offers Collapse All, and after it is used the same slot offers Expand All

### A workflow that records nothing still shows progress
<!-- touches: apps/vscode/src/features/specs/customWorkflowProgress.ts -->

For a user-defined workflow that never writes the state record, progression SHALL be reconstructed from its step outputs on disk, and only ever forward of what the record says.

#### Scenario: a user's workflow has produced its third step's output
- **WHEN** the record still says step one
- **THEN** the spec reads as at the third step and the forward action appears

#### Scenario: the record is already at or ahead of what disk shows
- **WHEN** reconstruction runs
- **THEN** the record wins and nothing is rewritten

### A built-in pipeline is never reconstructed from disk
<!-- touches: apps/vscode/src/features/specs/customWorkflowProgress.ts -->

A shipped workflow SHALL be recognized by its step sequence, so one ending in a step outside the lifecycle set is still built-in and its progression comes only from its record. Recognition can move a workflow from user-defined to built-in, never the reverse.

#### Scenario: a built-in pipeline ends in a step outside the lifecycle set
- **WHEN** the reader opens a spec running that pipeline
- **THEN** no progression is reconstructed from disk
- **AND** the forward action names the step the step strip shows as pending

### A folder a step claims counts only for that step
<!-- touches: apps/vscode/src/features/specs/customWorkflowProgress.ts, apps/vscode/src/features/specs/featureSpecPath.ts -->

Everything inside a folder a step claims as its output SHALL count as evidence for that step alone.

#### Scenario: only a claimed folder's document is present
- **WHEN** the only document besides the specification lives in a folder an earlier step claims
- **THEN** no later step reads as having produced output
- **AND** a document loose in the spec directory still counts

### Destructive and bulk spec actions confirm, skip no-ops, and stay inside the workspace
<!-- touches: apps/vscode/src/features/specs/specCommands.ts, apps/vscode/src/features/specs/selectionContextKeys.ts -->

Deleting a spec or bulk-changing status SHALL ask for confirmation, then apply only to the specs the action would change.

#### Scenario: archiving a group where some specs are already archived
- **WHEN** the bulk action runs
- **THEN** the confirmation counts and touches only the specs not yet archived

### Acting on a missing spec path reports an error
<!-- touches: apps/vscode/src/features/specs/specCommands.ts -->

An action that turns a stored or user-supplied relative path into a file operation SHALL resolve it against the workspace root and show a visible error when the target does not exist.

#### Scenario: revealing a spec folder that was deleted outside the editor
- **WHEN** the reveal action runs
- **THEN** the user gets a "does not exist" error instead of a silent no-op

## Uncovered

- `specExplorerProvider.ts`: read in part (public surface, grouping, filtering, status/context-value derivation). The middle of the file (per-item tree construction, icons, related-document naming) was skimmed.
- `specCommands.ts`: read in part (registration surface, lifecycle/bulk commands, phase dispatch, custom-command runner). The trailing helper section was not read line by line.
- All files under `__tests__/` were listed but not read.
