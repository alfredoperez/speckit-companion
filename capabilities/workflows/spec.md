# Workflows — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

A workflow is the ordered pipeline a spec travels — which step comes next, which command that step dispatches, and which document it produces. This capability owns the definition, validation, selection, and persistence of those pipelines, plus the editor panel that renders a spec document inside its pipeline. Without it every surface (sidebar, viewer, editor, dispatch) would each guess at the pipeline shape and disagree about what "next" means.

## Requirements

### Two workflows ship, custom ones are additive, and one setting names the default

The extension SHALL provide the stock SpecKit pipeline and the SpecKit Companion pipeline as built-ins, and SHALL merge any user-defined workflows from settings alongside them. The default for new specs is named by a single configuration key, `speckit.defaultWorkflow`; an unrecognized value falls back to the first available workflow with a logged note rather than leaving a spec pipeline-less.

#### Scenario: the configured default names a workflow that no longer exists
- **WHEN** a spec's workflow is resolved and the configured default is not among the available workflows
- **THEN** the first available workflow is used
- **AND** the substitution is logged rather than surfaced as an error

#### Scenario: the Companion pipeline is chosen
- **WHEN** a spec selects it
- **THEN** each step dispatches the Companion command family
- **AND** the pipeline ends at a terminal step that marks the spec complete
- **AND** that terminal step is marked untimed — it only flips status, so it is excluded from the pipeline's timing-coverage denominator rather than counted as a step that should record a duration

### Built-in names are reserved at every scope

A custom workflow SHALL NOT be able to claim a built-in workflow's name, including the legacy alias for the stock pipeline, and SHALL NOT be able to claim a name already taken by an earlier custom entry. Shadowing a built-in id would silently redirect the dispatch of every spec that recorded that name.

#### Scenario: a user defines a workflow using a built-in's name
- **WHEN** the workflow list is assembled
- **THEN** the custom entry is rejected with a logged reason
- **AND** the built-in definition remains the one that resolves under that name

### Selection filters, resolution does not

Surfaces that let a user *pick* a workflow SHALL hide workflows the active provider cannot run and built-ins whose prerequisites are absent. The Companion pipeline's only selection prerequisite is that the companion spec-kit extension is installed in the project — there is no separate enabling setting gating its offer. Resolving a workflow a spec has *already recorded* SHALL NOT filter. A spec that loses its real steps because the user switched providers would render the wrong pipeline and dispatch the wrong command.

#### Scenario: an existing spec is opened under a provider that could not have selected its workflow
- **WHEN** the spec's recorded workflow is resolved for display
- **THEN** its real steps are returned unchanged
- **AND** the same workflow is still absent from the picker

#### Scenario: the Companion pipeline's prerequisites are not met
- **WHEN** the companion spec-kit extension is not installed in the project
- **THEN** it is not offered for selection
- **AND** every surface that builds a picker uses the same predicate, so no picker can offer it while another hides it

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
- **THEN** the default workflow is returned
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

### The editor panel's pipeline stepper follows the spec's own recorded workflow

The document panel SHALL derive its phase stepper, document tabs, and next-document decision from the workflow the spec actually recorded, so that any pipeline — including one whose steps go beyond the common set, and one that ends in a terminal step — is representable in the panel exactly as it runs. A panel that could only render a fixed shape would hide the steps that distinguish a pipeline from the stock one, and would misrepresent every custom workflow.

#### Scenario: a document is opened that matches a pipeline step's output file
- **WHEN** the panel renders
- **THEN** the phase, the completed phases, and the tab set derive from the recorded workflow's step order and the files present on disk
- **AND** files that are not step outputs surface as related documents rather than as phases, their display names capitalizing each word and turning both dashes and underscores into spaces

#### Scenario: a spec is on a workflow whose pipeline ends in a terminal step
- **WHEN** the panel renders that spec's document
- **THEN** the stepper includes that terminal step alongside the earlier ones
- **AND** the next-document decision accounts for it rather than ending the pipeline early

## Uncovered

_None — every file in both areas was read._
