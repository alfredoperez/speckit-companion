# Speckit CLI Detection — Living Spec

## Purpose

Finds the SpecKit CLI and the projects it scaffolded, and drives it through a visible terminal for the user's configured assistant. A missing or failing CLI degrades the extension instead of breaking activation.

## Requirements

### A missing or broken CLI degrades the extension, never the host
<!-- touches: src/speckit/detector.ts -->

Detection SHALL resolve to a plain yes or no, never an error, and an absent, outdated or failing CLI MUST leave the extension activated and usable. Before concluding the CLI is absent, a second, differently shaped probe runs.

#### Scenario: the CLI is not installed
- **WHEN** detection runs on a machine without it
- **THEN** the extension activates, and the affordances that need the CLI offer an install route instead of failing

#### Scenario: the CLI is on the path but the first probe fails
- **WHEN** the path lookup errors
- **THEN** running the CLI's help decides the answer

### Detection distinguishes "the tool exists" from "this project uses it"
<!-- touches: src/speckit/detector.ts -->

Whether the CLI is installed and whether the workspace was scaffolded by it SHALL be separate answers driving separate affordances.

#### Scenario: an initialized workspace on a machine without the CLI
- **WHEN** detection runs
- **THEN** the workspace reads as initialized while the CLI reads as absent

#### Scenario: the workspace was scaffolded for a chat-based assistant
- **WHEN** the canonical scaffolding directory is absent
- **THEN** the workspace still reads as initialized from the per-assistant command files the CLI wrote

### A written constitution is never flagged as unfinished
<!-- touches: src/speckit/detector.ts -->

The placeholder check SHALL run only on an initialized workspace and read only the constitution's body, ignoring comments. The CLI leaves a comment listing the placeholders it replaced, and reading it would keep flagging a constitution the user already wrote.

#### Scenario: a finished constitution still names its placeholders in a comment
- **WHEN** the placeholder check runs
- **THEN** the constitution reads as set up

### The extension drives the CLI through a visible terminal, never silently
<!-- touches: src/speckit/cliCommands.ts, src/speckit/detector.ts -->

Install, initialize and upgrade SHALL run in a named terminal the user can see, because they are long, may prompt and may fail. The extension MUST NOT claim they succeeded: it offers a reload for the user to take once they judge it done.

#### Scenario: the user triggers an upgrade
- **WHEN** the action runs
- **THEN** a named terminal shows the command and its output, and a reload is offered instead of a success message

### A folder's path never reaches the command text
<!-- touches: src/speckit/detector.ts, src/speckit/specKitExtensionInstall.ts -->

A terminal that runs a CLI command in the workspace SHALL open in that folder rather than change into it by pasting the path into the command, because a folder name can hold shell syntax.

#### Scenario: the workspace folder's name contains `$(…)`
- **WHEN** Initialize, Upgrade Project, Upgrade All or the companion install runs
- **THEN** the terminal opens in the folder and the command text never contains its path

### Re-scaffolding targets the assistant the user actually configured
<!-- touches: src/speckit/specKitAgent.ts, src/speckit/cliCommands.ts -->

The assistant passed to the CLI SHALL come from the configured provider, and for the IDE-chat provider from the detected host editor. Every shipped provider MUST have its own entry, and only an unknown value falls back to a default the CLI accepts.

#### Scenario: the workspace is upgraded under the IDE-chat provider in Cursor
- **WHEN** the upgrade command is built
- **THEN** it targets Cursor's agent, and an unknown host falls back to Copilot

#### Scenario: an unknown provider value is configured
- **WHEN** the upgrade command is built
- **THEN** it targets Claude, a value the CLI accepts

## Uncovered

_None. Every file in the area was read._
