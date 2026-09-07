# Workflows selection — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Governs how a workflow is offered and chosen: which workflows a pick surface may show, that every surface draws from one builder, and that the create form is the only picker. Without it two surfaces would offer different lists and an existing spec could lose its pipeline when the provider changes.

## Requirements

### Selection filters, resolution does not
<!-- touches: src/features/workflows/workflowManager.ts, src/features/workflows/workflowSelector.ts -->

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
<!-- touches: src/features/workflows/workflowManager.ts -->

Every surface that offers a workflow to choose from SHALL obtain that list from a single shared builder, and that builder SHALL apply the canonical rules — validation, name reservation, de-duplication, provider filtering — plus the choice metadata a pick surface needs: a description for each offer and a readiness flag. No surface may derive its own list. Two independent builders is a shipped bug shape in this capability's history: they disagreed about which workflows to offer, and the one that rendered was the one without the rules.

#### Scenario: two different surfaces offer a workflow list under the same conditions
- **WHEN** each renders
- **THEN** both offer exactly the same set, because both asked the same builder

#### Scenario: an invalid custom workflow is defined while a pick surface is open
- **WHEN** the list is built for that surface
- **THEN** the invalid entry is skipped with a logged reason, exactly as it is everywhere else

### The interactive picker is the create form, not a separate prompt
<!-- touches: src/features/workflows/workflowSelector.ts -->

There SHALL be exactly one interactive place to choose a workflow: the surface where a spec is created. A second standalone picker is not maintained, and no event is reported for a selection made outside the create surface. Keeping one picker is what lets the choice be presented with each workflow's value rather than as a bare list of names.

#### Scenario: a workflow needs choosing for a new spec
- **WHEN** the user is asked
- **THEN** the choice is made in the create surface, with each option's description visible

## Uncovered

_None — every file in the area was read._
