# Specs Commands — Living Spec

<!-- reviewed: a9c0b02b -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The sidebar tree and the commands that act on a spec: dispatching a step to the AI, filtering and ordering the tree, and bulk and destructive actions.

## Requirements

### Commands that need the companion piece are gated by family, not by list

A Companion command SHALL be recognized by its shared namespace prefix, not an enumerated list, and a pipeline whose every step dispatches that family is Companion. Without the companion piece, such a command MUST downgrade to its stock equivalent or, if none exists, be suppressed with a non-blocking explanation. It MUST NEVER be dispatched in a form the AI cannot resolve. The explanation is one sentence owned by the dispatch routine, shown once per session cooldown.

#### Scenario: a Companion step runs without the companion piece installed
- **WHEN** the step has a stock equivalent
- **THEN** the stock command runs instead
- **AND** the user is warned without being blocked, and offered the install

#### Scenario: a Companion-only action runs without the companion piece
- **WHEN** it has no stock equivalent
- **THEN** nothing is dispatched
- **AND** the user is told why

Every dispatching surface SHALL call one routine that resolves the command, falls back and warns, reports the dispatch, formats for the provider, wraps the lifecycle preamble, and runs. Each surface passes in only how to run the finished prompt.

#### Scenario: two surfaces run the same step
- **WHEN** the sidebar and the viewer each dispatch it
- **THEN** both produce the same command, fallback behavior, and reported event
- **AND** each supplies its own way of running the prompt, so one can keep the terminal it gets back

When a step actually dispatches to a terminal, the dispatch path SHALL call the shared once-per-session terminal install nudge owned by the speckit-cli capability, except on the fell-back path, which shows its own install warning. The nudge's own gate decides whether it renders, and it can never block the command.

#### Scenario: a four-step Companion run without the companion piece
- **WHEN** every step falls back to stock
- **THEN** the warning is shown once and each fallback is still logged

### The specs tree presents recorded state, and its view controls are per-workspace and idempotent

The tree SHALL group specs by recorded status and offer filtering and ordering over them. View state (filter, order, expansion) persists per workspace. A command whose name asserts an end state MUST enforce it rather than toggle, so "collapse all" never expands.

#### Scenario: a spec finishes while the tree is open
- **WHEN** its record changes on disk
- **THEN** a debounced refresh moves it to the matching group

#### Scenario: "collapse all" is invoked on an already-collapsed tree
- **WHEN** the command runs
- **THEN** the tree stays collapsed

The view's title bar SHALL carry, in order: refresh, filter, sort, one collapse-or-expand button matching the tree's state, the pipeline builder when its extension is installed, and new spec. It has no overflow menu of its own, and a test holds this cap.

#### Scenario: the tree is expanded
- **WHEN** the reader looks at the title bar
- **THEN** one button offers Collapse All; after it is used, the same slot offers Expand All

### A workflow that records nothing still shows progress

For user-defined workflows that never write the state record, progression SHALL be reconstructed from their step outputs on disk, and only ever forward of what the record says. Workflows that record their own progress MUST be left alone.

A shipped workflow is recognized by its step sequence, not by whether every step name is in the lifecycle set. A built-in pipeline ending in a step outside that set MUST still be recognized as built-in and MUST NOT be reconstructed from disk. Recognition may only move a workflow from user-defined to built-in, never the reverse.

Everything inside a folder a step claims as its output belongs to that step and MUST NOT count as evidence for any other step.

#### Scenario: a user's workflow has produced its third step's output
- **WHEN** the record still says step one
- **THEN** reconstructed progression advances it to the third step so the forward action appears
- **AND** built-in pipelines are untouched by this path

#### Scenario: the record is already at or ahead of what disk shows
- **WHEN** reconstruction runs
- **THEN** the real record wins and nothing is rewritten

#### Scenario: a built-in pipeline ends in a step outside the lifecycle set
- **WHEN** the reader opens a spec running that pipeline
- **THEN** no progression is reconstructed from disk
- **AND** the forward action names the step the step strip shows as pending

#### Scenario: only a claimed folder's document is present
- **WHEN** the only document besides the specification lives in a folder an earlier step claims
- **THEN** no later step reads as having produced output
- **AND** a document loose in the spec directory still counts

### Destructive and bulk spec actions confirm, skip no-ops, and stay inside the workspace

Deleting a spec or bulk-changing status SHALL confirm first, then apply only to targets the action would change. A path that turns a stored or user-supplied relative path into a file operation MUST resolve it against the workspace root and confirm the target exists, showing a visible error otherwise.

#### Scenario: archiving a group where some specs are already archived
- **WHEN** the bulk action runs
- **THEN** only the not-yet-archived specs are touched
- **AND** the reported count reflects what changed

#### Scenario: revealing a spec folder that has been deleted outside the editor
- **WHEN** the reveal action runs
- **THEN** the user gets an explicit "does not exist" error instead of a silent no-op

## Uncovered

- `specExplorerProvider.ts`: read in part (public surface, grouping, filtering, status/context-value derivation). The middle of the file (per-item tree construction, icons, related-document naming) was skimmed.
- `specCommands.ts`: read in part (registration surface, lifecycle/bulk commands, phase dispatch, custom-command runner). The trailing helper section was not read line by line.
- All files under `__tests__/` were listed but not read.
