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

### Sections appear only when they hold content, and the provider node stays the stable entry point

The root SHALL omit any section with nothing in it, and SHALL always show the provider node so it remains findable. The Companion node SHALL appear only when the companion extension is installed (surfacing its Configuration and Commands); when it is absent the node is omitted here entirely — the install nudge lives on the higher-signal surfaces (the activity-bar badge, the pinned Specs CTA, and Create Spec) rather than as a warning row in this tree. An always-visible empty section trains users to ignore the view.

#### Scenario: a workspace with no SpecKit scaffolding
- **WHEN** the project has no constitution, scripts, or templates
- **THEN** the SpecKit project-files section is absent entirely
- **AND** the provider node is still present, while the Companion node appears only if the companion extension is installed

### A provider's label and its mark resolve from one decision

The row's display name and its icon SHALL derive from the same provider resolution, and an unrecognized provider or host SHALL fall back to a neutral glyph. Two independent lookups would drift, and a fallback that lands on a specific vendor's mark ships that vendor's branding for a product that isn't theirs.

#### Scenario: the host editor is not one the extension recognizes
- **WHEN** the in-editor chat provider is active in an unknown host
- **THEN** the row shows the neutral chat glyph
- **AND** never another vendor's logo

#### Scenario: a provider ships no official mark
- **WHEN** that provider is configured
- **THEN** a themed Codicon matching the provider's own QuickPick icon is used when it declares one (Antigravity resolves to its rocket glyph), otherwise the neutral chat glyph is chosen deliberately rather than reached by falling through the lookup

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

### Opening a steering document is counted as a usage signal

Clicking a generated steering document or a workflow reference row SHALL route through the extension's own open command, which records a `steering.opened` telemetry event before handing the file to the editor. The count is what tells us whether the view is actually consulted; a raw editor-open would open the file but leave that use invisible. Only these extension-authored and reference rows are counted — provider-owned, SpecKit-owned, and Companion command and template rows open directly and emit nothing.

#### Scenario: the user opens a generated steering document from the tree
- **WHEN** the row is clicked
- **THEN** a `steering.opened` event is recorded, counted once per open
- **AND** the document then opens in the editor

#### Scenario: the user opens a provider-owned or SpecKit-owned file
- **WHEN** that row is clicked
- **THEN** the file opens directly with no `steering.opened` event

### Unreadable or malformed configuration degrades to an empty section

Any parse or read failure while assembling a section SHALL yield an empty result for that section rather than an error dialog or a failed render. The steering view is ambient context, so one broken YAML file must not take the tree down.

#### Scenario: the Companion configuration file is not valid YAML
- **WHEN** the configuration group list is requested
- **THEN** no group entries are produced
- **AND** the rest of the tree renders normally

Configuration the tree can parse but the runtime cannot SHALL be treated the same as unparseable. The YAML library used here accepts anchors, block scalars and tab indentation that the runtime reader rejects and replaces with the shipped defaults, so reading the file more permissively than the thing that acts on it would list groups from a configuration that is never going to be applied.

#### Scenario: the configuration uses YAML the runtime cannot read
- **WHEN** the file parses locally but contains a construct the runtime reader rejects
- **THEN** no group entries are produced
- **AND** the tree does not advertise settings the runtime will ignore

### A file the view creates lands where the view watches and reads

Every location the view resolves for a user-scope file SHALL be derived from the operating system's reported home directory, so the folder written to when creating a file, the folder watched for changes, and the folder read when listing are always the same. Deriving any one of them from an environment variable instead lets them disagree — an unset variable yields a path relative to the editor's working directory, and the created file becomes invisible to the view that just created it.

#### Scenario: creating the global rules file with no home variable set
- **WHEN** the user creates the global rules file in an environment that does not define the home-directory variable
- **THEN** the file is created under the operating system's reported home directory
- **AND** the view lists it without a manual refresh

## Uncovered

_None — every file in the area was read._
