# Plan: Permission Mode Control

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-02

## Approach

Replace the three per-provider permission settings with a single `speckit.permissionMode` setting (default: `"default"`). Add a `getPermissionFlag(): string` method to the `IAIProvider` interface so each provider translates `"bypass"` into its own CLI flag. Remove the Claude-specific PermissionManager/PermissionWebview infrastructure since permission gating is no longer needed.

## Technical Context

**Stack**: TypeScript, VS Code Extension API
**Key Dependencies**: `vscode.workspace.getConfiguration` for reading settings
**Constraints**: Must not break providers that don't support bypass (Gemini, Codex) — they return empty string

## Files

### Create

_(none)_

### Modify

- `package.json` — Add `speckit.permissionMode` setting, remove `claudePermissionMode`, `copilotPermissionMode`, `qwenYoloMode`
- `src/ai-providers/aiProvider.ts` — Add `getPermissionFlag(): string` to `IAIProvider` interface
- `src/ai-providers/claudeCodeProvider.ts` — Read from `speckit.permissionMode`, map `"bypass"` → `--permission-mode bypassPermissions`. Remove static variant. Remove `ensurePermissions()` and PermissionManager import
- `src/ai-providers/copilotCliProvider.ts` — Read from `speckit.permissionMode`, map `"bypass"` → `--yolo`. Remove old `copilotPermissionMode` read
- `src/ai-providers/qwenCliProvider.ts` — Read from `speckit.permissionMode`, map `"bypass"` → `--yolo`. Remove old `qwenYoloMode` read
- `src/ai-providers/geminiCliProvider.ts` — Add no-op `getPermissionFlag()` returning `""`
- `src/ai-providers/codexCliProvider.ts` — Add no-op `getPermissionFlag()` returning `""`
- `src/extension.ts` — Remove PermissionManager instantiation and `initializePermissions()` call. Remove `getPermissionManager()` export
- `src/features/permission/permissionManager.ts` — Delete (or gut to empty if imports exist elsewhere)
- `src/features/permission/permissionWebview.ts` — Delete
- `src/features/permission/index.ts` — Update exports
- `README.md` — Document new unified `speckit.permissionMode` setting, remove per-provider permission docs

## Risks

- **Existing bypass users silently lose bypass**: Users who had `claudePermissionMode: bypassPermissions` will default to `"default"` after upgrade. **Mitigation**: This is the intended behavior per the issue. Document in CHANGELOG.
