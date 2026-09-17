# Steering Tree — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Shows the guidance an AI assistant reads before acting: provider rules files, agents and skills, SpecKit project scaffolding, and a custom workflow's reference folders. These rules cover what the tree shows and when it re-renders.

## Requirements

### Steering is a window over files on disk, never a second source of truth
<!-- touches: src/features/steering/steeringExplorerProvider.ts -->

The view SHALL render only what exists on disk at read time and SHALL NOT cache guidance content. Every row either opens a real file or offers the action that creates one.

#### Scenario: a guidance file is edited outside the extension
- **WHEN** a rules file, agent, skill, or the Companion configuration changes on disk
- **THEN** the next render reflects the new content
- **AND** no extension-owned copy of that content remains

#### Scenario: a row's file was deleted
- **WHEN** the file backing a row no longer exists
- **THEN** the row is omitted instead of offering a click that fails

### The tree names the configured provider's own files, never a hard-coded vendor filename
<!-- touches: src/features/steering/steeringExplorerProvider.ts -->

Every file-name label, create-action title, and scope path SHALL be resolved from the active provider's path configuration. A hard-coded name would tell the user to create a file their assistant never reads.

#### Scenario: a non-default provider is configured and its project rule file is missing
- **WHEN** the project scope has no rules file for the configured provider
- **THEN** the create action appears inside that scope's group
- **AND** its title names the provider's real filename

### Sections appear only when they hold content, and the provider node stays the stable entry point
<!-- touches: src/features/steering/steeringExplorerProvider.ts -->

The root SHALL omit any empty section and SHALL always show the provider node. The Companion node, with its Configuration and Commands, SHALL appear only when the companion extension is installed. When it is absent, the node is omitted and no warning row is shown, since the install nudge lives on the activity-bar badge, the pinned Specs CTA, and Create Spec.

#### Scenario: a workspace with no SpecKit scaffolding
- **WHEN** the project has no constitution, scripts, or templates
- **THEN** the SpecKit project-files section is absent
- **AND** the provider node is still present, while the Companion node appears only if the companion extension is installed

### The tree refreshes itself when the files behind it change
<!-- touches: src/features/steering/steeringExplorerProvider.ts -->

The view SHALL watch what it renders (the provider's agent and skill locations at both scopes, the Companion configuration, and the Companion install marker) and re-render on create, change, or delete.

#### Scenario: a skill is added in the user scope
- **WHEN** the skill's definition file appears on disk
- **THEN** the tree re-renders and lists the skill without a manual refresh

## Uncovered

_None: every file in the area was read._
