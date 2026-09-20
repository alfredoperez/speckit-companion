# Set Up and Update — Living Spec

## Purpose

Getting the VS Code extension from "just installed" to "ready to work", and keeping it current afterwards. Without this a new user lands in an empty sidebar with no idea that a CLI, a project init or a provider choice is still missing, and an existing user never learns a new version shipped.

## Requirements

### Start-up needs a chosen AI provider
<!-- touches: apps/vscode/src/extension.ts, apps/vscode/src/ai-providers/** -->

When no AI provider has been chosen, the extension SHALL ask for one at start-up before it sets up any view or command. Declining leaves the extension inactive and says why.

#### Scenario: the provider question is cancelled
- **WHEN** a user closes the provider picker without choosing
- **THEN** an error explains that a provider is required, and no sidebar view, command or watcher is set up for this window

### Start-up offers the next missing setup step
<!-- touches: apps/vscode/src/extension.ts, apps/vscode/src/speckit/detector.ts, package.json -->

At start-up the extension SHALL work out whether the `specify` CLI is on the machine, whether the open folder is a SpecKit project (a `.specify` folder, or SpecKit agent files), and whether the constitution still holds template placeholders. The Specs view's empty state and one start-up suggestion SHALL point at the first step still missing: open a folder, initialise the workspace, configure the constitution, or create the first spec.

#### Scenario: CLI present, project not initialised
- **WHEN** a folder is open, the CLI is found and the project has no `.specify` folder
- **THEN** a suggestion offers Initialize Now, Learn More and Don't Ask Again, and the Specs view shows an Initialize Workspace action

#### Scenario: the suggestion was declined for good
- **WHEN** the user picked Don't Ask Again in any project
- **THEN** the initialise suggestion never appears again in any project, while the Specs view's empty state still offers the action

### CLI install, init and upgrade run in a terminal the user can watch
<!-- touches: apps/vscode/src/speckit/detector.ts, apps/vscode/src/speckit/cliCommands.ts -->

Installing the CLI, initialising the workspace and the upgrade choices (`SpecKit: Upgrade` offers Upgrade All, Upgrade Project, Upgrade CLI and Update spec-kit Extension) SHALL each run as a command in a visible integrated terminal and offer a window reload for when it finishes. The project upgrade SHALL refresh the scaffolding for the currently configured AI provider. Commands that act on a project SHALL refuse with a message when no folder is open.

#### Scenario: upgrading a project
- **WHEN** the user picks Upgrade Project with Claude as the provider
- **THEN** a terminal opens at the project root and re-runs the project init in place for that provider, and a message offers Reload Window

### Settings saved by an older version never break start-up
<!-- touches: apps/vscode/src/core/settingsMigration.ts, apps/vscode/src/extension.ts -->

At start-up the extension SHALL rewrite old setting values to their current form at the same scope they were set (User stays User, Workspace stays Workspace), carry an old notification opt-out onto `speckit.notifications.stepComplete`, and remove settings that no longer exist. A value that has not been rewritten yet SHALL still read correctly, and a failed rewrite SHALL be logged and skipped, never stop start-up.

#### Scenario: an old on/off/beta string
- **WHEN** `speckit.viewer.activityPanel` holds `"off"` in Workspace settings from an older version
- **THEN** it becomes `false` in Workspace settings, User settings are untouched, and the panel stays off even if the rewrite fails

#### Scenario: the retired phase notification was turned off
- **WHEN** the retired phase-completion toggle was `false` at some scope
- **THEN** `speckit.notifications.stepComplete` becomes `false` at that scope before the retired key is removed

### A new VS Code extension version is checked for once a day
<!-- touches: apps/vscode/src/speckit/updateChecker.ts, apps/vscode/src/speckit/utilityCommands.ts -->

The extension SHALL look for a newer published release of itself at start-up, at most once every 24 hours, and whenever the user runs `SpecKit: Check for Updates`. Only published releases of the VS Code extension count: drafts, prereleases and releases of the spec-kit extension, which share the same release list, SHALL be ignored. A failed check SHALL be silent apart from the output log.

#### Scenario: the newest release in the list is the other product
- **WHEN** the most recent release is a spec-kit extension release and the newest VS Code extension release equals the running version
- **THEN** no update is offered

#### Scenario: checked an hour ago
- **WHEN** the window reloads an hour after the last check
- **THEN** no request is made, unless the user runs the check command

### An available version can be installed, read about, or skipped
<!-- touches: apps/vscode/src/speckit/updateChecker.ts -->

The update notification SHALL offer Update, View Changelog and Skip. Update installs the newest Marketplace version and offers a reload, falling back to the extension's page when the install fails. View Changelog opens the release page of that exact version. Skip silences that version only.

#### Scenario: a version was skipped
- **WHEN** the user skipped 1.4.0 and 1.5.0 is later published
- **THEN** 1.4.0 is never offered again and 1.5.0 is
