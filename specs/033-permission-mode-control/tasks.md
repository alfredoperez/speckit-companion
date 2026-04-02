# Tasks: Permission Mode Control

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-02

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add unified permissionMode setting — `package.json` | R001, R006, R008
  - **Do**: Add `speckit.permissionMode` with enum `["default", "bypass"]`, default `"default"`, clear description. Remove `speckit.claudePermissionMode`, `speckit.copilotPermissionMode`, `speckit.qwenYoloMode` entries.
  - **Verify**: `npm run compile` passes

- [x] **T002** Add getPermissionFlag to IAIProvider — `src/ai-providers/aiProvider.ts` | R001
  - **Do**: Add `getPermissionFlag(): string` to the `IAIProvider` interface. Add a shared helper `readPermissionMode(): 'default' | 'bypass'` that reads `speckit.permissionMode`.
  - **Verify**: `npm run compile` passes

- [x] **T003** Update Claude provider — `src/ai-providers/claudeCodeProvider.ts` | R002, R007
  - **Do**: Rewrite `getPermissionFlag()` to use shared `readPermissionMode()`, map `"bypass"` → `'--permission-mode bypassPermissions '`. Remove `getPermissionFlagStatic()`. Remove `ensurePermissions()` method and `getPermissionManager` import. Update `createPermissionTerminal()` to not use static permission flag.
  - **Verify**: `npm run compile` passes
  - **Leverage**: Existing `getPermissionFlag()` pattern

- [x] **T004** Update Copilot provider — `src/ai-providers/copilotCliProvider.ts` | R003
  - **Do**: Rewrite `getPermissionFlag()` to use shared `readPermissionMode()`, map `"bypass"` → `'--yolo '`. Remove old `copilotPermissionMode` read.
  - **Verify**: `npm run compile` passes

- [x] **T005** Update Qwen provider — `src/ai-providers/qwenCliProvider.ts` | R004
  - **Do**: Replace `getYoloMode()` with `getPermissionFlag()` using shared `readPermissionMode()`, map `"bypass"` → `'--yolo'`. Update all call sites from `yoloFlag` to `permissionFlag`.
  - **Verify**: `npm run compile` passes

- [x] **T006** Add no-op getPermissionFlag to Gemini and Codex — `src/ai-providers/geminiCliProvider.ts`, `src/ai-providers/codexCliProvider.ts` | R005
  - **Do**: Add `getPermissionFlag(): string { return ''; }` to both providers to satisfy the interface.
  - **Verify**: `npm run compile` passes

- [x] **T007** Remove PermissionManager infrastructure — `src/extension.ts`, `src/features/permission/` | R007
  - **Do**: In `extension.ts`, remove `PermissionManager` import, `permissionManager` variable, `getPermissionManager()` export, and `initializePermissions()` call. Delete `permissionManager.ts` and `permissionWebview.ts`. Update `index.ts` exports.
  - **Verify**: `npm run compile` passes. Extension activates without permission dialog.

- [x] **T008** Update README — `README.md` | R008
  - **Do**: Document `speckit.permissionMode` setting with both options. Remove any per-provider permission mode docs.
  - **Verify**: README renders correctly

---

## Progress

- Phase 1: T001–T008 [x]
