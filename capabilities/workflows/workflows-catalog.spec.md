# Workflows catalog — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Defines which workflows exist and what a valid one looks like: the two built-ins, custom ones from settings, the setting that names the default, and the normalisation every step command passes through.

## Requirements

### Two workflows ship, custom ones are additive, and one setting names the default
<!-- touches: src/features/workflows/workflowManager.ts -->

The extension SHALL provide the stock SpecKit and SpecKit Companion pipelines as built-ins and SHALL merge user-defined workflows from settings alongside them. The default for new specs is named by `speckit.defaultWorkflow`, and an unrecognized value falls back to the first available workflow with a logged note.

When that key is unset at every scope, the effective default SHALL be the Companion pipeline if the companion spec-kit extension is installed for the workspace root, and the stock pipeline otherwise. An explicit value at any scope wins, most-specific scope first, and a schema-default-only reading counts as unset. Only the workflow-pick sites (Create-Spec pre-selection, per-feature resolution) use this effective default, while adoption telemetry keeps reporting the raw configured value.

#### Scenario: the configured default names a workflow that no longer exists
- **WHEN** a spec's workflow is resolved and the configured default is not among the available workflows
- **THEN** the first available workflow is used
- **AND** the substitution is logged, not surfaced as an error

#### Scenario: the default is unset and the companion extension is installed
- **WHEN** a workflow-pick site resolves the effective default with `speckit.defaultWorkflow` unset at every scope
- **THEN** the Companion pipeline is chosen where the companion extension is installed, else the stock pipeline
- **AND** an explicit value at any scope overrides this, and telemetry still reports the raw configured value

#### Scenario: the Companion pipeline is chosen
- **WHEN** a spec selects it
- **THEN** each step dispatches the Companion command family
- **AND** the pipeline ends at a terminal step that marks the spec complete
- **AND** that terminal step is marked untimed, so it is excluded from the pipeline's timing-coverage denominator

A project's `.specify/companion.yml` configures the Companion pipeline and does not add a third workflow. The pick-surface builder SHALL mark the Companion entry as customised rather than offer a second entry that would dispatch the same `/speckit.companion.*` commands. A `workflow: shipped` declaration counts as not customised.

#### Scenario: the project has a companion.yml that shapes its pipeline
- **WHEN** a pick surface lists the workflows
- **THEN** the Companion entry reads as customised by this project, and no extra entry appears

### Built-in names are reserved at every scope
<!-- touches: src/features/workflows/workflowManager.ts -->

A custom workflow SHALL NOT claim a built-in workflow's name, including the stock pipeline's legacy alias. It SHALL NOT claim a name already taken by an earlier custom entry.

#### Scenario: a user defines a workflow using a built-in's name
- **WHEN** the workflow list is assembled
- **THEN** the custom entry is rejected with a logged reason
- **AND** the built-in definition still resolves under that name

### An invalid workflow definition is skipped, never fatal
<!-- touches: src/features/workflows/workflowManager.ts -->

Validation SHALL reject a definition with a malformed name, a non-string step command, or a malformed checkpoint, and SHALL log every rejection with its reason. An unrecognized provider id SHALL produce a warning, not a rejection. Activation and the workflow list MUST survive any combination of bad definitions.

#### Scenario: settings contain one valid and one malformed workflow
- **WHEN** the list is assembled
- **THEN** the valid workflow is available and the malformed one is omitted with its errors logged
- **AND** the built-ins remain available

#### Scenario: a workflow restricts itself to a provider id that does not exist
- **WHEN** it is validated
- **THEN** it is accepted with a warning that the id will never match

### Legacy per-step keys resolve to the same pipeline as an explicit step list
<!-- touches: src/features/workflows/workflowManager.ts, src/features/workflows/types.ts -->

A workflow written with one key per step SHALL normalize to the ordered step list before use. Normalization SHALL be a no-op when an explicit list is already present.

#### Scenario: a workflow declares only legacy step keys
- **WHEN** its steps or a step's command is resolved
- **THEN** the same pipeline is produced as an equivalent explicit step list
- **AND** a step the legacy shape omits falls back to the stock pipeline's command for that step

### A step command resolves to one canonical form regardless of how the user typed it
<!-- touches: src/features/workflows/workflowManager.ts -->

Step commands SHALL be normalized to a bare command id, tolerating a leading slash, at the single point where every step command is resolved. Dispatch sites add their own prefix.

#### Scenario: a step command is written with a leading slash
- **WHEN** that step is dispatched
- **THEN** the emitted command carries exactly one leading slash

## Uncovered

_None. Every file in the area was read._
