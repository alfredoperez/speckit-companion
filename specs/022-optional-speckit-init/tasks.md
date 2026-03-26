# Tasks: Optional SpecKit Initialization

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-26

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Remove `speckit.detected` gates from package.json — `package.json`
  - **Do**: Replace the 3 conditional spec explorer welcome views (`!speckit.cliInstalled`, `cliInstalled && !detected`, `detected`) with a single unconditional view: `"contents": "Build features with specs\n\n[$(plus) Create New Spec](command:speckit.create)"`. Remove `"when": "speckit.detected"` from all `commandPalette` entries except `speckit.constitution`. Remove `&& speckit.detected` from the `speckit.create` menu entry in `view/title`. Remove `"when": "speckit.detected"` from the `cmd+shift+n` keybinding.
  - **Verify**: `npm run compile` passes. Open extension in a workspace without `.specify/` — spec explorer shows "Create New Spec" button, all commands appear in command palette.

- [x] **T002** Remove init guard from `speckit.create` command *(depends on T001)* — `src/features/specs/specCommands.ts`
  - **Do**: In the `speckit.create` handler (lines 29–45), remove the `if (!specKitDetector.workspaceInitialized)` block (lines 32–41) so the command always runs `vscode.commands.executeCommand('speckit.openSpecEditor')`.
  - **Verify**: `npm run compile` passes. Running `speckit.create` in a workspace without SpecKit opens the spec editor.

- [x] **T003** Remove init guard from `createSpec()` *(depends on T002)* — `src/speckit/detector.ts`
  - **Do**: In `createSpec()` (lines 274–299), remove the `if (!this._isInitialized)` guard block (lines 275–284) so the method proceeds directly to the input box.
  - **Verify**: `npm run compile` passes.

- [x] **T004** Make activation popups non-blocking *(depends on T003)* — `src/extension.ts`
  - **Do**: On line 57, change `await showInitSuggestion(context)` to `showInitSuggestion(context)` (fire-and-forget, no await). On line 62, change `await showConstitutionSetupSuggestion()` to `showConstitutionSetupSuggestion()` (fire-and-forget). This ensures activation is never blocked by popups.
  - **Verify**: `npm run compile` passes. Extension activates instantly regardless of SpecKit state.

---

## Phase 2: Quality (Parallel — launch agents in single message)

- [x] **T005** [P][A] Unit tests — `test-expert`
  - **Files**: `tests/specCommands.spec.ts`, `tests/detector.spec.ts`
  - **Pattern**: Jest with `describe`/`it` blocks, VS Code mock from `tests/__mocks__/vscode.ts`
  - **Reference**: Existing test files in `tests/`

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T004 | [ ] |
| Phase 2 | T005 | [ ] |
