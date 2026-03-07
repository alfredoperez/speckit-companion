# Tasks: Reduce Noisy Notifications

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-06

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add `showStatusBarMessage` helper — `src/core/utils/notificationUtils.ts`
  - **Do**: Add `static showStatusBarMessage(text: string, timeoutMs = 3000): void` that calls `vscode.window.setStatusBarMessage(text, timeoutMs)`
  - **Verify**: TypeScript compiles; method is exported from `NotificationUtils`

- [x] **T002** Replace "Refining line..." popup *(depends on T001)* — `src/features/spec-viewer/messageHandlers.ts`
  - **Do**: At line 257, replace `vscode.window.showInformationMessage(\`Refining line ${lineNum}...\`)` with `NotificationUtils.showStatusBarMessage(\`Refining line ${lineNum}...\`)`; add import if not already present
  - **Verify**: No `showInformationMessage` call remains in `handleRefineLine`

- [x] **T003** Replace "copied to clipboard" popups in AI providers *(depends on T001)* — `src/ai-providers/`
  - **Do**: In each of `copilotCliProvider.ts:90`, `codexCliProvider.ts:115`, `geminiCliProvider.ts:90`, `qwenCliProvider.ts:97` replace `vscode.window.showInformationMessage('Install command copied to clipboard')` with `NotificationUtils.showStatusBarMessage('$(check) Install command copied to clipboard')`; add import in each file
  - **Verify**: All 4 files compile; no `showInformationMessage` calls remain at those lines

- [x] **T004** Replace "No custom commands" popup with quick pick placeholder *(no dependencies)* — `src/features/specs/specCommands.ts`
  - **Do**: Remove lines 277–280 (the `if (customCommands.length === 0)` early-return block); add `placeHolder: 'No custom commands configured — add speckit.customCommands in settings'` to the existing `showQuickPick` options object (so the picker opens with the placeholder when empty)
  - **Verify**: When no custom commands are set, quick pick opens (then closes immediately) instead of showing a popup; `npm run compile` passes

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T004 | [x] |
