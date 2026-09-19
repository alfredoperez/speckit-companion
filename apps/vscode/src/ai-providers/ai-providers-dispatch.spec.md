# Ai providers dispatch — Living Spec

<!-- reviewed: a9c0b02b -->

## Purpose

How a composed command reaches the user's AI assistant: a one-way hand-off, through a terminal CLI or a host chat the extension probes rather than assumes.

## Requirements

### Dispatch is one-way and unobservable
<!-- touches: apps/vscode/src/ai-providers/aiProvider.ts, apps/vscode/src/ai-providers/ideChatProvider.ts, apps/vscode/src/ai-providers/claudePanelProvider.ts -->

The extension hands text to the assistant and cannot see what happens next, so a dispatch returning is never proof the step ran. Completion is known only when the assistant writes spec context.

#### Scenario: a step is dispatched to a chat surface
- **WHEN** the provider routes to the host editor's chat or a GUI panel
- **THEN** the dispatch resolves without a terminal and without throwing

#### Scenario: the assistant ignores the instruction
- **WHEN** the assistant never acts on the dispatched text
- **THEN** the step is not shown as complete

### A missing CLI fails loudly with how to install it
<!-- touches: apps/vscode/src/ai-providers/cliTerminalProvider.ts -->

#### Scenario: the CLI is not installed
- **WHEN** a terminal CLI provider dispatches and its binary is absent
- **THEN** the dispatch fails with an error instead of sending text into the shell
- **AND** the error offers a copyable install command, or an "Open Install Page" link for download-based tools such as `agy`

### The prompt is never pasted into visible terminal scrollback
<!-- touches: apps/vscode/src/ai-providers/aiProvider.ts, apps/vscode/src/core/utils/shellDetection.ts -->

The prompt travels through a temp file the shell reads at invocation, using the substitution form of the detected shell family. A shell with no such substitution gets the prompt inlined with its own escaping.

#### Scenario: a long prompt on bash
- **WHEN** a multi-kilobyte prompt is dispatched to a CLI in bash
- **THEN** the terminal shows a short command line reading a temp file, not the prompt text

### A prompt too long for the shell is refused, never truncated
<!-- touches: apps/vscode/src/ai-providers/aiProvider.ts, apps/vscode/src/core/utils/shellDetection.ts -->

#### Scenario: a long prompt in cmd.exe
- **WHEN** the inlined command line would exceed cmd.exe's length limit
- **THEN** dispatch fails with a message naming the limit and suggesting PowerShell or Git Bash
- **AND** no truncated command is sent

### Dispatch targets are probed at dispatch time, not assumed
<!-- touches: apps/vscode/src/ai-providers/ideChatProvider.ts, apps/vscode/src/ai-providers/wibeyPanelProvider.ts -->

A host editor's chat or another extension's panel is found by checking which commands are registered at dispatch time, in a per-target preference order. When none resolves, the user gets an actionable message and nothing throws.

#### Scenario: the host editor exposes no chat command
- **WHEN** none of the candidate chat commands are registered
- **THEN** the user is told no built-in chat was found and to switch to a CLI provider
- **AND** in Antigravity the message names the Antigravity provider, which runs its `agy` CLI

### A host that drops the prompt gets it through the clipboard
<!-- touches: apps/vscode/src/ai-providers/ideChatProvider.ts -->

#### Scenario: dispatching to Windsurf
- **WHEN** a command is dispatched to a host whose chat discards the supplied query
- **THEN** the command is copied to the clipboard, the chat opens, and the user is told to paste and press Enter

### Commands are not auto-submitted into a surface that cannot resolve them
<!-- touches: apps/vscode/src/ai-providers/ideChatProvider.ts -->

#### Scenario: the workspace is not spec-kit initialized
- **WHEN** a SpecKit command is dispatched to a host chat with no spec-kit scaffolding for that editor
- **THEN** the chat opens with the command prefilled but not submitted
- **AND** the user is warned and offered Initialize SpecKit
