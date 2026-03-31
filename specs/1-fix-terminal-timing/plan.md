# Plan: Fix Terminal Timing and Extension Host Cleanup

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-31

## Approach

Extract a shared `waitForShellReady` utility that uses VS Code's `window.onDidChangeTerminalShellIntegration` event to detect when a terminal's shell is ready before sending commands, replacing the fixed 800ms `setTimeout` across all AI providers. The `executeHeadless` method already polls `terminal.shellIntegration` but uses a less reliable `setInterval` approach — the new utility will use the proper VS Code event API. For extension host cleanup, audit `deactivate()` and ensure all subscriptions are pushed to `context.subscriptions` so VS Code disposes them automatically.

## Technical Context

**Stack**: TypeScript, VS Code Extension API (`@types/vscode ^1.84.0`)
**Key Dependencies**: `vscode.window.onDidChangeTerminalShellIntegration` (available since VS Code 1.93)
**Constraints**: Must fall back to `sendText` after timeout when shell integration is unavailable (some terminal types don't support it)

## Architecture

```mermaid
graph LR
  A[createTerminal] --> B[waitForShellReady]
  B -->|shellIntegration available| C[sendText]
  B -->|timeout fallback| C
```

## Files

### Create

- `src/core/utils/terminalUtils.ts` — shared `waitForShellReady(terminal, timeoutMs)` utility returning a Promise that resolves when `terminal.shellIntegration` is available or after timeout

### Modify

- `src/ai-providers/claudeCodeProvider.ts` — replace `setTimeout` + `sendText` in `executeInTerminal` and `executeSlashCommand` with `await waitForShellReady(terminal)`; update `executeHeadless` to use the same utility instead of `setInterval` polling
- `src/ai-providers/geminiCliProvider.ts` — replace `setTimeout` delays in `executeInTerminal` with `await waitForShellReady(terminal)`; keep the Gemini init delay as a separate concern (Gemini CLI startup time, not shell readiness)
- `src/ai-providers/copilotCliProvider.ts` — replace `setTimeout` + `sendText` in `executeInTerminal` with `await waitForShellReady(terminal)`
- `src/ai-providers/codexCliProvider.ts` — replace `setTimeout` + `sendText` in `executeInTerminal` and `executeSlashCommand` with `await waitForShellReady(terminal)`
- `src/ai-providers/qwenCliProvider.ts` — replace `setTimeout` + `sendText` in `executeInTerminal` with `await waitForShellReady(terminal)`
- `src/extension.ts` — push disposables (config change listeners, file watchers) to `context.subscriptions` to ensure clean disposal on deactivate
- `src/core/constants.ts` — remove `terminalVenvActivationDelay`, add `shellReadyTimeoutMs: 5000` constant
- `src/core/utils/configManager.ts` — remove `getTerminalDelay()` method
- `src/features/steering/steeringManager.ts` — replace `setTimeout` + `getTerminalDelay()` with `await waitForShellReady(terminal)`

## Testing Strategy

- **Unit**: Test `waitForShellReady` resolves immediately when `shellIntegration` is already set, resolves on event, and resolves on timeout fallback
- **Edge cases**: Multiple terminals opened rapidly (each gets independent promise); shell integration never fires (timeout path)

## Risks

- VS Code versions below 1.93 don't have `onDidChangeTerminalShellIntegration` — mitigate by checking if the event exists and falling back to the current timeout approach
- Gemini provider has a separate init delay concern (CLI startup) beyond shell readiness — keep that as a distinct `setTimeout` after shell is ready
