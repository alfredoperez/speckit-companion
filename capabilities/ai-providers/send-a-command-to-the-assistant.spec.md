# Send a Command to the Assistant — Living Spec

## Purpose

Every button that runs a step ends here: a command name and its arguments become something the chosen assistant actually executes, in a terminal, the editor's chat, or the Claude Code panel. Each assistant spells commands differently and accepts input differently. Get this wrong and the user sees a terminal that prints help text, a chat that does not recognize the command, or nothing at all.

## Requirements

### A command is spelled the way the provider registered it
<!-- touches: apps/vscode/src/ai-providers/aiProvider.ts, apps/vscode/src/ai-providers/ideChatProvider.ts -->

Commands are written once in dot form (`speckit.plan`). At dispatch the name SHALL be rewritten to the provider's form, dot or dash, with every dot in a `speckit.*` name becoming a hyphen for dash providers, and exactly one leading slash. `speckit.commandFormat` set to `dot` or `dash` SHALL override the provider's default. Commands outside the `speckit.` family and all arguments SHALL pass through untouched. Under IDE Chat the form follows the host editor: dash in Cursor and Antigravity, dot elsewhere.

#### Scenario: a namespaced command on a dash provider
- **WHEN** `speckit.companion.specify specs/012-login` is dispatched to Claude Code with `commandFormat` `auto`
- **THEN** the assistant receives `/speckit-companion-specify specs/012-login`, with the dots in the path intact

#### Scenario: the user forces dot form
- **WHEN** `speckit.commandFormat` is `dot` and the provider defaults to dash
- **THEN** the command goes out as `/speckit.plan`

### A terminal provider runs the command in a terminal beside the editor
<!-- touches: apps/vscode/src/ai-providers/cliTerminalProvider.ts, apps/vscode/src/ai-providers/claudeCodeProvider.ts, apps/vscode/src/ai-providers/geminiCliProvider.ts, apps/vscode/src/ai-providers/codexCliProvider.ts -->

For a CLI provider, dispatch SHALL open a new terminal in the second editor column at the workspace root, wait for the shell, and run the provider's CLI with the prompt. The prompt body SHALL travel through a temporary file that is deleted shortly afterwards, so long prompts never land in the scrollback. On `cmd.exe`, which cannot read a file into an argument, the prompt SHALL be inlined, and a prompt too long for one command line SHALL fail with a message telling the user to switch shells.

#### Scenario: a step is run with Qwen Code
- **WHEN** the user runs Plan with provider `qwen`
- **THEN** a terminal opens beside the editor and runs `qwen` against the prompt file, and the file is removed after the run starts

#### Scenario: a long prompt under cmd.exe
- **WHEN** the inlined line would exceed the shell's limit
- **THEN** nothing is sent and an error names PowerShell or Git Bash as the fix

### A missing CLI stops the dispatch and says how to get it
<!-- touches: apps/vscode/src/ai-providers/cliTerminalProvider.ts, apps/vscode/src/core/utils/installUtils.ts -->

Before a terminal provider dispatches, the extension SHALL check that its CLI answers. When it does not, no terminal SHALL open, and an error SHALL name the CLI with either an install command the user can copy or an install page to open. Claude Code is exempt from the check.

#### Scenario: Codex is selected but not installed
- **WHEN** a step is dispatched
- **THEN** an error offers **Copy Install Command** and no terminal is created

### Each CLI gets the prompt in a shape it can act on
<!-- touches: apps/vscode/src/ai-providers/copilotCliProvider.ts, apps/vscode/src/ai-providers/codexCliProvider.ts, apps/vscode/src/ai-providers/codexPromptResolver.ts, apps/vscode/src/ai-providers/geminiCliProvider.ts, apps/vscode/src/ai-providers/claudeCodeProvider.ts -->

Where a CLI cannot resolve a slash command from a one-shot prompt, dispatch SHALL still hand it something runnable. Copilot CLI receives the command without its slash. Codex receives the body of the command as spec-kit installed it for Codex, with the arguments already substituted, or a plain instruction to run the command when no such body is found. Gemini is started interactively and the command is typed into it. Claude Code keeps the slash command on its own command line so it resolves the command itself.

#### Scenario: Codex and an installed command
- **WHEN** `/speckit.plan specs/012-login` is dispatched to Codex and spec-kit's Codex command for plan exists in the workspace
- **THEN** Codex is piped that command's text with `specs/012-login` in place of its arguments placeholder

#### Scenario: Codex and an unknown command
- **WHEN** no installed body matches the command
- **THEN** Codex is piped a short instruction naming the command, and the run still starts

### IDE Chat sends the command to the editor's own chat
<!-- touches: apps/vscode/src/ai-providers/ideChatProvider.ts, apps/vscode/src/speckit/detector.ts -->

With provider `ide-chat`, dispatch SHALL open the host editor's built-in chat with the command, and open no terminal. The command SHALL be submitted where the host allows it and spec-kit is initialized in the workspace, and otherwise only prefilled with a warning offering **Initialize SpecKit**, since the chat would not recognize the command. A host whose chat drops the prefilled text (Windsurf) SHALL get the command on the clipboard with a note to paste it. When the editor has no chat to open, a warning SHALL suggest a CLI provider, or the Antigravity provider inside Antigravity. No failure on this path may surface as an unhandled error.

