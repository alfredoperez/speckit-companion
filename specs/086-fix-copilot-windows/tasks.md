# Tasks: Fix Copilot Windows Shell Compatibility

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-27

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** Create `shellDetection` utility — `src/core/utils/shellDetection.ts` | R001, R002, NFR001
  - **Do**: Create the file with `export type Shell = 'bash' | 'powershell' | 'cmd' | 'unknown'`, `export function detectShell(): Shell` that inspects `vscode.env.shell` (lowercased basename) — `pwsh`/`powershell` → `'powershell'`, `cmd` → `'cmd'`, `bash`/`zsh`/`sh` → `'bash'`, else `'unknown'` (with a `process.platform === 'win32'` default of `'powershell'` when `vscode.env.shell` is empty), and `export function formatPromptFileSubstitution(shell: Shell, absPath: string): string` returning the inline expression that, when placed inside double quotes in a command line for that shell, expands to the file's contents — `bash`/`unknown` → `$(cat "${absPath}")`, `powershell` → `$(Get-Content -Raw '${absPath}')`, `cmd` → `''` (sentinel — caller must use embed fallback). Single quotes around the path on PowerShell to avoid `$` expansion in the path.
  - **Verify**: `npm run compile` succeeds. The new file exports `Shell`, `detectShell`, `formatPromptFileSubstitution`.
  - **Leverage**: `src/core/utils/pathUtils.ts` — same module style and use of `process.platform` defaults.

- [x] **T002** Add `buildPromptDispatchCommand` helper — `src/ai-providers/aiProvider.ts` | R001, R002, NFR001
  - **Do**: Add `export function buildPromptDispatchCommand(opts: { cliInvocation: string; flags: string; promptFilePath: string; promptText: string }): string` that calls `detectShell()` and: for `bash`/`powershell` returns `${cliInvocation} ${flags}"${formatPromptFileSubstitution(shell, promptFilePath)}"`; for `cmd` falls back to embedding `promptText` directly with cmd.exe escaping (`"` → `""`, leading/trailing whitespace trimmed) and throws a clear `Error` if the resulting line exceeds 8000 chars; for `unknown` defaults to bash form. Update `dispatchSlashCommandViaTempFile` to use the same helper for the `$(cat …)` template (preserve the special `slashCommand` prefix and the empty-prompt branch). Re-export `Shell`, `detectShell` from this module if needed by callers.
  - **Verify**: `npm run compile` passes. Existing call sites in `dispatchSlashCommandViaTempFile` produce the same string output for bash via a quick local check.
  - **Leverage**: existing `dispatchSlashCommandViaTempFile` block (lines 20–62) for the temp-file/cleanup pattern.
  - *(depends on T001)*

- [x] **T003** [P] Wire Copilot provider to helper — `src/ai-providers/copilotCliProvider.ts` | R001, R002, R007
  - **Do**: Replace the inline command construction at line 83 (`const command = \`${cliPath} ${permissionFlag}-p "$(cat "${promptFilePath}")"\`;`) and line 135 (the `commandLine` in `executeHeadless`) with `buildPromptDispatchCommand({ cliInvocation: cliPath, flags: \`${permissionFlag}-p \`, promptFilePath, promptText: cleanPrompt })`. Import the helper from `./aiProvider`.
  - **Verify**: `npm run compile` passes. Manual: on macOS bash, dispatching a Copilot workflow still produces a working command (regression check). On a Windows PowerShell terminal, the produced string contains `Get-Content -Raw` instead of `cat`.
  - *(depends on T002)*

- [x] **T004** [P] Wire Claude provider to helper — `src/ai-providers/claudeCodeProvider.ts` | R007
  - **Do**: Replace the four `$(cat "...")` occurrences (lines 87, 89, 147, 149 — both `executeInTerminal` and `executeHeadless`, including the `--append-system-prompt "$(cat "${systemPromptFilePath}")"` segment when present). For the prompt portion call `buildPromptDispatchCommand`. For the optional `--append-system-prompt` segment, also use `formatPromptFileSubstitution` directly so it works in PowerShell — emit `--append-system-prompt "${formatPromptFileSubstitution(shell, systemPromptFilePath)}" ` (with `cmd` falling back to a separate embed via the same fallback rules). Import helpers from `./aiProvider` and `../core/utils/shellDetection`.
  - **Verify**: `npm run compile` passes. Existing Claude jest tests in `__tests__/` still pass (`npm test`).
  - *(depends on T002)*

- [x] **T005** [P] Wire OpenCode provider to helper — `src/ai-providers/openCodeProvider.ts` | R007
  - **Do**: Replace lines 62 and 104 (`${cliPath} ${permissionFlag}-p "$(cat "${tempFilePath}")"`) with `buildPromptDispatchCommand({ cliInvocation: cliPath, flags: \`${permissionFlag}-p \`, promptFilePath: tempFilePath, promptText })`. Import the helper.
  - **Verify**: `npm run compile` passes; existing tests pass.
  - *(depends on T002)*

