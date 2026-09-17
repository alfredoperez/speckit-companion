# Steering Documents — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Steering documents are the guidance files the extension creates for a project, and the one part of the steering tree the user acts on. These rules cover which rows can be refined or deleted, who writes their content, and how their use is counted.

## Requirements

### Only the steering documents the extension generates are destructive-actionable
<!-- touches: src/features/steering/steeringExplorerProvider.ts, src/features/steering/steeringCommands.ts -->

Refine and delete SHALL be offered only on generated steering documents. Provider-owned and SpecKit-owned files SHALL be openable and revealable but never deletable from this view, because the extension did not create them.

#### Scenario: right-clicking a SpecKit-owned file
- **WHEN** the user opens the context menu on the constitution, a script, or a template
- **THEN** reveal and open are offered
- **AND** no delete or refine action is present

### Authoring and refining steering documents is delegated to the AI provider
<!-- touches: src/features/steering/steeringManager.ts -->

Creating, initializing, refining, and post-delete cleanup of a steering document SHALL be a prompt dispatched to the configured provider, not extension-side templating, so the document reflects this project.

#### Scenario: the user asks for a new steering document
- **WHEN** they describe the guidance they need
- **THEN** the destination directory is created and a prompt describing the task is dispatched to the provider
- **AND** the extension does not write document content itself

#### Scenario: a generated steering document is deleted
- **WHEN** the deletion succeeds
- **THEN** a follow-up prompt asks the assistant to drop references to it from the project rules file
- **AND** a failure of that follow-up is surfaced without leaving the deletion half-reported

### Opening a steering document is counted as a usage signal
<!-- touches: src/features/steering/steeringCommands.ts, src/features/steering/steeringExplorerProvider.ts -->

Clicking a generated steering document or workflow reference row SHALL go through the extension's own open command, which records a `steering.opened` telemetry event before opening the file. Provider-owned, SpecKit-owned, and Companion command and template rows SHALL open directly and emit nothing.

#### Scenario: the user opens a generated steering document from the tree
- **WHEN** the row is clicked
- **THEN** one `steering.opened` event is recorded per open
- **AND** the document then opens in the editor

#### Scenario: the user opens a provider-owned or SpecKit-owned file
- **WHEN** that row is clicked
- **THEN** the file opens directly with no `steering.opened` event

## Uncovered

_None: every file in the area was read._
