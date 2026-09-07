# Workflows — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

A workflow is the ordered pipeline a spec travels — which step comes next, which command that step dispatches, and which document it produces. This capability owns the definition, validation, selection, and persistence of those pipelines, plus the editor panel that renders a spec document inside its pipeline. Without it every surface (sidebar, viewer, editor, dispatch) would each guess at the pipeline shape and disagree about what "next" means.

## Requirements

### Two workflows ship, custom ones are additive, and one setting names the default

The extension SHALL provide the stock SpecKit pipeline and the SpecKit Companion pipeline as built-ins, and SHALL merge any user-defined workflows from settings alongside them. The default for new specs is named by a single configuration key, `speckit.defaultWorkflow`; an unrecognized value falls back to the first available workflow with a logged note rather than leaving a spec pipeline-less.

When that key is left unset, the effective default SHALL resolve to the Companion pipeline where the companion spec-kit extension is installed for the workspace root, and to the stock pipeline otherwise — so an installed workspace starts specs on Companion without the user having to name it. An explicitly-set value at any scope always wins over this install-derived default, most-specific scope first; unset is distinguished from an explicit value by inspecting the setting per scope, and a schema-default-only reading counts as unset. Only the workflow-pick sites (Create-Spec pre-selection, per-feature resolution) consult this effective default; adoption telemetry keeps reporting the RAW configured value, so an install-derived default never counts as an explicit Companion choice.

#### Scenario: the configured default names a workflow that no longer exists
- **WHEN** a spec's workflow is resolved and the configured default is not among the available workflows
- **THEN** the first available workflow is used
- **AND** the substitution is logged rather than surfaced as an error

#### Scenario: the default is unset and the companion extension is installed
- **WHEN** a workflow-pick site resolves the effective default with `speckit.defaultWorkflow` unset at every scope
- **THEN** the Companion pipeline is chosen where the companion extension is installed, else the stock pipeline
- **AND** an explicit value set at any scope overrides this, and telemetry still reports the raw configured value rather than the install-derived one

#### Scenario: the Companion pipeline is chosen
- **WHEN** a spec selects it
- **THEN** each step dispatches the Companion command family
- **AND** the pipeline ends at a terminal step that marks the spec complete
- **AND** that terminal step is marked untimed — it only flips status, so it is excluded from the pipeline's timing-coverage denominator rather than counted as a step that should record a duration

A project's `.specify/companion.yml` does not add a third workflow. It configures the Companion pipeline — the build writes the same `/speckit.companion.*` bodies whether or not that file shapes them — so the pick-surface builder SHALL name the customisation on the Companion entry rather than offer a second entry that would dispatch identical commands. A `workflow: shipped` declaration selects no configuration and counts as not customised.

#### Scenario: the project has a companion.yml that shapes its pipeline
- **WHEN** a pick surface lists the workflows
- **THEN** the Companion entry reads as customised by this project, and no extra entry appears

### Built-in names are reserved at every scope

A custom workflow SHALL NOT be able to claim a built-in workflow's name, including the legacy alias for the stock pipeline, and SHALL NOT be able to claim a name already taken by an earlier custom entry. Shadowing a built-in id would silently redirect the dispatch of every spec that recorded that name.

#### Scenario: a user defines a workflow using a built-in's name
- **WHEN** the workflow list is assembled
- **THEN** the custom entry is rejected with a logged reason
- **AND** the built-in definition remains the one that resolves under that name

### Selection filters, resolution does not

Surfaces that let a user *pick* a workflow SHALL hide workflows the active provider cannot run. Resolving a workflow a spec has *already recorded* SHALL NOT filter. A spec that loses its real steps because the user switched providers would render the wrong pipeline and dispatch the wrong command.

The Companion pipeline is the deliberate exception to hiding: it is ALWAYS offered, and when the companion spec-kit extension is absent it is offered in an install-to-enable state rather than omitted, because the moment a user is choosing a pipeline is the moment its value can be shown. Its readiness is reported as a flag on the offer, so the pick surface can present the state; whether to intercept a not-ready pick belongs to that surface, not to the list.

#### Scenario: an existing spec is opened under a provider that could not have selected its workflow
- **WHEN** the spec's recorded workflow is resolved for display
- **THEN** its real steps are returned unchanged
- **AND** the same workflow is still absent from the picker

#### Scenario: the Companion pipeline's prerequisites are not met
- **WHEN** the companion spec-kit extension is not installed in the project
- **THEN** it is still offered, flagged as not ready to run
- **AND** every pick surface reports the same readiness, because they all read one shared predicate