- [x] **T006** [P] Wire Qwen provider to helper — `src/ai-providers/qwenCliProvider.ts` | R007
  - **Do**: Replace lines 77 and 128 (`${cliPath} ${permissionFlag}-p "$(cat "${tempFilePath}")"`) with `buildPromptDispatchCommand`. Import the helper.
  - **Verify**: `npm run compile` passes; existing tests pass.
  - *(depends on T002)*

- [x] **T007** [P] Harden `getPermissionFlagForProvider` — `src/ai-providers/permissionValidation.ts` | R003, R004, R005
  - **Do**: Modify `getPermissionFlagForProvider(type)` so it returns `paths.autoApproveFlag` whenever `paths.autoApproveFlag !== ''` AND (`readPermissionMode() === 'auto-approve'` OR `paths.supportsInteractivePermissions === false`). Add a module-private `firedOverrideForProvider` set to fire a one-time `console.warn` (replaceable later with `outputChannel.appendLine` if a channel handle is plumbed through; for now a `console.warn` is enough to be visible in the Extension Host log). Keep the existing `validatePermissionMode` toast unchanged so the user still sees the startup warning. Update the JSDoc to describe the override.
  - **Verify**: `npm run compile` passes. Existing call sites in `copilotCliProvider.ts` (and any other provider using `getPermissionFlag()`) keep working unchanged.
  - **Leverage**: existing `PROVIDER_PATHS[type]` lookup pattern in the same file.

- [x] **T008** [P] Unit tests for `shellDetection` — `src/core/utils/__tests__/shellDetection.test.ts` | R001, R002
  - **Do**: Add a Jest spec with `describe('detectShell')` covering: `pwsh.exe`, `powershell.exe`, `bash`, `/bin/zsh`, `cmd.exe`, empty `vscode.env.shell` on Windows defaults to `'powershell'`, empty on darwin defaults to `'bash'`, and `'unknown'` for arbitrary paths. Add `describe('formatPromptFileSubstitution')` covering the bash, powershell, cmd, and unknown branches and verifying the PowerShell output uses single-quoted paths.
  - **Verify**: `npm test -- shellDetection` passes.
  - **Leverage**: `tests/__mocks__/vscode.ts` — extend the mock to allow setting `vscode.env.shell` per test (similar to `pathUtils.test.ts` setting `process.platform`).
  - *(depends on T001)*

- [x] **T009** [P] Unit tests for `buildPromptDispatchCommand` — `src/ai-providers/__tests__/promptCommand.test.ts` | R001, R002, NFR001
  - **Do**: Cover each shell branch — bash produces `cliInvocation flags"$(cat \"path\")"`, powershell produces `cliInvocation flags"$(Get-Content -Raw 'path')"`, cmd embeds the prompt with `"` doubled, and an over-long prompt on cmd throws. Also assert that `unknown` falls back to bash form.
  - **Verify**: `npm test -- promptCommand` passes.
  - *(depends on T002)*

- [x] **T010** [P] Unit tests for permission override — `src/ai-providers/__tests__/permissionValidation.test.ts` | R003, R004, R005
  - **Do**: Add (or extend) tests covering the matrix: interactive + Copilot → `'--yolo '`; interactive + Claude → `''`; interactive + Qwen → `''` (Qwen `supportsInteractivePermissions: true`); auto-approve + Copilot → `'--yolo '`. Mock `vscode.workspace.getConfiguration` to drive `permissionMode` and `PROVIDER_PATHS` is real (no mock).
  - **Verify**: `npm test -- permissionValidation` passes.
  - *(depends on T007)*

- [x] **T011** Update `package.json` config description — `package.json` | R005
  - **Do**: Update the `speckit.permissionMode` `description` field to: `"Controls how the AI CLI handles permission prompts. 'interactive' is honored only by providers whose CLI supports interactive prompting (Claude, Gemini, Codex, Qwen, OpenCode). Copilot does not support interactive prompting and is auto-switched to auto-approve at dispatch time, regardless of this setting."` (the description already mentions auto-switch in package.json — refine to make clear it's enforced at dispatch, not just at startup).
  - **Verify**: `npm run compile` passes. `code --install-extension` lifecycle works (visible to user via `/install-local`).
  - *(depends on T007)*

- [x] **T012** Update README.md for Windows + Copilot behavior — `README.md` | R005
  - **Do**: Find the `Configuration` section's `permissionMode` subsection and add a callout: "**Copilot on Windows**: Copilot's CLI cannot surface permission prompts in `-p` mode, so the extension auto-switches Copilot to auto-approve at dispatch even when this setting is `interactive`. This is enforced at runtime — dismissing the startup warning will not re-enable interactive mode for Copilot." Also add a "Windows shells" note under the Copilot row in "Supported AI Providers" (or under a Platform Support / Troubleshooting section if one exists): "Copilot's prompt dispatch detects PowerShell and Git Bash automatically; cmd.exe is supported on a best-effort basis (long prompts may exceed cmd's line-length limit)."
  - **Verify**: README renders without broken links. Per CLAUDE.md `Update docs on feature changes` rule.
  - *(depends on T007 and T003)*
