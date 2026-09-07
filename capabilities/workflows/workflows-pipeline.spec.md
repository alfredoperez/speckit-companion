# Workflows pipeline — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Describes the pipeline a spec actually runs: how its ordered steps are resolved, how checkpoints act along it, how the Companion workflow routes by size, and what the shipped presets promise. Without it the rail, the dispatch path and the timing denominator would each derive their own idea of "next".

## Requirements

### One resolution produces a spec's pipeline, and it includes the steps the project added
<!-- touches: src/features/workflows/projectSteps.ts -->

Every surface that describes a spec's pipeline — the viewer rail, the sidebar tree, the footer's next-step label, the dispatch path, and the timing denominator — SHALL obtain its ordered step list from one shared resolution, and no surface SHALL derive its own. For a spec recorded against the Companion pipeline that resolution SHALL be the shipped steps with the project's own steps spliced in, read from the step directories the project already writes; a stock or user-defined pipeline SHALL be returned unchanged. No workflow entry is written into user settings to make a project's step visible, and no copy of a built-in pipeline is created.

A project's step declares where it runs behind one of the shipped four, its label, and the document it produces. It SHALL be placed immediately after the step it names, with the terminal completion step staying last; a step declaring no placement SHALL be omitted from the pipeline and remain launchable by hand. A step directory that is absent, unreadable, malformed, or named the same as a shipped step SHALL be skipped without preventing a spec from opening or stopping the remaining steps being read.

A pipeline carrying a project's step SHALL still be classified built-in, so which steps are done continues to come from the recorded history rather than from a file being present, and the step SHALL record its start, dispatch its own command, and count toward the run's timing phase coverage on the same terms as a shipped step.

#### Scenario: A placed step joins the pipeline

- **WHEN** a project has declared a step that runs behind `implement`, and a Companion spec is opened
- **THEN** every pipeline surface lists that step after implement and before the terminal completion step, the forward action names and dispatches its own command, and its run counts toward the timing phase coverage

#### Scenario: An unreadable step directory falls back

- **WHEN** the project's step directory is absent, unreadable, or malformed
- **THEN** the spec opens on the shipped Companion pipeline, with no error surfaced and no settings written

### Checkpoints run at their declared trigger, ask before acting, and record their outcome
<!-- touches: src/features/workflows/checkpointHandler.ts -->

A workflow MAY declare checkpoints bound to pipeline events. Each SHALL prompt for approval unless the definition explicitly opts out, SHALL record its resulting status on the spec, and on failure SHALL offer retry, skip, or cancel rather than silently continuing. A declined checkpoint is recorded as skipped, not as a failure.

#### Scenario: the user declines a checkpoint
- **WHEN** the approval prompt is dismissed or answered no
- **THEN** no git or PR action is taken
- **AND** the checkpoint is recorded as skipped

#### Scenario: a checkpoint fails mid-sequence
- **WHEN** more checkpoints remain for the same trigger
- **THEN** the user chooses to retry, skip to the next, or cancel the remaining sequence

### A routing switch matches the verdict the classifier actually emits
<!-- touches: speckit-extension/workflows/speckit-companion.workflow.yml -->

Any branch keyed on a classifier's output SHALL use the vocabulary that classifier emits, not the vocabulary of the threshold it is named after. A key that names the bar rather than the verdict matches nothing, and the failure is silent: every run simply takes the default branch, so a fast path can appear to exist while never once being entered.

#### Scenario: a small change is classified
- **WHEN** the classifier returns its simple-size verdict
- **THEN** the workflow's switch matches that branch and runs the folded path
- **AND** the folded path still runs plan and tasks, without their review-gate pauses — fewer stops, not fewer artifacts

### Shipped presets are starting points, not fixed shapes
<!-- touches: speckit-extension/workflows/presets/** -->

The extension SHALL ship named presets a user can start a new workflow from, each declaring only what it changes — the node list and phase grouping for a command, or the template sections a command emits — and each carrying a plain-language summary of who it is for. A preset SHALL be editable afterwards, node by node and section by section; picking one MUST NOT lock any of its choices.

#### Scenario: a new workflow is created from a preset
- **WHEN** the user picks a preset in the pipeline panel
- **THEN** the new workflow starts from that preset's nodes, phases, and template sections
- **AND** every one of them can still be changed afterwards

### There is one document panel, not a second custom editor

The custom workflow-editor panel — its own registered editor type, its command family, its HTML generator, its action handlers, and its separate parser for deriving a spec's phase from disk — has been removed. Rendering a spec's documents and its pipeline stepper is the spec viewer's job alone. Two panels reading the same spec is two derivations of the same facts, and the second one drifted.

#### Scenario: a spec document is opened
- **WHEN** the reader opens a spec, plan, or task document
- **THEN** it renders in the spec viewer
- **AND** no separate workflow-editor panel is registered to claim it

## Uncovered

_None — every file in the area was read._
