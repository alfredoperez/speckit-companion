# Pipeline — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How a spec's ordered step list is produced from its recorded workflow, how each step's command normalizes for dispatch, which checkpoints run around those steps, and which single panel renders the result.

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

### Legacy per-step keys resolve to the same pipeline as an explicit step list

A workflow written with the older one-key-per-step shape SHALL normalize to the ordered step list before use, and normalization SHALL be a no-op when an explicit list is already present. Users who wrote workflows against the older shape must not have their pipelines silently emptied.

#### Scenario: a workflow declares only legacy step keys
- **WHEN** its steps or a step's command is resolved
- **THEN** the same pipeline is produced as an equivalent explicit step list
- **AND** a step the legacy shape omits falls back to the stock pipeline's command for that step

### A step command resolves to one canonical form regardless of how the user typed it

Step commands SHALL be normalized to a bare command id at the single point every step command is resolved, tolerating a leading slash. Dispatch sites add their own prefix, so tolerating the variation anywhere but one place produces a malformed command.

#### Scenario: a step command is written with a leading slash
- **WHEN** that step is dispatched
- **THEN** the emitted command carries exactly one leading slash

### Checkpoints run at their declared trigger, ask before acting, and record their outcome

A workflow MAY declare checkpoints bound to pipeline events. Each SHALL prompt for approval unless the definition explicitly opts out, SHALL record its resulting status on the spec, and on failure SHALL offer retry, skip, or cancel rather than silently continuing. A declined checkpoint is recorded as skipped, not as a failure.

#### Scenario: the user declines a checkpoint
- **WHEN** the approval prompt is dismissed or answered no
- **THEN** no git or PR action is taken
- **AND** the checkpoint is recorded as skipped

#### Scenario: a checkpoint fails mid-sequence
- **WHEN** more checkpoints remain for the same trigger
- **THEN** the user chooses to retry, skip to the next, or cancel the remaining sequence

### There is one document panel, not a second custom editor

The custom workflow-editor panel — its own registered editor type, its command family, its HTML generator, its action handlers, and its separate parser for deriving a spec's phase from disk — has been removed. Rendering a spec's documents and its pipeline stepper is the spec viewer's job alone. Two panels reading the same spec is two derivations of the same facts, and the second one drifted.

#### Scenario: a spec document is opened
- **WHEN** the reader opens a spec, plan, or task document
- **THEN** it renders in the spec viewer
- **AND** no separate workflow-editor panel is registered to claim it
