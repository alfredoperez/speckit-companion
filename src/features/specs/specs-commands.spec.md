# Specs Commands — Living Spec

<!-- reviewed: a9c0b02b -->

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This capability is the sidebar tree and the commands that act on a spec: dispatching a step to the AI, filtering and ordering the tree, and the bulk and destructive actions. Without it the recorded state has no face and no hands.

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

### A workflow that records nothing still shows progress

Workflows the user defines themselves run commands that write documents but never touch the state record, which would strand them at their first step forever. For those workflows only, progression SHALL be reconstructed from the one signal they do leave — their step outputs on disk — and only ever *forward* of what the record already says. Workflows that do record their own progress MUST be left entirely alone.

A workflow the product ships is recognized by its own step sequence, not by whether every step name belongs to the lifecycle set. A built-in pipeline that ends in a step outside that set MUST still be recognized as built-in and MUST NOT be reconstructed from disk. Recognition may only ever move a workflow from user-defined to built-in — never the reverse — so nothing that reconstructs progression today stops doing so.

A step may claim a whole folder as its own output. Everything inside a claimed folder belongs to the step that claims it and MUST NOT count as loose evidence for any other step.

#### Scenario: a user's workflow has produced its third step's output
- **WHEN** the record still says step one
- **THEN** a reconstructed progression advances it to the third step so the forward action appears
- **AND** the built-in pipelines are untouched by this path

#### Scenario: the record is already at or ahead of what disk shows
- **WHEN** reconstruction runs
- **THEN** the real record wins and nothing is rewritten

#### Scenario: a built-in pipeline ends in a step outside the lifecycle set
- **WHEN** the reader opens a spec running that pipeline
- **THEN** no progression is reconstructed from disk
- **AND** the forward action names the same step the step strip shows as pending

#### Scenario: only a claimed folder's document is present
- **WHEN** the sole document beyond the specification lives in a folder an earlier step claims
- **THEN** no later step reads as having produced output
- **AND** a document loose in the spec directory still counts as before

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
