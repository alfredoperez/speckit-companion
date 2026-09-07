# Workflow Selection — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How a workflow is offered, picked, and recorded onto a spec: the shared pick-surface list, the single interactive picker, and the read-only versus write discipline around the spec's context file.

## Requirements

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

### The spec-context file name is declared once

The name of the per-spec context file SHALL be declared by the module that reads it and re-exported everywhere else it is needed, rather than restated as a second literal.
