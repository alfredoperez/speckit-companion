# Pick a Workflow — Living Spec

## Purpose

A workflow is the ordered list of steps a spec goes through and the command dispatched at each one. The choice is made once per spec and everything else (the viewer rail, the sidebar, the next-step button) is derived from it. If two surfaces resolved the workflow differently, a spec would show one pipeline and run another.

## Requirements

### Two workflows ship, and both always resolve
<!-- touches: apps/vscode/src/features/workflows/workflowManager.ts -->

The extension SHALL always provide two built-in workflows. **SpecKit** runs specify, plan, tasks, implement with the stock `speckit.*` commands. **SpecKit Companion** runs the same four with the `speckit.companion.*` commands and ends with a fifth step, mark-complete, that closes the spec. Specify, plan and tasks each produce a document. Implement and mark-complete produce none. The names `speckit`, `companion` and the legacy `default` (read as `speckit`) are reserved.

#### Scenario: an old spec recorded `default`
- **WHEN** a spec's recorded workflow is `default`
- **THEN** it resolves to the SpecKit workflow

### The workflow is recorded on the spec, and the recording wins
<!-- touches: apps/vscode/src/features/workflows/workflowSelector.ts, apps/vscode/src/features/workflows/workflowManager.ts, apps/vscode/src/features/workflows/pipelineResolution.ts -->

A spec's workflow name SHALL be stored in its `.spec-context.json` when the spec is created, or on the first step run for a spec that has none. From then on the recorded workflow SHALL decide that spec's steps and commands regardless of the current default, the current provider, or what is offered for new specs. Surfaces that only display a spec SHALL resolve its workflow without writing anything. Saving the choice SHALL keep everything else already in the file, and SHALL refuse to write when the existing file cannot be read or parsed.

#### Scenario: the default changes after a spec exists
- **WHEN** a spec recorded `speckit` and the user later sets `speckit.defaultWorkflow` to `companion`
- **THEN** that spec still shows and runs the SpecKit steps

#### Scenario: the recorded workflow was removed from settings
- **WHEN** a spec names a custom workflow that no longer exists
- **THEN** it is displayed with the effective default's steps, and its file is left as it was

#### Scenario: a corrupt context file
- **WHEN** a step run tries to record the workflow and the existing file is not valid JSON
- **THEN** the save fails with an error and the file is not overwritten

### The pre-selected workflow follows an explicit setting, then what is installed
<!-- touches: apps/vscode/src/features/workflows/workflowManager.ts -->

The workflow pre-selected for a new spec SHALL be the value of `speckit.defaultWorkflow` when the user set one at any scope, most specific scope first. When the user never set it, it SHALL be `companion` if the Companion Spec Kit extension is installed in that workspace and `speckit` otherwise. The setting restricts nothing and never touches existing specs.

#### Scenario: nothing set, extension installed
- **WHEN** `speckit.defaultWorkflow` is unset and `.specify/extensions/companion` is present
- **THEN** Companion is pre-selected

#### Scenario: an explicit `speckit`
- **WHEN** the user set `"speckit"` and the extension is installed
- **THEN** SpecKit is pre-selected

### Companion is always offered, marked when it cannot run yet
<!-- touches: apps/vscode/src/features/workflows/workflowManager.ts -->

The list of workflows offered for a new spec SHALL always include SpecKit and SpecKit Companion. Companion SHALL carry whether its extension is installed so the form can show it as install-to-enable instead of hiding it, and SHALL be the one workflow that offers the Auto run. When the project reshapes the Companion pipeline through `.specify/companion.yml`, the Companion entry SHALL say it is customised by the project. A `workflow: shipped` line does not count as customised.

#### Scenario: the extension is missing
- **WHEN** the create form opens in a workspace without the Companion Spec Kit extension
- **THEN** Companion is listed and marked as not installed

### A Companion command without its extension falls back to stock
<!-- touches: apps/vscode/src/features/specs/profileDispatch.ts, apps/vscode/src/features/specs/dispatchStep.ts -->

