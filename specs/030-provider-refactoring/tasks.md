# Tasks: Provider Refactoring — Reduce Duplication

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-01

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Create shared `createTempFile` utility — `src/core/utils/tempFileUtils.ts` | R002
  - **Do**: Create `src/core/utils/tempFileUtils.ts` with a `createTempFile(context, content, prefix, convertWSL?)` function. Takes `vscode.ExtensionContext`, file content string, filename prefix, and optional `convertWSL` boolean (default false). Creates file in `context.globalStorageUri`, optionally applies `convertPathIfWSL()`. Return the file path.
  - **Verify**: `npm run compile` passes; function signature matches all 5 existing usages
  - **Leverage**: `src/ai-providers/claudeCodeProvider.ts:64-72` (WSL variant), `src/ai-providers/copilotCliProvider.ts:67-75` (non-WSL variant)

- [x] **T002** Create shared `ensureCliInstalled` utility — `src/core/utils/installUtils.ts` | R005
  - **Do**: Create `src/core/utils/installUtils.ts` with `ensureCliInstalled(cliName, installCommand, checkCommand, outputChannel)`. Show error modal with "Install" action, copy install command to clipboard on click. Return boolean (true = installed). Match the pattern from existing `ensureInstalled` methods.
  - **Verify**: `npm run compile` passes
  - **Leverage**: `src/ai-providers/geminiCliProvider.ts:77-90` (canonical pattern used by 4 providers)

- [x] **T003** Add `executeCommandInHiddenTerminal` to terminalUtils — `src/core/utils/terminalUtils.ts` | R001, R003, R004
  - **Do**: Add `ExecuteInHiddenTerminalOptions` interface (fields: `commandLine, cwd, terminalName, outputChannel, logPrefix, cleanupFn?, tempFilePath?, logCommandOnFailure?`) and `executeCommandInHiddenTerminal(options)` function. Implement shell integration path (use `shellIntegration.executeCommand`, listen to `onDidEndTerminalShellExecution`, extract exit code) and fallback path (`sendText`, resolve after timeout). Call `cleanupFn` if provided. Delete `tempFilePath` if provided. Log command on failure only when `logCommandOnFailure` is true.
  - **Verify**: `npm run compile` passes; function handles both shell integration and fallback paths
  - **Leverage**: `src/ai-providers/claudeCodeProvider.ts:137-202` (shell integration + fallback pattern with command logging), `src/ai-providers/codexCliProvider.ts:173-254` (conditional cleanup pattern)

- [x] **T004** Refactor ClaudeCodeProvider to use shared utilities *(depends on T001, T003)* — `src/ai-providers/claudeCodeProvider.ts` | R003, R004
  - **Do**: Replace `createTempFile` method (lines 64-72) with call to shared `createTempFile(context, content, 'claude-prompt', true)`. Replace `executeHeadless` body (lines 137-202) with call to `executeCommandInHiddenTerminal({...opts, logCommandOnFailure: true})`. Keep `ensurePermissions` as-is (unique to Claude). Retain all provider-specific command construction logic.
  - **Verify**: `npm run compile` passes; manual test: run a Claude prompt headlessly and verify output/cleanup

- [x] **T005** Refactor GeminiCliProvider to use shared utilities *(depends on T001, T002, T003)* — `src/ai-providers/geminiCliProvider.ts` | R003, R004
  - **Do**: Replace `createTempFile` (lines 64-72) with `createTempFile(context, content, 'gemini-prompt', false)`. Replace `ensureInstalled` (lines 77-90) with `ensureCliInstalled(...)`. Replace `executeHeadless` body (lines 140-203) with `executeCommandInHiddenTerminal({...opts, logCommandOnFailure: false})`. Keep Gemini-specific init delay and interactive mode logic untouched.
  - **Verify**: `npm run compile` passes

- [x] **T006** Refactor CopilotCliProvider to use shared utilities *(depends on T001, T002, T003)* — `src/ai-providers/copilotCliProvider.ts` | R003, R004
  - **Do**: Replace `createTempFile` (lines 67-75) with `createTempFile(context, content, 'copilot-prompt', false)`. Replace `ensureInstalled` (lines 80-93) with `ensureCliInstalled(...)`. Replace `executeHeadless` body (lines 143-208) with `executeCommandInHiddenTerminal({...opts, logCommandOnFailure: false})`.
  - **Verify**: `npm run compile` passes

- [x] **T007** Refactor CodexCliProvider to use shared utilities *(depends on T001, T002, T003)* — `src/ai-providers/codexCliProvider.ts` | R003, R004
  - **Do**: Replace `createTempFile` (lines 45-53) with `createTempFile(context, content, 'codex-prompt', true)`. Replace `ensureInstalled` (lines 91-104) with `ensureCliInstalled(...)`. Replace `executeHeadless` body (lines 173-254) with `executeCommandInHiddenTerminal({...opts, logCommandOnFailure: true, cleanupFn: conditionalCleanup})`. Preserve conditional temp file cleanup logic via `cleanupFn` callback.
  - **Verify**: `npm run compile` passes

- [x] **T008** Refactor QwenCliProvider to use shared utilities *(depends on T001, T002, T003)* — `src/ai-providers/qwenCliProvider.ts` | R003, R004
  - **Do**: Replace `createTempFile` (lines 61-69) with `createTempFile(context, content, 'qwen-prompt', true)`. Replace `ensureInstalled` (lines 74-87) with `ensureCliInstalled(...)`. Replace `executeHeadless` body (lines 138-204) with `executeCommandInHiddenTerminal({...opts, logCommandOnFailure: true})`.
  - **Verify**: `npm run compile` passes

---

## Phase 2: Quality (Parallel — launch agents in single message)

- [x] **T009** [P][A] Unit tests for shared utilities — `test-expert` | R001, R002, R005
  - **Files**: `src/core/utils/__tests__/tempFileUtils.test.ts`, `src/core/utils/__tests__/installUtils.test.ts`, `src/core/utils/__tests__/terminalUtils.test.ts`
  - **Pattern**: Jest with `describe`/`it` BDD style, VS Code mock from `tests/__mocks__/vscode.ts`
  - **Reference**: `src/core/utils/__tests__/terminalUtils.test.ts` (existing tests for `waitForShellReady`)
  - **Cover**: `createTempFile` with/without WSL conversion; `ensureCliInstalled` success/failure modal; `executeCommandInHiddenTerminal` shell integration path, fallback path, conditional cleanup, command logging on failure

---

## Progress

- Phase 1: T001–T008 [x]
- Phase 2: T009 [x]
