# Workflows persistence — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Owns when and how a workflow choice is written to a spec's context file. Without it a read path could create context files as a side effect, and a transient read failure could erase a spec's recorded lifecycle.

## Requirements

### Read paths never write; only explicit user actions persist a selection
<!-- touches: src/features/workflows/workflowSelector.ts, src/features/workflows/pipelineResolution.ts -->

Resolving a workflow for rendering — tree rows, viewer initialization — SHALL have no disk side effects. Persisting a workflow choice onto a spec SHALL happen only from an explicit user action such as running a step or picking from the workflow picker.

#### Scenario: a spec with no recorded workflow is rendered in the sidebar
- **WHEN** its workflow is resolved for display
- **THEN** the effective default workflow is returned (the explicit setting when set, else the install-derived default)
- **AND** the spec's context file is not created or modified

### Persisting a workflow choice must never destroy existing spec context
<!-- touches: src/features/workflows/workflowManager.ts -->

Writing a workflow selection SHALL read-modify-write the spec's context, and SHALL refuse to write when the existing context is present but unreadable or not valid JSON. Only a genuinely absent file may be treated as a first write. A transient read failure that fell through to a fresh minimal write would erase the spec's whole recorded lifecycle.

#### Scenario: the context file exists but cannot be parsed
- **WHEN** a workflow selection is saved
- **THEN** the write is refused with an explanatory error
- **AND** the file on disk is left untouched

#### Scenario: no context file exists yet
- **WHEN** a workflow selection is saved
- **THEN** a minimal context recording the workflow and the time of choice is written

### The spec-context file name is declared once
<!-- touches: src/features/workflows/types.ts -->

The name of the per-spec context file SHALL be declared by the module that reads it and re-exported everywhere else it is needed, rather than restated as a second literal.

#### Scenario: a second module needs the file name
- **WHEN** code outside the reader module needs the context file's name
- **THEN** it imports the reader's constant, and no second string literal for that name exists in the tree

## Uncovered

_None — every file in the area was read._
