# Tasks: Fix Terminal Timing and Extension Host Cleanup

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-31

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Update timing constants — `src/core/constants.ts` | R002, R005
  - **Do**: Remove `terminalVenvActivationDelay` from `Timing`. Add `shellReadyTimeoutMs: 5000` constant.
  - **Verify**: `npm run compile` passes with no errors

- [x] **T002** Create waitForShellReady utility *(depends on T001)* — `src/core/utils/terminalUtils.ts` | R001, R002
  - **Do**: Create `waitForShellReady(terminal: vscode.Terminal, timeoutMs?: number): Promise<void>`. Check `terminal.shellIntegration` first (resolve immediately if set). Otherwise listen to `vscode.window.onDidChangeTerminalShellIntegration` for the matching terminal. If the event API doesn't exist (old VS Code), or timeout fires first, resolve anyway (fallback). Dispose the event listener on resolve.
  - **Verify**: `npm run compile` passes
  - **Leverage**: `src/ai-providers/claudeCodeProvider.ts:165-217` (existing `setInterval` polling pattern in `executeHeadless` — replace with event-based approach)

- [x] **T003** Remove getTerminalDelay *(depends on T001)* — `src/core/utils/configManager.ts` | R005
  - **Do**: Remove the `getTerminalDelay()` method. Remove the `Timing` import if no longer used.
  - **Verify**: `npm run compile` — expect errors in providers (fixed in T004–T007)

- [x] **T004** Update ClaudeCodeProvider *(depends on T002, T003)* — `src/ai-providers/claudeCodeProvider.ts` | R001, R002, R004
  - **Do**: Import `waitForShellReady`. In `executeInTerminal`: replace `setTimeout`/`getTerminalDelay()` with `await waitForShellReady(terminal)` then `terminal.sendText(command, true)`. Same for `executeSlashCommand`. In `executeHeadless`: replace `setInterval` polling loop with `await waitForShellReady(terminal)` then `terminal.shellIntegration.executeCommand(commandLine)`, keeping the fallback to `sendText` if `shellIntegration` is still null after wait.
  - **Verify**: `npm run compile` passes
  - **Leverage**: `src/core/utils/terminalUtils.ts` (new utility from T002)

- [x] **T005** Update remaining AI providers *(depends on T002, T003)* — `src/ai-providers/` | R004
  - **Do**: In each of `geminiCliProvider.ts`, `copilotCliProvider.ts`, `codexCliProvider.ts`, `qwenCliProvider.ts`: import `waitForShellReady`, replace `setTimeout`/`getTerminalDelay()` in `executeInTerminal` with `await waitForShellReady(terminal)` then `sendText`. For Gemini, keep the `initDelay` setTimeout *after* shell is ready (it's for CLI startup, not shell readiness). Update `executeHeadless` in each to use `waitForShellReady` instead of `setInterval` polling.
  - **Verify**: `npm run compile` passes

- [x] **T006** Update steeringManager *(depends on T002, T003)* — `src/features/steering/steeringManager.ts` | R004
  - **Do**: Import `waitForShellReady`. Replace `setTimeout`/`getTerminalDelay()` with `await waitForShellReady(terminal)` then `sendText`.
  - **Verify**: `npm run compile` passes

- [x] **T007** Fix extension host cleanup *(depends on T001)* — `src/extension.ts` | R003
  - **Do**: Audit `activate()` for disposables not pushed to `context.subscriptions`. Push config change listeners and any loose event subscriptions to `context.subscriptions`. Verify `deactivate()` only handles resources not already in subscriptions.
  - **Verify**: `npm run compile` passes; no "closing extension host" warnings on window close

---

## Phase 2: Quality (Parallel — launch agents in single message)

- [x] **T008** [P][A] Unit tests — `test-expert` | R001, R002
  - **Files**: `src/core/utils/__tests__/terminalUtils.test.ts`
  - **Pattern**: Jest with `ts-jest`, BDD-style `describe`/`it`. Mock `vscode` via `tests/__mocks__/vscode.ts`.
  - **Reference**: `src/features/specs/specCommands.test.ts`
  - **Cases**: (1) resolves immediately when `shellIntegration` already set, (2) resolves when `onDidChangeTerminalShellIntegration` fires, (3) resolves on timeout when event never fires, (4) disposes listener after resolving

- [x] **T009** [P][A] Update docs — `docs-expert`
  - **Files**: `README.md`
  - **Do**: If README mentions terminal delay or timing configuration, update to reflect that shell integration is now used automatically. No new section needed — just accuracy.
  - **Verify**: No stale references to terminal delay settings

---

## Progress

- Phase 1: T001–T007 [x]
- Phase 2: T008–T009 [x]
