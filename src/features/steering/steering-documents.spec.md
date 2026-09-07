# Steering Documents — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Generated steering documents are the only rows the extension may refine or delete; their authoring is delegated to the AI provider, and opening one is counted as a usage signal.

## Requirements

### Only the steering documents the extension generates are destructive-actionable

Refine and delete SHALL be offered exclusively on generated steering documents. Provider-owned and SpecKit-owned files SHALL be openable and revealable but never deletable from this view, because deleting them breaks the user's assistant setup or their SpecKit project, and the extension did not create them.

#### Scenario: right-clicking a SpecKit-owned file
- **WHEN** the user opens the context menu on the constitution, a script, or a template
- **THEN** reveal and open are offered
- **AND** no delete or refine action is present

### Authoring and refining steering documents is delegated to the AI provider

Creating, initializing, refining, and cleaning up after deleting a steering document SHALL be expressed as a prompt dispatched to the configured provider, not as extension-side templating. The value of a steering document is that it reflects this project; a canned template cannot.

#### Scenario: the user asks for a new steering document
- **WHEN** they describe the guidance they need
- **THEN** the destination directory is created and a prompt describing the task is dispatched to the provider
- **AND** the extension does not write document content itself

#### Scenario: a generated steering document is deleted
- **WHEN** the deletion succeeds
- **THEN** a follow-up prompt asks the assistant to drop references to it from the project rules file
- **AND** a failure of that follow-up is surfaced without leaving the deletion half-reported

### Opening a steering document is counted as a usage signal

Clicking a generated steering document or a workflow reference row SHALL route through the extension's own open command, which records a `steering.opened` telemetry event before handing the file to the editor. The count is what tells us whether the view is actually consulted; a raw editor-open would open the file but leave that use invisible. Only these extension-authored and reference rows are counted — provider-owned, SpecKit-owned, and Companion command and template rows open directly and emit nothing.

#### Scenario: the user opens a generated steering document from the tree
- **WHEN** the row is clicked
- **THEN** a `steering.opened` event is recorded, counted once per open
- **AND** the document then opens in the editor

#### Scenario: the user opens a provider-owned or SpecKit-owned file
- **WHEN** that row is clicked
- **THEN** the file opens directly with no `steering.opened` event
