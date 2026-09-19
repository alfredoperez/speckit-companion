# Workflows pipeline — Living Spec

## Purpose

The pipeline a spec actually runs: its ordered steps with any the project added, the checkpoints along it, how the Companion workflow routes by size, and what the shipped presets promise.

## Requirements

### One resolution produces a spec's pipeline, and it includes the steps the project added
<!-- touches: src/features/workflows/projectSteps.ts -->

The viewer rail, sidebar tree, footer next-step label, dispatch and timing all read the same ordered steps. For a Companion spec, each project step under `.specify/companion/nodes/` is placed right after the shipped step it names, and mark-complete stays last. A stock or custom pipeline is returned unchanged, and nothing is written to settings.

#### Scenario: a placed step joins the pipeline
- **WHEN** a project declares a step after `implement` and a Companion spec is opened
- **THEN** every pipeline surface lists it after implement and before mark-complete
- **AND** its forward action dispatches its own command, and its run counts toward timing coverage

#### Scenario: a step declares no placement
- **WHEN** a project step has no `after:`
- **THEN** it is left out of the pipeline but can still be run by hand

### A bad project step never blocks the spec from opening
<!-- touches: src/features/workflows/projectSteps.ts -->

A step directory that is unreadable, malformed, or named like a shipped step is skipped, and the remaining steps are still read.

#### Scenario: the step directory is unreadable
- **WHEN** a Companion spec is opened and `.specify/companion/nodes/` is absent, unreadable, or malformed
- **THEN** the spec opens on the shipped Companion pipeline with no error shown

### Checkpoints run at their declared trigger, ask before acting, and record their outcome
<!-- touches: src/features/workflows/checkpointHandler.ts -->

A checkpoint asks for approval unless its definition sets `requiresApproval: false`, and records its status on the spec. A declined checkpoint is recorded as skipped.

#### Scenario: the user declines a checkpoint
- **WHEN** the approval prompt is dismissed or answered no
- **THEN** no git or PR action is taken
- **AND** the checkpoint is recorded as skipped

### A failed checkpoint lets the user retry, skip, or cancel the rest
<!-- touches: src/features/workflows/checkpointHandler.ts -->

#### Scenario: a checkpoint fails with more to run
- **WHEN** a checkpoint fails and more checkpoints remain for the same trigger
- **THEN** the user chooses to retry it, skip to the next, or cancel the remaining ones

### A routing switch matches the verdict the classifier actually emits
<!-- touches: speckit-extension/workflows/speckit-companion.workflow.yml -->

A case key must be the classifier's verdict (`simple`), not the name of its threshold (`small`), or no run ever matches it.

#### Scenario: a small change is classified
- **WHEN** the classifier returns `simple`
- **THEN** the folded path runs plan, tasks and implement without the review-gate pauses

#### Scenario: the size is unmatched
- **WHEN** the classifier returns a value no case names
- **THEN** the full pipeline runs, and no phase is skipped

### Shipped presets are starting points, not fixed shapes
<!-- touches: speckit-extension/workflows/presets/** -->

Each preset declares only what it changes and carries a one-line summary of who it is for.

#### Scenario: a new workflow is created from a preset
- **WHEN** the user picks a preset in the pipeline panel
- **THEN** the new workflow starts from that preset's nodes, phases and template sections
- **AND** each of them can still be changed afterwards

### There is one document panel, not a second custom editor

#### Scenario: a spec document is opened
- **WHEN** the reader opens a spec, plan or tasks document
- **THEN** it renders in the spec viewer, and no separate workflow-editor panel claims it
