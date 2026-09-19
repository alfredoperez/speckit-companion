# Steering Documents — Living Spec

## Purpose

Steering documents are the guidance files the extension creates for a project, and the one part of the steering tree the user acts on: which rows can be refined or deleted, who writes their content, and how their use is counted.

## Requirements

### Only the steering documents the extension generates are destructive-actionable
<!-- touches: src/features/steering/steeringExplorerProvider.ts, src/features/steering/steeringCommands.ts -->

Refine and delete SHALL be offered only on generated steering documents. Provider-owned and SpecKit-owned files can be opened and revealed but never deleted from this view, because the extension did not create them.

#### Scenario: right-clicking a SpecKit-owned file
- **WHEN** the user opens the context menu on the constitution, a script or a template
- **THEN** reveal and open are offered, with no delete or refine

### Authoring and refining steering documents is delegated to the AI provider
<!-- touches: src/features/steering/steeringManager.ts -->

Creating, initializing and refining a steering document SHALL dispatch a prompt to the configured provider, and the extension writes no document content itself, so the document reflects this project.

#### Scenario: the user asks for a new steering document
- **WHEN** they describe the guidance they need
- **THEN** the destination directory is created and a prompt describing the task is dispatched to the provider

### Deleting a steering document asks the AI to drop references to it
<!-- touches: src/features/steering/steeringManager.ts -->

After a generated steering document is deleted, a follow-up prompt SHALL ask the assistant to remove references to it from the project rules file, and a failure of that follow-up is reported separately from the deletion.

#### Scenario: a generated steering document is deleted
- **WHEN** the deletion succeeds
- **THEN** a follow-up prompt asks the assistant to drop references to it from the project rules file

### Opening a steering document is counted as a usage signal
<!-- touches: src/features/steering/steeringCommands.ts, src/features/steering/steeringExplorerProvider.ts -->

Opening a generated steering document or a workflow reference row SHALL record one `steering.opened` telemetry event before the file opens. Provider-owned, SpecKit-owned and Companion rows open directly and record nothing.

#### Scenario: the user opens a generated steering document from the tree
- **WHEN** the row is clicked
- **THEN** one `steering.opened` event is recorded and the document opens

#### Scenario: the user opens a provider-owned or SpecKit-owned file
- **WHEN** that row is clicked
- **THEN** the file opens with no `steering.opened` event

## Uncovered

_None: every file in the area was read._
