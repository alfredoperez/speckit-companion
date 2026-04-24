# Spec: Fix Codex Provider PowerShell Compatibility

**Slug**: 077-fix-codex-powershell | **Date**: 2026-04-24

## Summary

The Codex CLI provider builds terminal commands using Unix-only shell syntax (`codex exec - < "file"` input redirection and `sed ... | codex exec -` pipelines), which fails on Windows PowerShell with `ParserError: The '<' operator is reserved for future use.` This spec covers two fixes: making Codex command construction cross-shell so it works on PowerShell (matching the Claude provider's `"$(cat "…")"` pattern), and making the provider honor the `script` setting from the workspace's `init-options.json` so users who chose `"script": "ps"` get commands shaped for their shell.

## Requirements

- **R001** (MUST): On Windows PowerShell, invoking any SpecKit command through the Codex provider must execute without shell parser errors. No use of `<` input redirection in the command sent to the terminal.
- **R002** (MUST): All three Codex execution paths must be fixed: `executeInTerminal`, `executeHeadless`, and `executeSlashCommand` in `src/ai-providers/codexCliProvider.ts`. Both the known-skill path (currently `sed | codex exec -`) and the fallback path (currently `codex exec - < "$file"`) must produce shell-compatible commands.
- **R003** (MUST): When `.specify/init-options.json` in the workspace contains `"script": "ps"`, the Codex provider must emit PowerShell-shaped commands (e.g., `Get-Content` / `$(Get-Content …)` based substitution) instead of bash-shaped commands.
- **R004** (MUST): When `init-options.json` is missing, unreadable, or sets `"script": "sh"` (or anything non-`ps`), the Codex provider must keep its current bash-shaped behavior (after R001 adjustments), preserving Unix/macOS users.
- **R005** (MUST): The `IAIProvider` interface (or a shared helper in `src/ai-providers/aiProvider.ts`) must expose a mechanism for providers to read the workspace `init-options.json` so this logic can be reused by other providers later (Gemini, Copilot, Qwen, OpenCode) without duplicating file I/O.
- **R006** (SHOULD): Failure to read or parse `init-options.json` must be logged to the provider's output channel and fall back to the bash-shaped default — never surface a user-facing error.
- **R007** (SHOULD): The existing `$ARGUMENTS` substitution behavior for known SpecKit skills (today implemented via `sed`) must continue to work on both shells. On PowerShell, `sed` is not available by default — the PowerShell path must use a native mechanism (e.g., `(Get-Content path).Replace('$ARGUMENTS', '…')` piped into `codex exec -`, or read-then-write into a temp file with the substitution already applied).
- **R008** (MAY): Other providers that use bash-only patterns (`claudeCodeProvider` uses `"$(cat "…")"`) may be updated in a follow-up spec; they are not in scope here.

## Scenarios

### Windows user with PowerShell runs `/speckit.specify` via Codex

**When** a user on Windows with `"ai": "codex"` and `"script": "ps"` in `.specify/init-options.json` triggers any SpecKit command from the extension
**Then** the terminal executes a PowerShell-compatible command, Codex CLI receives the prompt content, and the run completes without the `ParserError: The '<' operator is reserved for future use.` error from the bug report.

### macOS/Linux user on bash/zsh runs `/speckit.specify` via Codex

**When** a user on macOS/Linux (no `init-options.json`, or `"script": "sh"`) triggers a SpecKit command via Codex
**Then** behavior is unchanged from today — the command still runs, `$ARGUMENTS` substitution still works, and temp-file cleanup still fires.

### Known SpecKit skill on PowerShell

**When** a user on PowerShell invokes a prompt whose first line matches `/speckit.<skill>` and a matching prompt file exists under `.codex/prompts/`
**Then** `$ARGUMENTS` is substituted without relying on `sed` (which is unavailable by default on Windows), and the substituted prompt is passed to `codex exec -` via a shell-native mechanism.

### Custom (non-skill) prompt on PowerShell

**When** a user invokes a custom prompt (no matching skill file) on PowerShell
**Then** the prompt is written to a temp file and read into `codex exec -` via PowerShell-compatible syntax (not `<` redirection), and the temp file is cleaned up after `Timing.tempFileCleanupDelay` as today.

### `init-options.json` missing or malformed

**When** the Codex provider is invoked and `.specify/init-options.json` does not exist, cannot be read, or is invalid JSON
**Then** the provider logs a single warning line to its output channel and proceeds using the bash-shaped default. No error dialog is shown to the user.

## Non-Functional Requirements

- **NFR001** (MUST): Reading `init-options.json` must not add noticeable latency to command dispatch. Cache the parsed value per provider instance (re-read only on explicit refresh) or read once per invocation — either is acceptable.
- **NFR002** (MUST): Do not log the full prompt content when logging init-options detection; logs must only include the detected `script` value and provider type.
- **NFR003** (SHOULD): The fix must be covered by at least one unit test per shell shape (`sh` and `ps`) exercising command-string construction for the `executeInTerminal` path, using the existing `src/ai-providers/__tests__/` pattern.

## Out of Scope

- Refactoring the Claude, Gemini, Copilot, Qwen, or OpenCode providers to read `init-options.json`. Only the Codex provider is updated in this spec; the shared helper introduced by R005 is available for future specs.
- Supporting shells other than bash-family (`sh`, `bash`, `zsh`) and PowerShell (`ps`). `cmd.exe`, fish, nushell, etc. are not targeted.
- Adding a VS Code setting to override `init-options.json`'s `script` value. The `init-options.json` file is the single source of truth for now.
- Changing how temp prompt files are created, named, or cleaned up (R007 reuses the existing `createTempFile` / `Timing.tempFileCleanupDelay` machinery).
- Fixing any issues in the `Antigravity` provider variant mentioned in the issue ("AI Provider: Codex CLI, Antigravity") — Antigravity is not a provider in the current codebase.
