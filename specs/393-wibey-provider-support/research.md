# Research: Wibey Provider Support

**Branch**: `393-wibey-provider-support` | **Date**: 2026-07-09

## Open Question 1: Wibey CLI — binary name and invocation

**Decision**: Binary is `wibey`, invoked with `-p` flag for non-interactive dispatch.

**Findings**:
- Binary installed globally as `wibey` via `curl -sSL https://wibey.walmart.com/cli/setup | bash`
- Headless mode: `wibey -p "prompt text"` — single-shot, non-interactive
- Interactive mode: `wibey` (full TUI)
- The default `CliTerminalProvider.cliPromptFlag()` returns `'-p '` — exact match for Wibey CLI

**Rationale**: Because `cliPromptFlag()` already returns `-p `, `WibeyCliProvider` can extend `CliTerminalProvider` with zero method overrides. The base class dispatches: `wibey -p "$(cat /tmp/prompt.md)"`.

**Alternatives considered**: Implementing a custom `prepareDispatch` that mirrors `ClaudeCodeProvider` (with `--append-system-prompt` support). Deferred to Phase 2 — needs verification that Wibey CLI accepts `--append-system-prompt`.

**References**:
- [Wibey CLI README](https://gecgithub01.walmart.com/genaica/wibey-cli/blob/main/README.md)
- [HEADLESS_MODE.md](https://gecgithub01.walmart.com/genaica/wibey-cli/blob/main/docs/HEADLESS_MODE.md)

---

## Open Question 2: Wibey VS Code URI handler / prompt injection

**Decision**: No public prompt-injection API exists in v1.0.19. `wibey-vscode` provider implementation is **deferred to Phase 2**.

**Findings** (verified from actual `genaica/wibey-vscode-extension` source code):
- `package.json` `contributes.commands` lists 21 commands; no `sendPrompt`, no URI scheme (`contributes.uriSchemes` is empty)
- `extension.ts`: `wibey.openChat` → `vscode.commands.executeCommand('wibey.chatView.focus')` (focuses panel, no text)
- `extension.ts`: `wibey.addSelectionToChat` → posts `{type: 'addCodeSelection', selection: {path, content, language, lineRange}}` to the webview. This adds a **code snippet context reference** (like pressing Cmd+L), NOT command text in the input area
- No `setInput`, `prefillInput`, or similar webview message type found in chatPanel.ts handlers
- `ClaudeCodeProvider` works because `anthropic.claude-code` registers a URI handler; Wibey does not

**Required for Phase 2**: InnerSource contribution to `genaica/wibey-vscode-extension` adding:
```typescript
vscode.commands.registerCommand('wibey.sendPrompt', async (text: string) => {
    await vscode.commands.executeCommand('wibey.chatView.focus');
    chatPanel.getWebviewController().postMessage({ type: 'prefillInput', text });
});
```
Plus webview handler for `prefillInput` to set the chat input value.

**References**:
- `genaica/wibey-vscode-extension` `src/extension.ts` lines 1460–1935
- `genaica/wibey-vscode-extension` `src/chatPanel.ts`

---

## Open Question 3: Wibey CLI auto-approve flag

**Decision**: `autoApproveFlag: ''` — no CLI flag exists. Permission mode is controlled via `~/.wibey/settings.json`.

**Findings**:
- Wibey CLI uses a 3-tier permission system (READ → WRITE → YOLO) toggled interactively via SHIFT+TAB or `/config`
- Programmatic auto-approve is `bypassPermissions: true` in `~/.wibey/settings.json`, not a CLI flag
- There is no `--dangerously-skip-permissions` or equivalent CLI flag
- This matches the behavior of `gemini`, `qwen`, and `opencode` providers (also `autoApproveFlag: ''`)
- `permissionValidation.ts` only prepends a flag if `autoApproveFlag` is non-empty and mode is `auto-approve` — so `''` is a safe no-op

**Rationale**: Setting `autoApproveFlag: ''` means `speckit.permissionMode = 'auto-approve'` has no visible effect for Wibey CLI (same as Gemini/OpenCode). This is correct behavior since Wibey manages permissions through its own settings, not CLI flags.

**References**:
- [agent-sdk-permissions.md](https://gecgithub01.walmart.com/genaica/wibey-cli/blob/main/docs/agent-sdk-permissions.md)
- [permission-modes.md](https://gecgithub01.walmart.com/genaica/wibey-cli/blob/main/docs/internal/permission-modes.md)

---

## Open Question 4: Wibey CLI command format (dot vs dash)

**Decision**: `commandFormat: 'dash'` — Wibey CLI uses kebab-case slash commands (`/speckit-specify`).

**Findings**:
- Wibey CLI slash commands use `/command-name` format (kebab-case with slash prefix)
- Examples from source: `/flux-commit`, `/response-style`, `/add-dir`, `/sample-prompts`
- No dot notation (`/command.name`) is used anywhere in the CLI command registry
- This matches `claude` and `codex` providers (also `commandFormat: 'dash'`)
- SpecKit slash commands in dash format: `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`

**References**:
- [commands.ts — SLASH_PANEL_COMMANDS & CORE_COMMAND_NAMES](https://gecgithub01.walmart.com/genaica/wibey-cli/blob/main/src/constants/commands.ts)

---

## Pending verification (during implementation)

1. **`steeringFile` name**: `WIBEY.md` is assumed (fits the naming pattern CLAUDE.md, GEMINI.md, QWEN.md). Wibey CLI is built on Claude Agent SDK and may also read `CLAUDE.md`. Verify by checking what file `wibey` scans at startup.
2. **`--append-system-prompt` support**: Wibey CLI is built on Claude Agent SDK which supports this flag. Assumed supported but not confirmed from docs. If supported, `WibeyCliProvider` should override `prepareDispatch` like `ClaudeCodeProvider` for proper context-preamble separation.
3. **`wibey --version`** command: `CliTerminalProvider.isInstalled()` calls `<binary> --version`. Confirm Wibey CLI supports this flag.
