# Steering — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Steering is the extension's window onto the persistent guidance an AI assistant reads before it does anything: the provider's rules files, its agents and skills, the SpecKit project scaffolding, the Companion extension's configuration and commands, and the reference folders a custom workflow consults. Without it those files stay invisible — scattered across the workspace and the user's home directory, under names that differ per provider — so users can't tell what context their assistant actually has, and can't correct it.

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

### Sections appear only when they hold content, except the two stable entry points

The root SHALL omit any section with nothing in it, and SHALL always show the Companion and provider nodes so those two remain findable. An always-visible empty section trains users to ignore the view; a disappearing entry point makes install and configuration undiscoverable.

#### Scenario: a workspace with no SpecKit scaffolding
- **WHEN** the project has no constitution, scripts, or templates
- **THEN** the SpecKit project-files section is absent entirely
- **AND** the Companion and provider nodes are still present

### A provider's label and its mark resolve from one decision

The row's display name and its icon SHALL derive from the same provider resolution, and an unrecognized provider or host SHALL fall back to a neutral glyph. Two independent lookups would drift, and a fallback that lands on a specific vendor's mark ships that vendor's branding for a product that isn't theirs.

#### Scenario: the host editor is not one the extension recognizes
- **WHEN** the in-editor chat provider is active in an unknown host
- **THEN** the row shows the neutral chat glyph
- **AND** never another vendor's logo

#### Scenario: a provider ships no official mark
- **WHEN** that provider is configured
- **THEN** the neutral glyph is chosen deliberately rather than reached by falling through the lookup

### The Companion node reports install state and reads the installed extension live

The node SHALL distinguish "installed" from "not installed" from the extension's on-disk presence, offer the install action when absent, and when present derive its configuration groups, command list, and preset templates by reading the installed manifest and configuration rather than a list compiled into this extension. A compiled-in list goes stale the moment the Companion ships a new command.

#### Scenario: the Companion adds a command in a later release
- **WHEN** the installed manifest lists a command this extension has never heard of
- **THEN** it appears under the Companion node with its own description
- **AND** clicking it opens that command's body file

#### Scenario: the Companion is installed while the view is open
- **WHEN** the install completes
- **THEN** the node switches to its installed presentation and populates its children with no window reload

### Every path the tree opens is confined to the root that owns it

A path assembled from user- or manifest-supplied text SHALL be rejected unless it resolves inside its owning root — the workspace for configuration and reference sources, the installed extension directory for command bodies and templates. Manifests and settings are editable text, so a relative escape must not turn a tree click into an arbitrary-file open.

#### Scenario: a manifest points a command body outside the extension directory
- **WHEN** the declared path traverses out of the extension root
- **THEN** the row renders without an open action rather than opening the escaped path

#### Scenario: a workflow declares a reference folder outside the workspace
- **WHEN** the declared path resolves outside the workspace root
- **THEN** that source is skipped and no reference row is created for it

### The tree refreshes itself when the files behind it change

The view SHALL watch the directories and files it renders — the provider's agent and skill locations at both scopes, the Companion configuration, and the Companion install marker — and re-render on create, change, or delete. Requiring a manual refresh means the view is routinely wrong about the assistant's context.

#### Scenario: a skill is added in the user scope
- **WHEN** the skill's definition file appears on disk
- **THEN** the tree re-renders and the skill is listed without a manual refresh

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

### Unreadable or malformed configuration degrades to an empty section

Any parse or read failure while assembling a section SHALL yield an empty result for that section rather than an error dialog or a failed render. The steering view is ambient context, so one broken YAML file must not take the tree down.

#### Scenario: the Companion configuration file is not valid YAML
- **WHEN** the configuration group list is requested
- **THEN** no group entries are produced
- **AND** the rest of the tree renders normally

## Uncovered

_None — every file in the area was read._