### One builder produces every pick-surface workflow list

Every surface that offers a workflow to choose from SHALL obtain that list from a single shared builder, and that builder SHALL apply the canonical rules — validation, name reservation, de-duplication, provider filtering — plus the choice metadata a pick surface needs: a description for each offer and a readiness flag. No surface may derive its own list. Two independent builders is a shipped bug shape in this capability's history: they disagreed about which workflows to offer, and the one that rendered was the one without the rules.

#### Scenario: two different surfaces offer a workflow list under the same conditions
- **WHEN** each renders
- **THEN** both offer exactly the same set, because both asked the same builder

#### Scenario: an invalid custom workflow is defined while a pick surface is open
- **WHEN** the list is built for that surface
- **THEN** the invalid entry is skipped with a logged reason, exactly as it is everywhere else

### The interactive picker is the create form, not a separate prompt

There SHALL be exactly one interactive place to choose a workflow: the surface where a spec is created. A second standalone picker is not maintained, and no event is reported for a selection made outside the create surface. Keeping one picker is what lets the choice be presented with each workflow's value rather than as a bare list of names.

#### Scenario: a workflow needs choosing for a new spec
- **WHEN** the user is asked
- **THEN** the choice is made in the create surface, with each option's description visible

### An invalid workflow definition is skipped, never fatal

Workflow settings are user-authored text. Validation SHALL reject a definition with a malformed name, a non-string step command, or a malformed checkpoint, SHALL warn (not reject) on an unrecognized provider id, and SHALL log every rejection with its reason. Activation and the workflow list MUST survive any combination of bad definitions.

#### Scenario: settings contain one valid and one malformed workflow
- **WHEN** the list is assembled
- **THEN** the valid workflow is available and the malformed one is omitted with its errors logged
- **AND** the built-ins remain available

#### Scenario: a workflow restricts itself to a provider id that does not exist
- **WHEN** it is validated
- **THEN** it is accepted with a warning explaining the id will never match

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

### Read paths never write; only explicit user actions persist a selection

Resolving a workflow for rendering — tree rows, viewer initialization — SHALL have no disk side effects. Persisting a workflow choice onto a spec SHALL happen only from an explicit user action such as running a step or picking from the workflow picker.

#### Scenario: a spec with no recorded workflow is rendered in the sidebar
- **WHEN** its workflow is resolved for display
- **THEN** the effective default workflow is returned (the explicit setting when set, else the install-derived default)
- **AND** the spec's context file is not created or modified

### Persisting a workflow choice must never destroy existing spec context

Writing a workflow selection SHALL read-modify-write the spec's context, and SHALL refuse to write when the existing context is present but unreadable or not valid JSON. Only a genuinely absent file may be treated as a first write. A transient read failure that fell through to a fresh minimal write would erase the spec's whole recorded lifecycle.

#### Scenario: the context file exists but cannot be parsed
- **WHEN** a workflow selection is saved
- **THEN** the write is refused with an explanatory error
- **AND** the file on disk is left untouched

#### Scenario: no context file exists yet
- **WHEN** a workflow selection is saved
- **THEN** a minimal context recording the workflow and the time of choice is written

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

### Shipped presets are starting points, not fixed shapes

The extension SHALL ship named presets a user can start a new workflow from, each declaring only what it changes — the node list and phase grouping for a command, or the template sections a command emits — and each carrying a plain-language summary of who it is for. A preset SHALL be editable afterwards, node by node and section by section; picking one MUST NOT lock any of its choices.

#### Scenario: a new workflow is created from a preset
- **WHEN** the user picks a preset in the pipeline panel
- **THEN** the new workflow starts from that preset's nodes, phases, and template sections
- **AND** every one of them can still be changed afterwards

### A routing switch matches the verdict the classifier actually emits

Any branch keyed on a classifier's output SHALL use the vocabulary that classifier emits, not the vocabulary of the threshold it is named after. A key that names the bar rather than the verdict matches nothing, and the failure is silent: every run simply takes the default branch, so a fast path can appear to exist while never once being entered.

#### Scenario: a small change is classified
- **WHEN** the classifier returns its simple-size verdict
- **THEN** the workflow's switch matches that branch and runs the folded path
- **AND** the folded path still runs plan and tasks, without their review-gate pauses — fewer stops, not fewer artifacts

### The spec-context file name is declared once

The name of the per-spec context file SHALL be declared by the module that reads it and re-exported everywhere else it is needed, rather than restated as a second literal.

## Uncovered

_None — every file in both areas was read._

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
