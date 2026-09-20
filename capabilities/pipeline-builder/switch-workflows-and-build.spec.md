# Switch Workflows and Build — Living Spec

## Purpose

Configuration is the source of truth and the commands the assistant reads are derived from it. A person needs to know which whole configuration is in force, whether the built commands are behind it, and what the last change or build actually did, without leaving the panel.

## Requirements

### The header names the workflow in force and switches it
<!-- touches: apps/vscode/webview/src/pipeline-builder/Header.tsx, apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/src/features/specs/pipelineGraph.ts -->

The **Workflow** dropdown SHALL list every named workflow in `.specify/companion/workflows/`, **This project** when the project has a `companion.yml`, and **As shipped** always, marking the one in force. Picking one SHALL switch the whole configuration by changing only the `workflow:` line of `companion.yml`.

#### Scenario: an unnamed configuration
- **WHEN** the project runs its own `companion.yml`
- **THEN** the header calls it this project's pipeline and not a blank name

### As shipped parks the project's configuration without deleting it
<!-- touches: apps/vscode/webview/src/pipeline-builder/Header.tsx, apps/vscode/webview/src/pipeline-builder/Canvas.tsx, apps/vscode/webview/src/pipeline-builder/counts.ts -->

While **As shipped** is in force nothing in the project's configuration runs and the file stays as it was. The board SHALL draw the shipped workflow with each of the project's hooks where it would attach, dashed, struck through and labelled `parked`, and the header SHALL count separately the hooks that have nowhere to be drawn. **Use this project's pipeline** SHALL always be offered while shipped is in force, and switching there and back SHALL leave the file as it started.

#### Scenario: a hook anchored to something shipped does not have
- **WHEN** a parked hook's anchor does not exist in the shipped workflow
- **THEN** the header says how many hooks could not be placed instead of losing them

### A new workflow starts from what runs now or from a shipped preset
<!-- touches: apps/vscode/webview/src/pipeline-builder/AttachForm.tsx, apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/src/features/specs/pipelineGraph.ts -->

**New workflow** SHALL offer the workflow in force and every shipped preset, each with what it does, and SHALL refuse a name that is not a valid file name or is already taken. Creating one copies the start into `.specify/companion/workflows/<name>.yml`, switches to it and opens it.

#### Scenario: no presets ship
- **WHEN** the installed extension offers no presets
- **THEN** only what runs now is offered as a start

### Nothing takes effect until a build, and the header says when one is owed
<!-- touches: apps/vscode/webview/src/pipeline-builder/Header.tsx, apps/vscode/src/features/specs/pipelineBuild.ts -->

The header SHALL say when the built commands are behind the configuration or were never built, with how many changed steps the assistant is not reading, and **Build** SHALL be the filled action only then. A project with no configuration, or one already built, SHALL show no such line.

#### Scenario: the build is current
- **WHEN** the configuration has not changed since the last build
- **THEN** no staleness line is shown and Build stays outlined

### Build and Preview build answer in the header
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/webview/src/pipeline-builder/Header.tsx -->

**Build** and **Preview build** SHALL run the same commands the palette does, disable the header's actions while running, and report in the header: when it finished, how many commands were written or which would change, and **Show the log** when there is one. A preview writes nothing. A failed build SHALL say it wrote nothing, and the report SHALL clear as soon as the configuration changes again.

#### Scenario: a preview with nothing to change
- **WHEN** a preview finds no command would change
- **THEN** the header says so instead of showing an empty list

### Every write says what it did, and the last one can be taken back where possible
<!-- touches: apps/vscode/src/features/pipeline-builder/builderPanel.ts, apps/vscode/webview/src/pipeline-builder/StatusLine.tsx -->

Each write SHALL put one line at the foot of the panel saying what happened and what comes next, and a refusal SHALL be said in the panel as well. A write that can be taken back SHALL carry **Undo** until the next write of any kind, and an undo that is no longer held SHALL say it can no longer be taken back. A restore that fails SHALL keep the held copy so it can be tried again.

#### Scenario: another write follows a removal
- **WHEN** a node is removed and then another node is reordered
- **THEN** the removal's Undo is gone

### The first open explains the board once
<!-- touches: apps/vscode/webview/src/pipeline-builder/Header.tsx, apps/vscode/src/features/pipeline-builder/builderPanel.ts -->

A project with no configuration of its own SHALL see one line saying what the board is and what Build does, until it is dismissed in that workspace or the project makes its first change. **Open companion.yml** SHALL be offered only when the file exists.

#### Scenario: the line was dismissed
- **WHEN** the panel is reopened in the same workspace after dismissal
- **THEN** the line is not shown again
