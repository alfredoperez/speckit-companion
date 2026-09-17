# Workflows persistence — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Owns when and how a workflow choice is written to a spec's context file, so reads stay side-effect free and a write never erases recorded history.

## Requirements

### Read paths never write; only explicit user actions persist a selection
<!-- touches: src/features/workflows/workflowSelector.ts, src/features/workflows/pipelineResolution.ts -->

Resolving a workflow for rendering, such as tree rows or viewer initialization, SHALL have no disk side effects. A workflow choice SHALL be persisted only from an explicit user action, such as running a step or picking from the workflow picker.

#### Scenario: a spec with no recorded workflow is rendered in the sidebar
- **WHEN** its workflow is resolved for display
- **THEN** the effective default workflow is returned: the explicit setting when set, else the install-derived default
- **AND** the spec's context file is not created or modified

### Persisting a workflow choice must never destroy existing spec context
<!-- touches: src/features/workflows/workflowManager.ts -->

Writing a workflow selection SHALL read, modify, and write the spec's context. It SHALL refuse to write when the existing context is present but unreadable or not valid JSON, and only a genuinely absent file may be treated as a first write.

#### Scenario: the context file exists but cannot be parsed
- **WHEN** a workflow selection is saved
- **THEN** the write is refused with an explanatory error
- **AND** the file on disk is left untouched

#### Scenario: no context file exists yet
- **WHEN** a workflow selection is saved
- **THEN** a minimal context recording the workflow and the time of choice is written

### The spec-context file name is declared once
<!-- touches: src/features/workflows/types.ts -->

The per-spec context file name SHALL be declared by the module that reads it and re-exported wherever else it is needed, never restated as a second literal.

#### Scenario: a second module needs the file name
- **WHEN** code outside the reader module needs the context file's name
- **THEN** it imports the reader's constant, and no second string literal for that name exists in the tree

## Uncovered

_None. Every file in the area was read._
