# Use the Spec Board in the Copilot App — Living Spec

## Purpose

In the GitHub Copilot app, SpecKit Companion opens as a canvas beside the chat. It is how someone working there sees every spec, where each one stands, and runs the next step without leaving the conversation. It has to show the same pipeline VS Code shows and send the same commands, or a spec would read one way in one tool and run another way in the other.

## Requirements

### The board lists every spec and stays current
<!-- touches: apps/copilot-canvas/specs-core.mjs, apps/copilot-canvas/tasks.mjs, apps/copilot-canvas/overview.mjs, apps/copilot-canvas/server.mjs, apps/copilot-canvas/public/** -->

The board SHALL list every spec folder under the workspace's spec directories, most recently active first. Each row SHALL show the spec's status, its four-step rail (specify, plan, tasks, implement) and its task progress. The list SHALL filter by Active, Done or All and search by name or number. While the board is open it SHALL watch the spec folders and update a row, or the open spec, when a file changes, without a refresh.

#### Scenario: the agent ticks a task
- **WHEN** the agent checks off a task in `tasks.md` while the board is open
- **THEN** that spec's progress updates on the board without a refresh

### Opening the board starts nothing
<!-- touches: apps/copilot-canvas/extension.mjs, apps/copilot-canvas/prompts.mjs -->

Opening the canvas SHALL never start work. The instruction to stop after opening SHALL be carried in the rule added to the session, in the canvas description and in the result of opening it, and SHALL leave a message that begins with a `/speckit` command alone, so a run the person asked for still runs.

#### Scenario: someone only asks to open it
- **WHEN** the person asks the agent to open the SpecKit Companion canvas
- **THEN** the board opens and the agent waits for the next instruction without reading, testing or implementing any spec

### A run button sends the same command VS Code sends
<!-- touches: apps/copilot-canvas/prompts.mjs, apps/copilot-canvas/server.mjs -->

A button on a spec SHALL send the chat line VS Code's sidebar dispatches for that step, such as `/speckit.companion.plan specs/042-export-csv`, followed by the same lifecycle preamble so the run records itself in `.spec-context.json`. When the Companion extension is not installed in the workspace, the buttons SHALL send the stock `/speckit.plan`, `/speckit.tasks` and `/speckit.implement` and SHALL offer none of the Companion-only commands. The board SHALL say which command set it is using.

#### Scenario: Plan on a stock workspace
- **WHEN** the person presses Plan in a workspace without the Companion extension
- **THEN** `/speckit.plan` for that spec is sent to the chat

### New spec offers the three workflows, and says why one is unavailable
<!-- touches: apps/copilot-canvas/prompts.mjs, apps/copilot-canvas/server.mjs, apps/copilot-canvas/public/** -->

**New spec** SHALL offer Companion, Spec Kit and Auto, the way VS Code's create-spec dialog does. Companion sends `/speckit.companion.specify`, Spec Kit sends `/speckit.specify`, and Auto sends `/speckit.companion.auto`, which runs every step without pausing. Companion SHALL be the pre-selected choice when its extension is installed. In a workspace without it, Companion and Auto SHALL be disabled with the reason shown, only Spec Kit SHALL be selectable, and a request for either SHALL be refused. A blank description SHALL not be sent.

#### Scenario: a stock workspace
- **WHEN** someone opens New spec in a workspace without the Companion extension
- **THEN** Companion and Auto are greyed out with the reason, and Spec Kit is selected

### The board only reads
<!-- touches: apps/copilot-canvas/server.mjs, apps/copilot-canvas/specs-core.mjs -->

The board SHALL NOT write `.spec-context.json` or any spec file. Every change to a spec SHALL come from a command it sends to the chat.

#### Scenario: browsing every spec
- **WHEN** someone opens each spec and tab on the board
- **THEN** no file in the workspace changes

## Uncovered

- The agent actions (`list_specs`, `get_spec`, `focus_spec`, `run_step`, `refresh`) that let the agent drive the board are not specified here.
