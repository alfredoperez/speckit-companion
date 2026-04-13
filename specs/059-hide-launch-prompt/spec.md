# Spec: Hide Launch Prompt

**Slug**: 059-hide-launch-prompt | **Date**: 2026-04-13

## Summary

When launching AI CLI commands (slash commands with appended tracking instructions, custom commands, etc.), the full prompt text — including the `.spec-context.json` status-tracking boilerplate — is currently visible in the terminal. Route all command launches through a temp `.md` file and invoke via `"$(cat <file>)"` so only a short command line is visible to the user.

## Requirements

- **R001** (MUST): `executeSlashCommand` (all AI providers) writes the command text to a temp `.md` file and sends `<cli> "$(cat "<tempfile>")"` to the terminal, mirroring the pattern already used by `executeInTerminal` / `executeHeadless`.
- **R002** (MUST): Temp files are cleaned up after the command is dispatched, using the same `Timing.tempFileCleanupDelay` pattern as `claudeCodeProvider.executeInTerminal`.
- **R003** (MUST): Behavior applies uniformly across all five providers: Claude Code, Gemini CLI, Copilot CLI, Codex CLI, Qwen CLI.
- **R004** (MUST): The `autoExecute` flag is preserved — when `false`, the command line is shown in the terminal without being auto-submitted, so the user can review and press Enter.
- **R005** (SHOULD): Custom commands dispatched via `registerCustomCommand` (`specCommands.ts:351`) inherit the hidden-prompt behavior with no call-site changes.
- **R006** (MAY): Reuse existing `createTempFile` util (`src/core/utils/tempFileUtils.ts`) rather than introducing a new helper.

## Scenarios

### Slash command with tracking prompt appended

**When** the user runs a skill like `/sdd:specify <description>` where the skill template appends multi-paragraph `.spec-context.json` update instructions to the command args
**Then** the terminal shows only a short `claude "$(cat "/tmp/speckit-prompt-xxx.md")"` line; the full prompt contents stay in the temp file and are piped to the CLI invisibly

### Short slash command with no appended content

**When** the user runs a simple slash command (e.g. `/clear`)
**Then** the command still works — written to a temp file and invoked via `$(cat …)` — no special-casing for length

### autoExecute = false

**When** a custom command has `autoExecute: false`
**Then** the `claude "$(cat …)"` line is typed into the terminal but not submitted; the user reviews and presses Enter to run

### Temp file cleanup

**When** a slash command has been dispatched
**Then** the temp `.md` file is deleted after `Timing.tempFileCleanupDelay`, with cleanup failures logged to the output channel (not surfaced to the user)

## Non-Functional Requirements

- **NFR001** (MUST): No regression in shell-integration wait behavior — `waitForShellReady` is still awaited before `sendText`.
- **NFR002** (SHOULD): Works in fallback mode (no shell integration) — temp file approach is shell-agnostic since it uses standard POSIX `$(cat …)` syntax.

## Out of Scope

- Changing `executeInTerminal` / `executeHeadless` (already use temp files).
- Changing the permission setup terminal flow (`createPermissionTerminal`).
- Windows/PowerShell-specific quoting (existing providers already assume POSIX shells).
- Redesigning the skill templates to stop appending tracking prompts — the temp-file approach makes that unnecessary.
