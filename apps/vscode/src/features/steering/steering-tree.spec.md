# Steering Tree — Living Spec

<!-- reviewed: 2b4fbe2c -->

## Purpose

Shows the guidance an AI assistant reads before acting: provider rules files, agents and skills, SpecKit project scaffolding, and a custom workflow's reference folders. The Companion node reads the installed extension's configuration, commands and templates live, confined to its folder.

## Requirements

### Steering is a window over files on disk, never a second source of truth
<!-- touches: apps/vscode/src/features/steering/steeringExplorerProvider.ts -->

The view SHALL show only what exists on disk when it renders and keep no copy of guidance content. Every row opens a real file or offers the action that creates one.

#### Scenario: a guidance file is edited outside the extension
- **WHEN** a rules file, agent, skill or the Companion configuration changes on disk
- **THEN** the next render reflects the new content

#### Scenario: a row's file was deleted
- **WHEN** the file backing a row no longer exists
- **THEN** the row is omitted instead of offering a click that fails

### The tree names the configured provider's own files, never a hard-coded vendor filename
<!-- touches: apps/vscode/src/features/steering/steeringExplorerProvider.ts -->

Every file-name label, create-action title and scope path SHALL come from the active provider's path configuration, because a hard-coded name tells the user to create a file their assistant never reads.

#### Scenario: a non-default provider is configured and its project rules file is missing
- **WHEN** the project scope has no rules file for that provider
- **THEN** the create action appears in that scope's group and its title names the provider's real filename

### Sections appear only when they hold content, and the provider node stays the stable entry point
<!-- touches: apps/vscode/src/features/steering/steeringExplorerProvider.ts -->

The root SHALL omit any empty section and always show the provider node.

#### Scenario: a workspace with no SpecKit scaffolding
- **WHEN** the project has no constitution, scripts or templates
- **THEN** the SpecKit project-files section is absent and the provider node is still present

### The Companion node appears only when the companion extension is installed
<!-- touches: apps/vscode/src/features/steering/steeringExplorerProvider.ts -->

Without the companion extension the Companion node SHALL be omitted with no warning row, since the install prompt lives on the activity-bar badge, the pinned Specs call to action and Create Spec.

#### Scenario: the companion extension is not installed
- **WHEN** the steering tree renders
- **THEN** there is no Companion node and no row asking to install it

### The tree refreshes itself when the files behind it change
<!-- touches: apps/vscode/src/features/steering/steeringExplorerProvider.ts -->

The view SHALL re-render when a file it shows is created, changed or deleted: the provider's agent and skill locations at both scopes, the Companion configuration and the Companion install marker.

#### Scenario: a skill is added in the user scope
- **WHEN** the skill's definition file appears on disk
- **THEN** the tree lists the skill without a manual refresh

### The Companion node lists what the installed extension provides, read live
<!-- touches: apps/vscode/src/features/steering/companionSteering.ts -->

When the Companion extension is installed, the node SHALL list its configuration groups, commands and preset templates from the installed manifest and configuration, not a compiled-in list, and pick up an install without a window reload.

#### Scenario: the Companion adds a command in a later release
- **WHEN** the installed manifest lists a command this extension has never heard of
- **THEN** it appears under the Companion node with its own description, and clicking it opens that command's body file

#### Scenario: the Companion is installed while the view is open
- **WHEN** the install completes
- **THEN** the node appears with its children without a window reload

### Every path the tree opens is confined to the root that owns it
<!-- touches: apps/vscode/src/features/steering/companionSteering.ts, apps/vscode/src/features/steering/steeringExplorerProvider.ts -->

A path built from user- or manifest-supplied text SHALL be used only when it resolves inside its owning root: the workspace for configuration and reference sources, the installed extension directory for command bodies and templates. Otherwise a relative escape in editable text turns a tree click into an arbitrary-file open.

#### Scenario: a manifest points a command body outside the extension directory
- **WHEN** the declared path traverses out of the extension root
- **THEN** the row renders without an open action

#### Scenario: a workflow declares a reference folder outside the workspace
- **WHEN** the declared path resolves outside the workspace root
- **THEN** that source is skipped and no reference row is created

### Unreadable or malformed configuration degrades to an empty section
<!-- touches: apps/vscode/src/features/steering/companionSteering.ts -->

A read or parse failure while assembling a section SHALL yield an empty section, with no error dialog and the rest of the tree intact.

#### Scenario: the Companion configuration file is not valid YAML
- **WHEN** the configuration groups are listed
- **THEN** no group entries appear and the rest of the tree renders normally

### Configuration the runtime cannot read shows no settings
<!-- touches: apps/vscode/src/features/steering/companionSteering.ts -->

Configuration that parses locally but uses YAML the runtime rejects (anchors, block scalars, tab indentation) SHALL be treated as unparseable, so the tree never advertises settings the runtime will replace with its defaults.

#### Scenario: the configuration uses an anchor
- **WHEN** the configuration groups are listed
- **THEN** no group entries appear

## Uncovered

_None: every file in the area was read._
