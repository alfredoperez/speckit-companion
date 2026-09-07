# Workflow Definitions — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Which workflows exist, how a project's default is chosen, and how user-authored definitions are validated and merged alongside the built-ins.

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

### An invalid workflow definition is skipped, never fatal

Workflow settings are user-authored text. Validation SHALL reject a definition with a malformed name, a non-string step command, or a malformed checkpoint, SHALL warn (not reject) on an unrecognized provider id, and SHALL log every rejection with its reason. Activation and the workflow list MUST survive any combination of bad definitions.

#### Scenario: settings contain one valid and one malformed workflow
- **WHEN** the list is assembled
- **THEN** the valid workflow is available and the malformed one is omitted with its errors logged
- **AND** the built-ins remain available

#### Scenario: a workflow restricts itself to a provider id that does not exist
- **WHEN** it is validated
- **THEN** it is accepted with a warning explaining the id will never match

## Uncovered

_None — every file in both areas was read._
