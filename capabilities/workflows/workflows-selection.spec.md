# Workflows selection — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Governs how a workflow is offered and chosen: which workflows a pick surface shows, that every surface draws from one builder, and that the create form is the only picker.

## Requirements

### Selection filters, resolution does not
<!-- touches: src/features/workflows/workflowManager.ts, src/features/workflows/workflowSelector.ts -->

Surfaces that let a user *pick* a workflow SHALL hide workflows the active provider cannot run. Resolving a workflow a spec has *already recorded* SHALL NOT filter, so a provider switch never changes an existing spec's pipeline.

The Companion pipeline is the exception: it is ALWAYS offered, and without the companion spec-kit extension it is offered in an install-to-enable state. Its readiness is a flag on the offer, and whether to intercept a not-ready pick belongs to the pick surface, not the list.

#### Scenario: an existing spec is opened under a provider that could not have selected its workflow
- **WHEN** the spec's recorded workflow is resolved for display
- **THEN** its real steps are returned unchanged
- **AND** the same workflow is still absent from the picker

#### Scenario: the Companion pipeline's prerequisites are not met
- **WHEN** the companion spec-kit extension is not installed in the project
- **THEN** it is still offered, flagged as not ready to run
- **AND** every pick surface reports the same readiness from one shared predicate

### One builder produces every pick-surface workflow list
<!-- touches: src/features/workflows/workflowManager.ts -->

Every surface that offers workflows SHALL get its list from a single shared builder, and no surface may derive its own. The builder SHALL apply validation, name reservation, de-duplication, and provider filtering, and SHALL attach a description and a readiness flag to each offer.

#### Scenario: two different surfaces offer a workflow list under the same conditions
- **WHEN** each renders
- **THEN** both offer exactly the same set

#### Scenario: an invalid custom workflow is defined while a pick surface is open
- **WHEN** the list is built for that surface
- **THEN** the invalid entry is skipped with a logged reason, as it is everywhere else

### The interactive picker is the create form, not a separate prompt
<!-- touches: src/features/workflows/workflowSelector.ts -->

There SHALL be exactly one interactive place to choose a workflow: the surface where a spec is created. No standalone picker is maintained, and no event is reported for a selection made outside the create surface.

#### Scenario: a workflow needs choosing for a new spec
- **WHEN** the user is asked
- **THEN** the choice is made in the create surface, with each option's description visible

## Uncovered

_None. Every file in the area was read._
