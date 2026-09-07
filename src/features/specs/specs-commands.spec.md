# Specs Commands — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The specs sidebar and the commands it dispatches: recorded state presented as a tree, Companion commands gated by family through one dispatch routine, and destructive actions that confirm and stay inside the workspace.

## Requirements

### Commands that need the companion piece are gated by family, not by list

Any command belonging to the Companion namespace SHALL be recognized by its shared prefix rather than by an enumerated set, so a newly added member can never slip past the gate. A spliced Companion pipeline no longer matches the shipped sequence, so it is recognised by the same rule: a pipeline whose every step dispatches the reserved family is Companion. When the companion piece is absent, such a command MUST either downgrade to its stock equivalent or — if it has none — be suppressed entirely with a non-blocking explanation. It MUST NEVER be dispatched in a form the AI cannot resolve. The explanation is one sentence owned by the dispatch routine and raised on a session cooldown — once, not once per step of a run, and not once forever.

#### Scenario: a Companion step runs without the companion piece installed
- **WHEN** the step has a stock equivalent
- **THEN** the stock command runs instead
- **AND** the user is warned without being blocked, and offered the install

#### Scenario: a Companion-only action runs without the companion piece
- **WHEN** it has no stock equivalent
- **THEN** nothing is dispatched at all
- **AND** the user is told why

The whole sequence — resolve the command the workflow names, fall back and warn, report the dispatch, format for the provider, wrap in the lifecycle preamble, run — SHALL live in one routine every dispatching surface calls, passing in only how to run the finished prompt. Each surface used to carry its own copy of all six steps, identical apart from a log prefix, so a fix to any one of them reached exactly one caller.

#### Scenario: two surfaces run the same step
- **WHEN** the sidebar and the viewer each dispatch it
- **THEN** both produce the same command, the same fallback behavior, and the same reported event
- **AND** each still supplies its own way of running the prompt, so one can keep the terminal it gets back

When a phase or workflow step actually dispatches to a terminal, the dispatch path SHALL fire the shared once-per-session terminal install nudge (owned by the speckit-cli capability) — except on the fell-back path, which already surfaces its own install warning. This is a call-through at dispatch time, not gating logic this capability owns: the nudge's own gate decides whether anything renders, and it can never block the dispatched command.

#### Scenario: a four-step Companion run without the companion piece
- **WHEN** every step falls back to stock
- **THEN** the warning is shown once and each fallback is still logged

### The specs tree presents recorded state, and its view controls are per-workspace and idempotent

The tree SHALL group specs by their recorded status, and offer filtering and ordering over that set. View state (the active filter, the chosen order, expansion) persists per workspace. Any command whose *name* asserts an end state MUST enforce that state unconditionally rather than toggling — a command called "collapse all" must never expand.

#### Scenario: a spec finishes while the tree is open
- **WHEN** its record changes on disk
- **THEN** a debounced refresh moves it to the matching group

#### Scenario: "collapse all" is invoked on an already-collapsed tree
- **WHEN** the command runs
- **THEN** the tree stays collapsed

The view's title bar SHALL carry, in order: refresh, filter, sort, one collapse-or-expand button showing whichever the tree's state calls for, the pipeline builder where its extension is installed, and new spec — and no overflow menu of its own. The everyday action is one click, the container above already has a `…` a few pixels away, and the two rare maintenance actions the menu held live in the Command Palette. The cap is held by a test.

#### Scenario: the tree is expanded
- **WHEN** the reader looks at the title bar
- **THEN** one button offers Collapse All; after it is used, the same slot offers Expand All

### Destructive and bulk spec actions confirm, skip no-ops, and stay inside the workspace

Deleting a spec or changing many specs' status at once SHALL confirm first, then apply only to targets the action would actually change. Any path that turns a stored or user-supplied relative path into a file operation MUST resolve it against the workspace root and confirm the target exists before acting, surfacing a visible error rather than failing silently.

#### Scenario: archiving a group where some specs are already archived
- **WHEN** the bulk action runs
- **THEN** only the not-yet-archived specs are touched
- **AND** the reported count reflects what actually changed

#### Scenario: revealing a spec folder that has been deleted outside the editor
- **WHEN** the reveal action runs
- **THEN** the user gets an explicit "does not exist" error instead of a silent no-op

## Uncovered

- `specExplorerProvider.ts` — read in part (public surface, grouping, filtering, and the status/context-value derivation). The middle of the file, covering per-item tree construction, icons, and related-document display naming, was skimmed rather than read line by line.
- `specCommands.ts` — read in part (registration surface, lifecycle/bulk commands, phase dispatch, custom-command runner). The trailing helper section was not read line by line.
- All files under `__tests__/` were listed but not read.