When a `speckit.companion.*` command is about to be dispatched and the Companion Spec Kit extension is not installed in that workspace, specify, plan, tasks and implement SHALL be dispatched as their stock `speckit.*` twins. Any other Companion command, mark-complete included, SHALL not be dispatched at all. The user SHALL be warned with an **Install spec-kit Extension** action, at most once every ten minutes however many steps fall back.

#### Scenario: Plan on a Companion spec without the extension
- **WHEN** the user runs Plan
- **THEN** `/speckit.plan` is dispatched and a warning offers the install

#### Scenario: mark-complete without the extension
- **WHEN** the terminal step is triggered
- **THEN** nothing is sent to the assistant

### A custom workflow is offered only when it is valid and the provider can run it
<!-- touches: apps/vscode/src/features/workflows/workflowManager.ts -->

A workflow under `speckit.customWorkflows` SHALL be offered only when its name is lowercase letters, digits and hyphens starting with a letter, is not a reserved name, and does not repeat an earlier workflow's. One that fails SHALL be skipped with a line in the extension's output log and never a blocking error, so one bad entry cannot take the create form down with it. A workflow listing `supportedAiProviders` SHALL be offered for new specs only while the active provider is in that list. A step command written with a leading slash SHALL behave the same as one written without.

#### Scenario: a provider-restricted workflow under another provider
- **WHEN** a workflow lists `["claude"]` and the active provider is `gemini`
- **THEN** it is missing from the create form, and an existing spec that recorded it still shows its own steps

#### Scenario: two workflows share a name
- **WHEN** settings define `my-flow` twice
- **THEN** the first is used and the second is skipped with a log line

### A new spec starts at the workflow's first document step
<!-- touches: apps/vscode/src/features/workflows/workflowManager.ts -->

The command dispatched when a spec is created SHALL be the command of the chosen workflow's first step that produces a document, whatever that step is called. Extra buttons a workflow declares for that step or for `specify` SHALL be offered beside the create action.

#### Scenario: a workflow that opens with `discuss`
- **WHEN** a custom workflow's first step is `discuss` with command `myflow.discuss`
- **THEN** creating a spec dispatches `myflow.discuss`, not `speckit.specify`

### A project's own Companion steps appear in the pipeline where it placed them
<!-- touches: apps/vscode/src/features/workflows/projectSteps.ts, apps/vscode/src/features/workflows/pipelineResolution.ts -->

For a spec on the Companion workflow, each step the project added under `.specify/companion/nodes/<step>/` SHALL be inserted right after the shipped step it names (specify, plan, tasks or implement), dispatching `speckit.companion.<step>`. It SHALL get a document entry when it declares a file it writes and be action-only otherwise. A step with no placement, a malformed folder, or a name that collides with a shipped or lifecycle step SHALL be left out without an error. mark-complete stays last. SpecKit and custom workflows are never altered this way. Every surface SHALL get the pipeline from this one resolution, and an unreadable spec still resolves to the effective default instead of an empty pipeline.

#### Scenario: a review step after implement
- **WHEN** the project has `.specify/companion/nodes/review/` placed after `implement`
- **THEN** a Companion spec's pipeline reads specify, plan, tasks, implement, review, mark-complete

#### Scenario: a step named `plan`
- **WHEN** the project adds a folder that reuses a shipped name
- **THEN** the shipped plan step stands and nothing is added

## Uncovered

- Commit and pull-request checkpoints: a workflow may declare `checkpoints` that, after implement, ask for approval and then run `git add -A && git commit` and `gh pr create --fill` in a terminal, recording the outcome on the spec. The code is wired to the implement command, but the key is absent from the settings schema and from every user doc, and both built-in workflows ship with none. It is left out of the requirements until someone confirms it is a supported feature. See `_found-not-proposed.md`.
- The Auto run is one command handed to the assistant. What it does once dispatched belongs to the Companion command specs.
