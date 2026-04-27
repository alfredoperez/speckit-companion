# Spec: Fix Copilot Windows Shell Compatibility

**Slug**: 086-fix-copilot-windows | **Date**: 2026-04-27

## Summary

Fix two related Windows-only failures with the GitHub Copilot CLI provider: (1) the bash-only `$(cat "...")` prompt-dispatch syntax breaks in PowerShell (the VS Code default Windows shell), causing copilot to reject the call with `too many arguments`; and (2) the default `permissionMode: "interactive"` combined with `copilot -p` causes the terminal to hang silently because Copilot has no way to surface a permission prompt in scripted mode. Both bugs make the extension unusable on Windows out of the box without manual workarounds.

## Requirements

- **R001** (MUST): Copilot CLI prompt dispatch must succeed when the active VS Code integrated terminal is PowerShell (5.1 or 7+) on Windows. The full prompt content must reach `copilot -p` as a single argument, regardless of shell.
- **R002** (MUST): Copilot CLI prompt dispatch must continue to succeed in bash, zsh, and Git Bash on macOS, Linux, and Windows. The fix for R001 must not regress non-PowerShell shells.
- **R003** (MUST): When the configured provider's `supportsInteractivePermissions` is `false` and the resolved `permissionMode` is `"interactive"`, the extension must not dispatch a workflow that will hang silently. Either the provider's auto-approve flag is forced for that invocation, or the dispatch is blocked with a visible error explaining the mismatch and how to fix it.
- **R004** (MUST): The fix for R003 must apply to both visible-terminal dispatch (`executeInTerminal`) and headless dispatch (`executeHeadless`).
- **R005** (SHOULD): The existing one-time warning toast in `validatePermissionMode` should be replaced or supplemented so users cannot silently dismiss the warning into a broken state. A user who proceeds with the bad combo must either get auto-corrected behavior or a clear refusal at dispatch time — not silence.
- **R006** (SHOULD): The default value of `speckit.permissionMode` (currently `"interactive"`) should remain valid for providers that support interactive prompts. The fix should not force all users onto auto-approve globally; it should only resolve the bad combo for affected providers.
- **R007** (MAY): The same shell-agnostic prompt-dispatch mechanism may be applied to the other CLI providers that currently use `$(cat "...")` (Claude, OpenCode, Qwen) so the fix is uniform across the codebase, even though the bug report only names Copilot.

## Scenarios

### Bug 1 — PowerShell terminal on Windows

**When** a Windows user with the VS Code default PowerShell integrated terminal triggers a SpecKit workflow with the Copilot provider configured
**Then** the `copilot` CLI receives the full prompt as a single `-p` argument, runs the workflow, and produces output in the terminal — no `too many arguments` error appears

### Bug 1 — Bash / Git Bash regression check

**When** a user (any platform) with a bash, zsh, or Git Bash integrated terminal triggers a SpecKit workflow with the Copilot provider
**Then** the prompt is delivered correctly and the workflow runs as it did before the fix

### Bug 2 — Default permission mode with Copilot

**When** a user installs the extension fresh, selects Copilot as the provider, leaves `speckit.permissionMode` at its default (`"interactive"`), and triggers a workflow
**Then** the extension does not produce a silently-hanging terminal — it either runs the workflow with auto-approve applied for that invocation, or it surfaces a blocking error message that names the setting to change

### Bug 2 — User dismisses the validation warning

**When** the existing `validatePermissionMode` toast appears and the user clicks "Keep Interactive" for Copilot
**Then** subsequent workflow dispatches still do not silently hang — the dispatch path enforces the fix at runtime regardless of the dismissed warning

### Headless background mode

**When** a SpecKit feature invokes `executeHeadless` on the Copilot provider on Windows with PowerShell
**Then** the hidden background terminal completes the command without the PowerShell-arg-splitting error and without the silent-hang permission failure

### Other providers unaffected

**When** a user with Claude, Gemini, Codex, Qwen, or OpenCode triggers a workflow on macOS or Linux
**Then** no behavior change is observable — `permissionMode: "interactive"` continues to work for providers whose CLIs support interactive prompts

## Non-Functional Requirements

- **NFR001** (MUST): The shell-agnostic prompt-dispatch must not write the prompt content to terminal scrollback in plain view. The current temp-file pattern hides prompt bodies from scrollback; the fix must preserve that property where feasible.
- **NFR002** (SHOULD): The fix should not require a new VS Code API version beyond the current `engines.vscode` floor (`^1.84.0`).

## Out of Scope

- Refactoring the `validatePermissionMode` toast UX beyond what R005 requires (e.g., redesigning the warning copy, adding "don't ask again" semantics).
- Changing the default `speckit.permissionMode` globally for non-Copilot providers.
- Adding new Windows-specific telemetry or diagnostics surfaces.
- Bug fixes for unrelated PowerShell/Windows issues with other providers if they do not share the same `$(cat "...")` root cause (R007 is opt-in if uniform application is straightforward).
- Detecting or migrating users away from PowerShell as their default shell.
