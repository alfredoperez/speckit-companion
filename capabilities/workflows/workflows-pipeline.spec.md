# Workflows pipeline — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Describes the pipeline a spec actually runs: how its ordered steps resolve, how checkpoints act along it, how the Companion workflow routes by size, and what the shipped presets promise.

## Requirements

### One resolution produces a spec's pipeline, and it includes the steps the project added
<!-- touches: src/features/workflows/projectSteps.ts -->

The viewer rail, sidebar tree, footer next-step label, dispatch path, and timing denominator SHALL all get a spec's ordered steps from one shared resolution, and no surface SHALL derive its own. For a Companion spec, that resolution SHALL splice the project's own steps, read from its step directories, into the shipped steps, while a stock or user-defined pipeline SHALL be returned unchanged. No workflow entry is written into user settings and no copy of a built-in pipeline is created.

A project step declares which of the shipped four it follows, its label, and the document it produces. It SHALL be placed right after the step it names, with the terminal completion step staying last, and a step declaring no placement SHALL be left out of the pipeline but stay launchable by hand. A step directory that is absent, unreadable, malformed, or named like a shipped step SHALL be skipped without blocking the spec from opening or the remaining steps from being read.

A pipeline with a project step SHALL still be classified built-in, so done steps still come from recorded history rather than file presence. The project step SHALL record its start, dispatch its own command, and count toward timing phase coverage like a shipped step.

#### Scenario: A placed step joins the pipeline

- **WHEN** a project has declared a step that runs behind `implement`, and a Companion spec is opened
- **THEN** every pipeline surface lists that step after implement and before the terminal completion step, the forward action dispatches its own command, and its run counts toward timing phase coverage

#### Scenario: An unreadable step directory falls back

- **WHEN** the project's step directory is absent, unreadable, or malformed
- **THEN** the spec opens on the shipped Companion pipeline, with no error surfaced and no settings written

### Checkpoints run at their declared trigger, ask before acting, and record their outcome
<!-- touches: src/features/workflows/checkpointHandler.ts -->

A workflow MAY declare checkpoints bound to pipeline events. Each SHALL prompt for approval unless its definition opts out, SHALL record its resulting status on the spec, and on failure SHALL offer retry, skip, or cancel. A declined checkpoint is recorded as skipped, not failed.

#### Scenario: the user declines a checkpoint
- **WHEN** the approval prompt is dismissed or answered no
- **THEN** no git or PR action is taken
- **AND** the checkpoint is recorded as skipped

#### Scenario: a checkpoint fails mid-sequence
- **WHEN** more checkpoints remain for the same trigger
- **THEN** the user chooses to retry, skip to the next, or cancel the remaining sequence

### A routing switch matches the verdict the classifier actually emits
<!-- touches: speckit-extension/workflows/speckit-companion.workflow.yml -->

Any branch keyed on a classifier's output SHALL use the verdict vocabulary that classifier emits, not the name of its threshold. A key that names the threshold matches nothing, so every run silently takes the default branch.

#### Scenario: a small change is classified
- **WHEN** the classifier returns its simple-size verdict
- **THEN** the workflow's switch matches that branch and runs the folded path
- **AND** the folded path still runs plan and tasks, only without their review-gate pauses

### Shipped presets are starting points, not fixed shapes
<!-- touches: speckit-extension/workflows/presets/** -->

The extension SHALL ship named presets to start a new workflow from, each declaring only what it changes (a command's node list and phase grouping, or its template sections) and carrying a plain-language summary of who it is for. A preset SHALL stay editable node by node and section by section, and picking one MUST NOT lock any of its choices.

#### Scenario: a new workflow is created from a preset
- **WHEN** the user picks a preset in the pipeline panel
- **THEN** the new workflow starts from that preset's nodes, phases, and template sections
- **AND** every one of them can still be changed afterwards

### There is one document panel, not a second custom editor

Rendering a spec's documents and its pipeline stepper SHALL be the spec viewer's job alone. No separate workflow-editor panel, editor type, command family, or phase parser exists alongside it.

#### Scenario: a spec document is opened
- **WHEN** the reader opens a spec, plan, or task document
- **THEN** it renders in the spec viewer
- **AND** no separate workflow-editor panel is registered to claim it

## Uncovered

_None. Every file in the area was read._
