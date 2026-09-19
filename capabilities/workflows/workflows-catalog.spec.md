# Workflows catalog — Living Spec

## Purpose

Which workflows exist and what a valid one looks like: the two built-ins, custom ones from settings, the default for new specs, and how step commands are normalised. It also owns when a workflow choice is written to a spec's context file.

## Requirements

### Two workflows ship, custom ones are additive, and one setting names the default
<!-- touches: src/features/workflows/workflowManager.ts -->

The stock SpecKit and SpecKit Companion pipelines are always available, and valid workflows from `speckit.customWorkflows` are added beside them.

#### Scenario: settings define a custom workflow
- **WHEN** the workflow list is assembled with one valid custom workflow in settings
- **THEN** the list holds SpecKit, SpecKit Companion and the custom workflow

### A default that names a missing workflow falls back to the first available one
<!-- touches: src/features/workflows/workflowManager.ts -->

#### Scenario: the configured default no longer exists
- **WHEN** a spec with no recorded workflow resolves its default and `speckit.defaultWorkflow` names no available workflow
- **THEN** the first available workflow is used
- **AND** the substitution is logged, not shown as an error

### An unset default picks Companion when its extension is installed
<!-- touches: src/features/workflows/workflowManager.ts -->

A value set at any scope wins, most specific first. Only a schema default counts as unset. Telemetry keeps reporting the raw configured value, so the adoption metric counts explicit choices only.

#### Scenario: the default is unset
- **WHEN** `speckit.defaultWorkflow` is unset at every scope
- **THEN** new specs default to SpecKit Companion if the companion spec-kit extension is installed for the workspace root, else to SpecKit

#### Scenario: the default is set in the workspace
- **WHEN** the workspace sets `speckit.defaultWorkflow` to `speckit` and the companion extension is installed
- **THEN** new specs default to SpecKit

### A project's companion.yml customises the Companion entry instead of adding a workflow
<!-- touches: src/features/workflows/workflowManager.ts -->

It shapes the same `/speckit.companion.*` commands, so a second entry would dispatch the same thing. `workflow: shipped` counts as not customised.

#### Scenario: the project has a companion.yml
- **WHEN** the create form lists workflows
- **THEN** the Companion entry reads as customised by this project, and no extra entry appears

### Built-in names are reserved at every scope
<!-- touches: src/features/workflows/workflowManager.ts -->

A custom workflow cannot take `speckit`, `companion` or the legacy `default` alias, nor a name an earlier custom entry already took.

#### Scenario: a custom workflow uses a built-in's name
- **WHEN** the workflow list is assembled
- **THEN** the custom entry is skipped with a logged reason
- **AND** the built-in still resolves under that name

### An invalid workflow definition is skipped, never fatal
<!-- touches: src/features/workflows/workflowManager.ts -->

A malformed name, a non-string step command, or a malformed checkpoint rejects the definition with a logged reason. An unknown provider id only warns.

#### Scenario: settings contain one valid and one malformed workflow
- **WHEN** the list is assembled
- **THEN** the valid workflow and the built-ins are available, and the malformed one is omitted with its errors logged

#### Scenario: a workflow names a provider id that does not exist
- **WHEN** it is validated
- **THEN** it is accepted with a warning that the id never matches

### Legacy per-step keys resolve to the same pipeline as an explicit step list
<!-- touches: src/features/workflows/workflowManager.ts, src/features/workflows/types.ts -->

#### Scenario: a workflow declares only legacy step keys
- **WHEN** its steps or a step's command is resolved
- **THEN** the pipeline matches the equivalent explicit step list
- **AND** a step the legacy keys omit uses the stock pipeline's command

### A step command resolves to one canonical form regardless of how the user typed it
<!-- touches: src/features/workflows/workflowManager.ts -->

#### Scenario: a step command is written with a leading slash
- **WHEN** that step is dispatched
- **THEN** the emitted command carries exactly one leading slash

### Read paths never write; only explicit user actions persist a selection
<!-- touches: src/features/workflows/workflowSelector.ts, src/features/workflows/pipelineResolution.ts -->

#### Scenario: a spec with no recorded workflow is rendered in the sidebar
- **WHEN** its workflow is resolved for the tree or the viewer
- **THEN** the effective default workflow is returned
- **AND** the spec's context file is not created or modified

#### Scenario: a step is run on a spec with no recorded workflow
- **WHEN** the user runs a step
- **THEN** the resolved workflow is written to the spec's context file

### Persisting a workflow choice must never destroy existing spec context
<!-- touches: src/features/workflows/workflowManager.ts -->

Only a missing file counts as a first write.

#### Scenario: the context file already has history
- **WHEN** a workflow selection is saved
- **THEN** only the workflow and its selection time change, and every other field is kept

#### Scenario: the context file exists but cannot be read or parsed
- **WHEN** a workflow selection is saved
- **THEN** the write is refused with an error naming the file
- **AND** the file on disk is left untouched
