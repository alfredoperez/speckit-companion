# Plan: Fix Copilot Windows Shell Compatibility

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-27

## Approach

Fix the two Windows-only failures with minimal-surface changes. For bug 1, introduce a small shell-detection helper and a shared command-line builder that emits `$(cat "...")` for bash-family shells, `$(Get-Content -Raw '...')` for PowerShell (5.1 and 7+), and an embedded-prompt fallback for cmd.exe — then route all four bash-only providers (Copilot, Claude, OpenCode, Qwen) through it. For bug 2, harden `getPermissionFlagForProvider` so it always returns the auto-approve flag when the provider's `supportsInteractivePermissions` is `false`, regardless of the configured `permissionMode`, with a one-time output-channel notice so the user understands the override.

## Technical Context

**Stack**: TypeScript 5.3 (ES2022, strict), VS Code Extension API `^1.84.0`, Webpack 5, Jest + ts-jest.
**Key Dependencies**: none new.
**Constraints**: Must run in Node 18 (VS Code's bundled runtime). Must not require new VS Code API beyond the current `engines.vscode` floor (NFR002). Must preserve prompt-scrollback hiding for shells that support file substitution (NFR001).

## Files

### Create

- `src/core/utils/shellDetection.ts` — `detectShell(): 'bash' | 'powershell' | 'cmd' | 'unknown'` based on `vscode.env.shell` + `process.platform`. Also exports `formatPromptFileSubstitution(shell, absPath): string` returning the shell-correct inline expression that, when quoted in a command line, evaluates to the file's content.
- `src/core/utils/__tests__/shellDetection.test.ts` — unit tests covering: pwsh.exe, powershell.exe, bash, zsh, cmd.exe, empty/undefined `vscode.env.shell`, Windows vs. macOS/Linux defaults, and the substitution-formatter output for each shell.
- `src/ai-providers/__tests__/promptCommand.test.ts` — unit tests for the new shared `buildPromptDispatchCommand` helper covering each shell branch and the cmd.exe embed-fallback escaping.

### Modify

- `src/ai-providers/aiProvider.ts` — add exported `buildPromptDispatchCommand({ cliInvocation, flags, promptFilePath, promptText })` that picks the shell, returns the right command line, and uses the embed fallback when no temp-file substitution is possible. Update `dispatchSlashCommandViaTempFile` to call this helper instead of the inline `$(cat "...")` template.
- `src/ai-providers/copilotCliProvider.ts` — replace the two `${permissionFlag}-p "$(cat "${promptFilePath}")"` lines (lines 83 and 135) with calls to `buildPromptDispatchCommand`.
- `src/ai-providers/claudeCodeProvider.ts` — same swap for the four `$(cat "...")` occurrences (lines 87, 89, 147, 149). Per R007 — uniform application of the fix.
- `src/ai-providers/openCodeProvider.ts` — same swap for lines 62 and 104.
- `src/ai-providers/qwenCliProvider.ts` — same swap for lines 77 and 128.
- `src/ai-providers/permissionValidation.ts` — update `getPermissionFlagForProvider` so it returns the provider's `autoApproveFlag` whenever (a) `permissionMode === 'auto-approve'` OR (b) `supportsInteractivePermissions === false` and `autoApproveFlag` is non-empty. Add a one-time `outputChannel`-style notice (or `vscode.window.showInformationMessage` with a "Don't show again" memento) the first time the override fires, so the user knows their `interactive` setting was bypassed for that provider.
- `src/ai-providers/__tests__/permissionValidation.test.ts` — extend (or create) tests covering: interactive + Copilot → returns `--yolo `; auto-approve + Copilot → returns `--yolo `; interactive + Claude → returns `''`; interactive + Codex → returns `''`. (Same coverage for Qwen since it also has `supportsInteractivePermissions: true` — should NOT be force-overridden.)
- `package.json` — update the `speckit.permissionMode` description to make the new behavior explicit: "Copilot is auto-switched to auto-approve at dispatch time because its CLI cannot surface prompts in `-p` mode." (No default change — `interactive` remains the default for providers that support it.)
- `README.md` — update the relevant section under "Configuration" → `permissionMode` to document the Copilot override (per the project's `Update docs on feature changes` rule). Cross-reference the issue.

## Data Model

No persisted data changes. The only new in-memory concept is the `Shell` discriminated union (`'bash' | 'powershell' | 'cmd' | 'unknown'`) returned by `detectShell()`.

## Testing Strategy

- **Unit (Jest)**:
  - `shellDetection.test.ts` — drive `vscode.env.shell` via the existing `tests/__mocks__/vscode.ts` mock; assert detection and substitution output for each shell.
  - `promptCommand.test.ts` — assert the command string for each shell variant and that the cmd.exe fallback embeds the prompt with `"` doubled and `%` escaped to `%%`.
  - `permissionValidation.test.ts` — assert override matrix above.
- **Manual smoke (must do before tag)**:
  1. macOS bash/zsh — Copilot workflow still runs (regression check, scenario "Bash / Git Bash regression").
  2. Windows PowerShell 5.1 — Copilot workflow runs without `too many arguments` (scenario "PowerShell terminal on Windows"). User to verify since CI does not run on Windows.
  3. Windows PowerShell + Copilot + `permissionMode: "interactive"` — workflow does not hang; output channel shows the one-time override notice (scenario "Default permission mode with Copilot").
- **Edge cases from spec**: dismissed validation warning still produces working dispatch; headless mode behaves identically to visible-terminal mode; non-Copilot providers unchanged.

## Risks

- **PowerShell version**: `Get-Content -Raw` requires PS 3.0+. Windows 10 ships PS 5.1, so the realistic install base is fine; PS 2.0 is essentially extinct. No mitigation needed beyond noting it in the README.
- **cmd.exe embed-fallback path is hard to verify in CI**: cmd.exe is rare as a VS Code default on modern Windows. Treat it as best-effort with unit tests on the escaper, and surface a clear runtime error if the embed length exceeds cmd.exe's 8191-char line limit.
- **Forcing auto-approve when user chose interactive may surprise users**: Mitigate with the one-time output-channel notice and keep the existing `validatePermissionMode` startup toast in place. The override is bounded — it only fires for providers that truly cannot honor `interactive`.
- **Touching three providers for R007**: increases blast radius. Mitigation — the change is mechanical (call same helper), and unit tests for the helper cover the shared behavior, so per-provider risk is low.
