# Browse Steering Files — Living Spec

## Purpose

The Steering view gathers the standing instructions an assistant and Spec Kit already read into one tree beside the specs, so a person can find, open and start them without knowing each provider's file layout. Without it those files are scattered across the project, the home directory and the Spec Kit install.

## Requirements

### The tree shows only the sections that have something in them
<!-- touches: apps/vscode/src/features/steering/steeringExplorerProvider.ts -->

The Steering view SHALL always show one node named for the configured AI provider. It SHALL add a Companion node first when the Companion spec-kit extension is installed in the project, Steering Docs when the provider has a steering directory with at least one document in it, SpecKit Project Files when a constitution, script or template exists, and References when a custom workflow names reference folders that exist inside the workspace. A section with nothing to list SHALL be left out.

#### Scenario: a fresh project with Claude Code selected
- **WHEN** the project has no steering documents, no Spec Kit files and no Companion install
- **THEN** the view shows a single Claude Code node

#### Scenario: a reference path outside the workspace
- **WHEN** a custom workflow names a reference folder that resolves outside the workspace
- **THEN** it is not listed

### The provider node splits into Project and User scopes
<!-- touches: apps/vscode/src/features/steering/steeringExplorerProvider.ts, apps/vscode/src/features/agents/**, apps/vscode/src/features/skills/** -->

Under the provider, Project SHALL list what lives in this repository and User what lives on this machine for every project, and the word for the second scope SHALL always be User. Each scope SHALL show the provider's rule file, or an action to create it named with that provider's real filename, plus Agents, Skills and Settings wherever the provider keeps such files and some exist. Switching `speckit.aiProvider` SHALL repoint the whole node at the new provider's files. A provider with no files of its own to browse SHALL show none of these.

#### Scenario: no project rule file yet with Gemini selected
- **WHEN** the project has no `GEMINI.md`
- **THEN** Project offers "Create project-level GEMINI.md" instead of a file row

#### Scenario: skills installed by Claude Code plugins
- **WHEN** Claude Code is the provider and a plugin ships skills
- **THEN** they appear under User Skills, named `<plugin>:<skill>`

### Agent and skill rows describe themselves and flag a broken skill
<!-- touches: apps/vscode/src/features/agents/agentManager.ts, apps/vscode/src/features/skills/skillManager.ts, apps/vscode/src/features/steering/steeringExplorerProvider.ts -->

An agent or skill row SHALL take its name and tooltip from the file's own front matter, show how many tools it is allowed when it declares them, and open its file when clicked. A skill whose front matter cannot be read SHALL still be listed under its folder name, marked with a warning that says so.

#### Scenario: a skill with invalid front matter
- **WHEN** a skill's `SKILL.md` has no parseable front matter
- **THEN** the row shows the folder name with a warning tooltip, not an empty gap

### The Companion node shows its configuration, commands and templates
<!-- touches: apps/vscode/src/features/steering/companionSteering.ts, apps/vscode/src/features/steering/steeringExplorerProvider.ts -->

The Companion node SHALL offer Configuration, which lists one row per top-level setting group in `.specify/companion.yml` and opens the file, Commands, which lists the `/speckit.companion.*` commands read live from the installed extension, and Templates when the install ships any. A command row SHALL open a file only when that file sits inside the installed extension's own folder. Configuration written in YAML that the spec-kit runtime refuses, such as anchors, aliases, block scalars, tab indentation or more than one document, SHALL count as unreadable so the tree never advertises settings the runtime would silently replace with its defaults, and an unreadable or absent file SHALL leave Configuration empty with no error raised and the rest of the tree intact.

#### Scenario: a newer spec-kit extension adds a command
- **WHEN** the installed extension lists a command this VS Code extension has never heard of
- **THEN** it appears under Commands without an update to the VS Code extension

#### Scenario: a configuration that only this editor could read
- **WHEN** `.specify/companion.yml` uses a YAML anchor
- **THEN** Configuration lists no setting groups, no error is shown, and Commands and Templates are unaffected

### Authoring actions ask the assistant to do the writing
<!-- touches: apps/vscode/src/features/steering/steeringManager.ts, apps/vscode/src/features/steering/steeringCommands.ts, package.json -->

**New Steering Document…** SHALL ask for a description and hand the assistant a prompt to write a markdown file into the steering directory. **Refine** SHALL hand it a prompt to improve the chosen document in place. **Delete Steering** SHALL remove the file itself and then ask the assistant to clean up references to it. None of these wait for or verify the assistant's result.

#### Scenario: the description is left empty
- **WHEN** someone cancels or submits nothing in the New Steering Document prompt
- **THEN** nothing is sent and nothing is created

### Only steering documents can be refined or deleted from the tree
<!-- touches: package.json, apps/vscode/src/features/steering/steeringExplorerProvider.ts -->

Refine and Delete Steering SHALL be offered only on rows under Steering Docs and References. Every other file row, whether owned by the provider, Spec Kit or Companion, SHALL offer open and the two reveal actions and nothing destructive.

#### Scenario: right-clicking the constitution
- **WHEN** someone opens the menu on the Constitution row
- **THEN** it holds Reveal in VS Code Explorer and Reveal in File Manager only

### The tree keeps up with the files it lists
<!-- touches: apps/vscode/src/features/steering/steeringExplorerProvider.ts -->

The view SHALL refresh on its own when agents, skills, the Companion configuration or the Companion install change on disk, at project and user scope, and **Refresh Steering** SHALL force the same re-read.

#### Scenario: installing the Companion extension
- **WHEN** the Companion spec-kit extension lands in the project
- **THEN** the Companion node appears without a reload

## Uncovered

- Create Project Rule and Create User Rule are labelled with the configured provider's filename, but what they do is Claude-only: the project action runs `claude "/init"` in a terminal and the user action writes `~/.claude/CLAUDE.md`. The steering prompts also tell the assistant to update `CLAUDE.md` whatever the provider. Left out of the requirements as a likely defect, not a behaviour to preserve.
- Which path each provider uses for its rule file, steering directory, agents, skills and settings is provider configuration, owned by the providers capability.
