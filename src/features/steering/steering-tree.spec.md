# Steering Tree — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The steering tree renders the guidance files an assistant reads, straight from disk, under the configured provider's own filenames. It shows a section only when it holds something, keeps the provider node as the stable entry point, and re-renders when the files behind it change.

## Requirements

### Steering is a window over files on disk, never a second source of truth

The view SHALL render only what exists on disk at read time and SHALL NOT cache guidance content in its own store. Every row either opens a real file or offers the action that creates one, so what the user sees is what the assistant reads.

#### Scenario: a guidance file is edited outside the extension
- **WHEN** a rules file, agent, skill, or the Companion configuration changes on disk
- **THEN** the next render reflects the new content
- **AND** no extension-owned copy of that content survives to disagree with it

#### Scenario: a row's file was deleted
- **WHEN** the file backing a row no longer exists
- **THEN** the row is omitted rather than offering a click that fails

### The tree names the configured provider's own files, never a hard-coded vendor filename

Every file-name label, create-action title, and scope path SHALL be resolved from the active provider's path configuration. Guidance filenames differ per provider, so a hard-coded name would tell the user to create a file their assistant will never read.

#### Scenario: a non-default provider is configured and its project rule file is missing
- **WHEN** the project scope has no rules file for the configured provider
- **THEN** the create action appears inside that scope's group
- **AND** its title names the provider's real filename

### Sections appear only when they hold content, and the provider node stays the stable entry point

The root SHALL omit any section with nothing in it, and SHALL always show the provider node so it remains findable. The Companion node SHALL appear only when the companion extension is installed (surfacing its Configuration and Commands); when it is absent the node is omitted here entirely — the install nudge lives on the higher-signal surfaces (the activity-bar badge, the pinned Specs CTA, and Create Spec) rather than as a warning row in this tree. An always-visible empty section trains users to ignore the view.

#### Scenario: a workspace with no SpecKit scaffolding
- **WHEN** the project has no constitution, scripts, or templates
- **THEN** the SpecKit project-files section is absent entirely
- **AND** the provider node is still present, while the Companion node appears only if the companion extension is installed

### The tree refreshes itself when the files behind it change

The view SHALL watch the directories and files it renders — the provider's agent and skill locations at both scopes, the Companion configuration, and the Companion install marker — and re-render on create, change, or delete. Requiring a manual refresh means the view is routinely wrong about the assistant's context.

#### Scenario: a skill is added in the user scope
- **WHEN** the skill's definition file appears on disk
- **THEN** the tree re-renders and the skill is listed without a manual refresh

## Uncovered

_None — every file in the area was read._