#### Scenario: Copilot Chat in an initialized workspace
- **WHEN** Plan is run in VS Code with `ide-chat` and `.specify/` present
- **THEN** Copilot Chat opens and `/speckit.plan <spec name>` is submitted

#### Scenario: the workspace was never initialized
- **WHEN** the same step is run with no spec-kit scaffolding
- **THEN** the chat opens with the command typed but not sent, and a warning offers to initialize

### Claude in VS Code prefills the Claude Code panel and the user presses Enter
<!-- touches: apps/vscode/src/ai-providers/claudePanelProvider.ts -->

With provider `claude-vscode`, dispatch SHALL open the Claude Code panel with the command in its input box, and open no terminal. The panel cannot be submitted from outside, so the user runs it. When the Claude Code extension is not installed, a warning SHALL say so and suggest the terminal `claude` provider. The tracking instructions that ride along with a step SHALL still reach the panel, carried as a mention of a prompt file the extension writes into the workspace's `.claude/` folder and overwrites on every dispatch.

#### Scenario: a step with tracking instructions
- **WHEN** Implement is run with `claude-vscode`
- **THEN** the panel input shows the slash command followed by an `@` mention of the prompt file, waiting for Enter

#### Scenario: the panel extension is missing
- **WHEN** the Claude Code extension is not installed
- **THEN** nothing opens and a warning names the extension and the `claude` alternative

### What a person reads in a chat box is cleaned, and what an assistant cannot open is inlined
<!-- touches: apps/vscode/src/ai-providers/promptBuilder.ts, apps/vscode/src/ai-providers/openCodeProvider.ts -->

A new spec's description is staged in a file outside the workspace. For the chat and panel providers, a `specify` command pointing at that file SHALL be rewritten to carry the description itself without the bookkeeping appended below it, and any other spec path argument SHALL be shortened to the spec's folder name. Free text arguments SHALL be left alone. For OpenCode, which refuses to read outside the project, the whole file content SHALL be inlined into the prompt instead.

#### Scenario: creating a spec through IDE Chat
- **WHEN** the create form dispatches `specify <staged file>`
- **THEN** the chat receives `/speckit.specify` followed by the description the user typed

#### Scenario: running Plan from the viewer through the panel
- **WHEN** the argument is an absolute path to `specs/012-login`
- **THEN** the panel shows `/speckit-plan 012-login`

### A step carries tracking instructions unless the user turns them off
<!-- touches: apps/vscode/src/ai-providers/promptBuilder.ts, apps/vscode/src/ai-providers/promptPreamble.ts, apps/vscode/src/ai-providers/claudeCodeProvider.ts -->

A dispatched pipeline step SHALL be prefixed with a marked block telling the assistant how to keep the spec's `.spec-context.json` current, using the recording script bundled with the extension so it works without the Companion Spec Kit extension. A `speckit.companion.*` command SHALL get only a short block, because its own body carries the protocol. A command that is not a known step, and any command at all when `speckit.aiContextInstructions` is `false`, SHALL go out bare. Claude Code SHALL receive the block as appended system prompt rather than as part of the message, and IDE Chat SHALL drop it.

#### Scenario: the setting is off
- **WHEN** Plan is dispatched with `speckit.aiContextInstructions` `false`
- **THEN** the assistant receives only `/speckit.plan` and its argument

#### Scenario: Claude Code
- **WHEN** Plan is dispatched to Claude Code with the setting on
- **THEN** the message is the slash command alone and the block arrives as system prompt

### Dispatch is one way, and only the run record says a step finished
<!-- touches: apps/vscode/src/ai-providers/aiProvider.ts, apps/vscode/src/ai-providers/ideChatProvider.ts, apps/vscode/src/ai-providers/claudePanelProvider.ts -->

A dispatch that succeeds SHALL mean only that the assistant was handed the command, never that the step ran, finished or succeeded. Nothing SHALL be read back from the terminal, the chat or the panel. A step SHALL be treated as finished only once its completion has been written into the spec's run record.

#### Scenario: the chat never runs the command
- **WHEN** the command is submitted to the editor's chat and the assistant ignores it
- **THEN** the extension reports nothing further and the step stays where the run record left it

### Who closes a step depends on whether Companion is installed
<!-- touches: apps/vscode/src/ai-providers/promptPreamble.ts -->

Without the Companion Spec Kit extension the assistant SHALL be told to close the step it just ran itself, and SHALL be told explicitly not to close implement, which the extension closes once every task is checked. With Companion installed the extension SHALL stamp each step's start and completion, and the assistant SHALL be told to close only clarify and analyze, which neither pipeline stamps.

#### Scenario: a standard plan step
- **WHEN** Plan is dispatched in a project without the Companion extension
- **THEN** the assistant is told to record plan's completion, so the spec does not stick at planning

#### Scenario: the same step under Companion
- **WHEN** Plan is dispatched with the Companion extension installed
- **THEN** the assistant is told not to close plan, and the extension records its completion instead

## Uncovered

- What the tracking block tells the assistant to write, and the shape of `.spec-context.json`, belong to the spec-context capture area.
- A workflow step's `model` and `effort` are passed to Claude Code as launch flags and ignored by every other provider. Nothing here says what happens when the value is not a plain token beyond it being dropped.
- Background (headless) dispatch exists on every provider and degrades to the interactive path for chat and panel. No user-facing feature was found that depends on its result.
