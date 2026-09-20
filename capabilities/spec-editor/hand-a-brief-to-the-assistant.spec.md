# Hand a Brief to the Assistant — Living Spec

## Purpose

Creating a spec means turning what the person wrote into a command their AI assistant runs. This covers what the assistant receives, which command it is given, what happens when the chosen workflow is not installed, and how long the handed-off files stay around.

## Requirements

### The assistant receives the brief as a markdown file
<!-- touches: apps/vscode/src/features/spec-editor/**, apps/vscode/src/ai-providers/** -->

On create, the brief SHALL be written to a markdown file outside the project, with an `## Attached Images` section linking each attached image by its path on disk. The configured AI assistant SHALL be given one prompt: the specify command followed by that file's path, in a session titled "SpecKit - New Spec". The panel SHALL close once the hand-off succeeds.

#### Scenario: a brief with two screenshots
- **WHEN** someone creates a spec with text and two attached images
- **THEN** the assistant gets the specify command plus a file path, and the file holds the text followed by both images as markdown image links

#### Scenario: extension storage is not writable
- **WHEN** the extension's own storage folder cannot be written
- **THEN** the files go to the operating system's temp folder and the create still works

### The selected workflow decides the command and is recorded on the new spec
<!-- touches: apps/vscode/src/features/spec-editor/**, apps/vscode/webview/src/spec-editor/**, apps/vscode/src/features/workflows/**, apps/vscode/src/ai-providers/** -->

The workflow picker SHALL list the project's workflows with the default from `speckit.defaultWorkflow` preselected, and SHALL be hidden when there is only one. Create Spec SHALL run the selected workflow's specify command, and a workflow's extra specify commands SHALL appear as buttons beside Create Spec that run that command with the same brief. Unless `speckit.aiContextInstructions` is off, the handed-off file SHALL end with an instruction telling the assistant to record the workflow that actually ran on the new spec, so every later step uses the same workflow.

#### Scenario: a custom workflow is selected
- **WHEN** someone picks a project-defined workflow
- **THEN** its description shows under the picker, its extra command buttons appear, and Create Spec runs its specify command

#### Scenario: the recorded workflow after a downgrade
- **WHEN** Companion was picked but the spec was created with standard SpecKit
- **THEN** the new spec records standard SpecKit, not Companion

### Companion reads as install-to-enable when its extension is missing
<!-- touches: apps/vscode/src/features/spec-editor/**, apps/vscode/webview/src/spec-editor/** -->

While the Companion Spec Kit extension is missing, the Companion entry SHALL read "install to enable", a pitch with **Try Companion for this spec** SHALL sit under the picker unless Companion is already the default, and with Companion selected the primary button SHALL become an install button. **Try Companion for this spec** SHALL pick Companion for that one submission only and SHALL never change the configured default.

#### Scenario: trying Companion once
- **WHEN** someone uses **Try Companion for this spec**
- **THEN** that submission uses Companion and `speckit.defaultWorkflow` is left as it was

### Picking Companion without its extension never silently creates a standard spec
<!-- touches: apps/vscode/src/features/spec-editor/**, apps/vscode/webview/src/spec-editor/** -->

A Companion create that still reaches the extension SHALL first ask, once ever, to install it or use SpecKit instead, so nobody gets a standard spec they did not ask for. Choosing install SHALL start the install and create nothing, and choosing SpecKit SHALL create a standard spec and be remembered. Dismissing SHALL create nothing and leave the form as it was.

#### Scenario: the person chooses to install
- **WHEN** they answer the prompt with Install SpecKit Companion
- **THEN** the install starts, no spec is created, and they are told to run New Spec again when it finishes

#### Scenario: the person already declined once
- **WHEN** they create with Companion selected after earlier choosing Use SpecKit Instead
- **THEN** no prompt appears and a standard spec is created

### Auto builds the whole spec hands-off, or does not start
<!-- touches: apps/vscode/src/features/spec-editor/**, apps/vscode/webview/src/spec-editor/** -->

The **Auto** button SHALL appear only when the selected workflow supports it and is installed. It SHALL hand the brief to `/speckit.companion.auto`, which runs specify through mark-complete with no pauses. Auto has no standard equivalent, so it SHALL never fall back to another command.

#### Scenario: Auto without the Companion extension
- **WHEN** an Auto create arrives and the Companion Spec Kit extension is not installed
- **THEN** nothing runs, the form shows an error, and a warning offers to install the extension

### An assistant that can only read inside the project gets the images inside the project
<!-- touches: apps/vscode/src/features/spec-editor/**, apps/vscode/src/ai-providers/** -->

For OpenCode, which refuses to read outside the project root, attached images SHALL be copied into `.speckit-companion/spec-editor/` in the workspace and the brief's image links SHALL point at those copies. That folder SHALL ignore itself in git from first use. With GitHub Copilot CLI the person SHALL be warned that images are passed as file references and may not be processed.

#### Scenario: no workspace folder, or the copy fails
- **WHEN** the images cannot be copied into the project
- **THEN** the brief keeps the original image paths and the create still goes ahead

### Handed-off files stay until the assistant has had time to read them
<!-- touches: apps/vscode/src/features/spec-editor/** -->

The assistant reads the brief and its images after the create returns, so nothing handed to it SHALL be deleted at hand-off. Handed-off files, including the copies inside the project, SHALL be removed on a later extension start once they are 24 hours old. Images attached but not yet submitted belong to the panel session and SHALL be cleared when that session's spec is created.

#### Scenario: VS Code restarts a day later
- **WHEN** the extension starts and a handed-off brief is older than 24 hours
- **THEN** its folder is deleted, in extension storage and in the workspace

## Uncovered

- How each assistant receives the prompt (terminal, IDE chat, a panel that inlines the brief instead of the path) belongs to the AI providers area.
- The install and update banner at the top of the panel is shared with the Activity panel and belongs to the install-prompt area.
