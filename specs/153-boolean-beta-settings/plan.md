# Implementation Plan: Collapse Beta Tri-State Settings to Boolean On/Off

## Summary

Convert three tri-state (`off`/`beta`/`on`) settings to plain booleans in `package.json`, drop the two in-UI beta badges, and add a one-time activation migration plus a defensive boolean coercion shared by every reader. The crux is migration correctness: every reader must read a boolean, and a user's persisted legacy string (`beta`/`on` → `true`, `off` → `false`) must produce the same effective on/off state it had before, preserving config scope.

## Technical Context

- **Language/version**: TypeScript (VS Code extension, `tsc -p ./`), Preact webview, Jest tests.
- **Primary dependencies**: `vscode` API (`workspace.getConfiguration`, `inspect`, `update`, `ConfigurationTarget`), Preact.
- **Storage**: VS Code settings (`settings.json`) at global/workspace/folder scope.
- **Testing**: Jest (`npm test`). The migration/coercion gets a unit test with a mocked config.
- **Target platform**: VS Code extension host + webview.
- **Constraints**: Zero effective on/off flip for existing users; no tri-state enum left; "opt-in beta" wording retained in descriptions.

## Approach & Structure

Order of attack, organized by file:

1. **`src/core/settingsMigration.ts` (new)** — `coerceLegacyBoolean(value, default): boolean` (the defensive reader helper: `true`/`false` pass through; `'beta'`/`'on'` → `true`; `'off'` → `false`; anything else → default) and `migrateBetaTriStateSettings(): Promise<void>` that, for each of the three keys, `inspect()`s per scope (global/workspace/folder), and where the persisted value is a legacy string, `update()`s it to the coerced boolean at that same scope. Idempotent — skips values already boolean/undefined.
2. **`src/extension.ts`** — call `migrateBetaTriStateSettings()` early in `activate()` (before the readers run / providers build).
3. **`package.json`** — change the three settings to `"type": "boolean"`, `"default": true`, remove `enum`/`enumDescriptions`, keep "opt-in beta" wording in each `description`.
4. **`src/speckit/specKitExtensionInstall.ts`** — `readInstallPromptMode()` → `readInstallPrompt(): boolean` via `coerceLegacyBoolean(get('companion.installPrompt'), true)`; `shouldShowInstallPrompt(enabled: boolean, installed: boolean)` returns `enabled && !installed`. Update both call sites in `specEditorProvider.ts` and `specViewerProvider.ts`.
5. **`src/features/spec-editor/specEditorProvider.ts`** — `buildTurboWorkflowEntry()` reads boolean via `coerceLegacyBoolean`; gate on `!enabled` → undefined; drop the `(beta)` label suffix and the `beta` field on the synthetic `WorkflowDefinition`.
6. **`src/features/spec-viewer/specViewerProvider.ts`** — `readActivityPanelMode()` → `readActivityPanelEnabled(): boolean` (default `true`); update its two call sites; thread a boolean `activityPanelEnabled` through `buildViewerPayload` and the initial HTML.
7. **`src/features/spec-viewer/html/generator.ts`** + **`src/features/spec-viewer/types.ts`** + **`webview/src/spec-viewer/types.ts`** — change `activityPanelMode?: 'off'|'beta'|'on'` to `activityPanelEnabled?: boolean`.
8. **`webview/src/spec-viewer/components/NavigationBar.tsx`** — read `ns.activityPanelEnabled ?? true`; render toggle when truthy; remove the `<span class="activity-toggle__beta">beta</span>`.
9. **`webview/styles/spec-viewer/_activity.css`** — remove the now-unused `.activity-toggle__beta` rule.
10. **Drop `beta` from `WorkflowDefinition`** in `src/features/spec-editor/types.ts` + `webview/src/spec-editor/types.ts` (it's set but never read for rendering).
11. **`src/core/settingsMigration.test.ts` (new)** — unit-test `coerceLegacyBoolean` for `"beta"→true`, `"on"→true`, `"off"→false`, `true→true`, `false→false`, junk→default; and test `migrateBetaTriStateSettings` with a mocked `getConfiguration`/`inspect`/`update` asserting legacy strings get rewritten at the correct scope and booleans are left alone.

**Decisions:**
- **Defensive coercion + migration (both).** Migration runs at activation, but a reader could fire before it completes or read an un-migrated folder scope, so every reader funnels through `coerceLegacyBoolean` — robust to either type. This honors the lessons-learned "widen the type, don't cast" spirit: the reader's return type is `boolean`, no `as string`.
- **Rename `activityPanelMode` → `activityPanelEnabled`** (and `installPromptMode` → boolean) so the type itself enforces boolean — no string-comparison reader can survive compile.
- **Per-scope migration via `inspect()`** preserves whether the user set the value globally vs per-workspace.

## Out of Scope

- The other boolean beta settings (`complexityFastPath`, `resumeBeta`) — already booleans, untouched.
- `speckit.companion.templateProfile` — stays a tri-state enum (`standard`/`turbo`/`off`); it is genuinely three-valued, not a badge toggle.
- Any change to what the features DO when enabled.

## Constitution Check

No constitution gates defined for this repo. No violations.
