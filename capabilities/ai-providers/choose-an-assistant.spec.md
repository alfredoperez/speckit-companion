# Choose an Assistant — Living Spec

## Purpose

The extension never runs an AI itself. It hands work to the assistant the user already has, so everything else depends on knowing which one that is and how much freedom it gets. Without this, every dispatch would guess at a CLI that may not exist or skip permission prompts the user wanted.

## Requirements

### A provider is chosen before the extension does anything
<!-- touches: apps/vscode/src/ai-providers/aiProvider.ts, apps/vscode/src/extension.ts -->

When `speckit.aiProvider` has never been set at any scope, activation SHALL ask the user to pick one from the full provider list and save the choice to user settings. The extension SHALL NOT finish activating without a choice.

#### Scenario: first run
- **WHEN** the extension activates and `speckit.aiProvider` is unset everywhere
- **THEN** a picker lists every supported provider with a one-line description of what it supports, and the pick is saved globally

#### Scenario: the picker is dismissed
- **WHEN** the user closes the picker without choosing
- **THEN** activation stops and an error says a provider is required

### A stored provider the extension no longer knows falls back to Claude Code
<!-- touches: apps/vscode/src/ai-providers/aiProvider.ts, apps/vscode/src/ai-providers/aiProviderFactory.ts -->

A `speckit.aiProvider` value that matches no supported provider SHALL be treated as Claude Code everywhere the provider is read. It SHALL NOT stop activation or any dispatch.

#### Scenario: a provider id was renamed in a later release
- **WHEN** settings still hold the old id
- **THEN** the extension activates and dispatches through Claude Code

### Switching provider takes effect after a reload
<!-- touches: apps/vscode/src/extension.ts, apps/vscode/src/ai-providers/aiProviderFactory.ts -->

When `speckit.aiProvider` changes, the extension SHALL tell the user a window reload is needed and offer to do it.

#### Scenario: the setting is edited mid-session
- **WHEN** the user changes `speckit.aiProvider`
- **THEN** a message offers **Reload Now**, and dispatch keeps using the previous provider until the reload

### Permission mode decides whether the CLI is told to skip its prompts
<!-- touches: apps/vscode/src/ai-providers/permissionValidation.ts, apps/vscode/src/ai-providers/aiProvider.ts -->

With `speckit.permissionMode` set to `auto-approve`, a provider that has a skip-prompts flag SHALL be launched with it. With `interactive`, the flag SHALL be left off. Providers with no such flag ignore the setting, and the editor chat and panel providers never take one.

#### Scenario: auto-approve with Claude Code
- **WHEN** a step is dispatched with `permissionMode` `auto-approve` and provider `claude`
- **THEN** the CLI is launched with its bypass-permissions flag

#### Scenario: auto-approve with Gemini
- **WHEN** the same dispatch happens with provider `gemini`
- **THEN** the command line carries no permission flag

### A CLI that cannot show permission prompts is always auto-approved
<!-- touches: apps/vscode/src/ai-providers/permissionValidation.ts -->

A provider whose scripted mode cannot surface a permission prompt (GitHub Copilot CLI today) SHALL be launched with its skip-prompts flag even when the mode is `interactive`, because the terminal would otherwise hang on a prompt nobody can see. The extension SHALL warn about the mismatch at startup and whenever the provider or mode changes, offer to switch the setting to `auto-approve`, and stop warning about that provider and mode pair once the user chooses to keep it.

#### Scenario: Copilot with interactive mode
- **WHEN** provider is `copilot` and mode is `interactive`
- **THEN** dispatch still passes `--yolo`, and a warning offers **Switch to Auto-Approve** or **Keep Interactive**

#### Scenario: the user keeps interactive
- **WHEN** they choose **Keep Interactive**
- **THEN** the warning does not return for that pair, and dispatch keeps auto-approving

### The IDE Chat provider is named after the editor it runs in
<!-- touches: apps/vscode/src/ai-providers/aiProvider.ts, apps/vscode/src/core/utils/hostIde.ts -->

Wherever the provider's name is shown, `ide-chat` SHALL read as the host editor's chat product: GitHub Copilot in VS Code, Cursor Chat in Cursor, Windsurf Chat in Windsurf, and plain IDE Chat anywhere else.

#### Scenario: the picker in Cursor
- **WHEN** the provider picker opens inside Cursor
- **THEN** the IDE Chat row is labelled Cursor Chat

## Uncovered

- The provider matrix (steering file, agents, hooks, MCP paths per provider) is read by the steering, agents and hooks views. It is declared beside the provider list but what those views do with it is not specified here.
