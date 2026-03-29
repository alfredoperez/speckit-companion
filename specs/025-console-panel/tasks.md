# Tasks: Console Panel

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-26

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add console message types and ConsoleState — `src/features/spec-viewer/types.ts`
  - **Do**: Add `ConsoleState` type (`status: 'hidden' | 'running' | 'done' | 'error'`, `exitCode?: number`, `command?: string`). Add `consoleStarted`, `consoleOutput`, `consoleFinished` variants to `ExtensionToViewerMessage`. Add `toggleConsole` variant to `ViewerToExtensionMessage`.
  - **Verify**: `npm run compile` passes with no type errors

- [x] **T002** Add `buildCommand` to IAIProvider and implement in ClaudeCodeProvider *(depends on T001)* — `src/ai-providers/aiProvider.ts`, `src/ai-providers/claudeCodeProvider.ts`
  - **Do**: Add `buildCommand(prompt: string): { command: string; args: string[] }` to `IAIProvider` interface. Implement in `ClaudeCodeProvider` returning `{ command: 'claude', args: ['--permission-mode', 'bypassPermissions', prompt] }` (respecting existing `getPermissionFlag` logic). Add default throwing implementation to other providers (gemini, copilot, codex, qwen) that throws `Error('Console panel not supported for this provider')`.
  - **Verify**: `npm run compile` passes; all providers satisfy the interface

- [x] **T003** Create ProcessManager — `src/features/spec-viewer/processManager.ts` *(depends on T002)*
  - **Do**: Create `ProcessManager` class with: `execute(prompt: string, postMessage: fn)` that calls `aiProvider.buildCommand()` then `child_process.spawn`, streams stdout/stderr via batched `consoleOutput` messages (~100ms batching), sends `consoleStarted` on spawn and `consoleFinished` on exit. Add `kill()` method. Add `isRunning` getter. Add `confirmAndKill()` that shows `vscode.window.showWarningMessage` confirmation dialog before killing a running process. Strip ANSI codes from output before posting (`/\x1b\[[0-9;]*[a-zA-Z]/g`).
  - **Verify**: `npm run compile` passes

- [x] **T004** Integrate ProcessManager into SpecViewerProvider *(depends on T003)* — `src/features/spec-viewer/specViewerProvider.ts`
  - **Do**: Add `processManager: ProcessManager` to `PanelInstance` interface. Instantiate in `createPanel()` passing `panel.webview.postMessage`. In `panel.onDidDispose`, call `processManager.kill()`. Pass processManager into message handler deps.
  - **Verify**: `npm run compile` passes

- [x] **T005** Replace executeStepInTerminal with processManager *(depends on T004)* — `src/features/spec-viewer/messageHandlers.ts`
  - **Do**: Update `MessageHandlerDependencies` to include `processManager` (or a `executeInConsole` callback). Replace `executeStepInTerminal` function to use `processManager.execute()` instead of `getAIProvider().executeInTerminal()`. Apply same change in `handleClarify`. Handle `toggleConsole` message type in the switch statement (post a `consoleToggle` message back to webview or manage visibility state).
  - **Verify**: `npm run compile` passes; clicking Regen/Next spawns a child process instead of opening a terminal

- [x] **T006** Add console panel HTML skeleton — `src/features/spec-viewer/html/generator.ts` *(depends on T001)*
  - **Do**: Insert console panel HTML between `</main>` and `<footer>`: a `<div class="console-panel" id="console-panel" style="display:none">` with header (title, status badge, close button), and scrollable `<pre id="console-output">` body. Add `<button class="console-toggle" id="console-toggle">` with codicon terminal icon + ">_ Console" text to footer `actions-left` div.
  - **Verify**: Extension compiles; webview renders with console button visible in footer and panel hidden

- [x] **T007** Create console panel CSS — `webview/styles/spec-viewer/_console.css` *(depends on T006)*
  - **Do**: Create CSS partial with: `.console-panel` (flex column, border-top, min-height 100px, max-height 40vh), `.console-header` (flex row, padding, background), `.console-status-badge` variants (`.running` with pulse animation, `.done` green, `.error` red), `.console-output` (monospace font, overflow-y auto, padding, flex 1), `.console-toggle` button style matching existing footer buttons. Use VS Code CSS variables throughout.
  - **Verify**: Visual inspection — console panel has correct styling when toggled open

- [x] **T008** Import console CSS partial — `webview/styles/spec-viewer/index.css` *(depends on T007)*
  - **Do**: Add `@import '_console.css';` to the imports in index.css
  - **Verify**: `npm run compile` passes; styles load in webview

- [x] **T009** Create webview console module — `webview/src/spec-viewer/console.ts` *(depends on T006)*
  - **Do**: Export `initConsole()` that caches DOM refs (`console-panel`, `console-output`, `console-toggle`). Export `handleConsoleStarted(command)` — clears output, sets status to running, shows panel, appends command line. Export `handleConsoleOutput(data, stream)` — appends text to `<pre>`, enforces 10K line cap (trim from top), auto-scrolls if user is at bottom (check `scrollTop + clientHeight >= scrollHeight - 20`). Export `handleConsoleFinished(exitCode)` — updates status badge (done/error), appends exit summary line. Export `toggleConsole()` — toggles panel display. Wire close button click handler.
  - **Verify**: Manual test — click Regen, output streams in console panel, auto-scroll works

- [x] **T010** Wire console into webview entry point *(depends on T009)* — `webview/src/spec-viewer/index.ts`
  - **Do**: Import `initConsole`, `handleConsoleStarted`, `handleConsoleOutput`, `handleConsoleFinished`, `toggleConsole` from `./console`. Call `initConsole()` in DOMContentLoaded. Add cases for `consoleStarted`, `consoleOutput`, `consoleFinished` in the message listener. Wire `console-toggle` button click to `toggleConsole()`.
  - **Verify**: Full end-to-end test — click Regen, console opens, output streams, status badge updates on finish

---

## Phase 2: Quality (Parallel — launch agents in single message)

- [x] **T011** [P][A] Unit tests — `test-expert`
  - **Files**: `src/features/spec-viewer/__tests__/processManager.test.ts`
  - **Pattern**: Jest with `ts-jest`, BDD-style `describe`/`it` blocks, VS Code mock from `tests/__mocks__/vscode.ts`
  - **Reference**: `src/features/spec-viewer/__tests__/documentScanner.test.ts`

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T010 | [x] |
| Phase 2 | T011 | [x] |
