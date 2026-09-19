# Workflows selection — Living Spec

## Purpose

How a workflow is offered and chosen: which workflows the create form shows, and that it is the only picker.

## Requirements

### Selection filters, resolution does not
<!-- touches: src/features/workflows/workflowManager.ts, src/features/workflows/workflowSelector.ts -->

The create form hides custom workflows the active provider cannot run. A workflow a spec already recorded resolves unfiltered, so switching provider never changes an existing spec's pipeline.

#### Scenario: an existing spec's workflow is not runnable by the active provider
- **WHEN** the spec's recorded workflow is resolved for display
- **THEN** its real steps are returned unchanged
- **AND** the same workflow is absent from the create form

### The Companion workflow is always offered, flagged when it cannot run yet
<!-- touches: src/features/workflows/workflowManager.ts -->

Whether to intercept a pick of the not-ready entry is the create form's call, not the list's.

#### Scenario: the companion extension is not installed
- **WHEN** the create form lists workflows in a project without the companion spec-kit extension
- **THEN** SpecKit Companion is still listed, marked as not installed

### One builder produces every pick-surface workflow list
<!-- touches: src/features/workflows/workflowManager.ts -->

The builder applies validation, name reservation, de-duplication and provider filtering, and gives each entry its description and readiness.

#### Scenario: an invalid custom workflow is defined
- **WHEN** the create form's list is built
- **THEN** the invalid entry is skipped with a logged reason and the rest are listed

### The interactive picker is the create form, not a separate prompt
<!-- touches: src/features/workflows/workflowSelector.ts -->

#### Scenario: a spec with no recorded workflow runs a step
- **WHEN** the user runs a step on it
- **THEN** the effective default is used without a prompt, and the create form stays the only place a workflow is chosen
