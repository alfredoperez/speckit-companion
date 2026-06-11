# Tasks: Collapse Beta Tri-State Settings to Boolean On/Off

Dependency-ordered. Turbo profile — organized by file/concern, not user story.

## Phase 1: Migration core (blocks readers)

- [x] **T001** Create `src/core/settingsMigration.ts` with `coerceLegacyBoolean(value: unknown, fallback: boolean): boolean` (true/false pass through; `'beta'`/`'on'` → true; `'off'` → false; else fallback) and `BETA_BOOLEAN_SETTING_KEYS` listing the three relative keys + their defaults + `migrateBetaTriStateSettings(): Promise<void>` that per-scope `inspect()`s each key and `update()`s legacy-string values to the coerced boolean at the same scope (idempotent; skips boolean/undefined) + src/core/settingsMigration.ts
- [x] **T002** [P] Add `src/core/settingsMigration.test.ts` — unit-test `coerceLegacyBoolean` (`"beta"`→true, `"on"`→true, `"off"`→false, true→true, false→false, junk→fallback) and `migrateBetaTriStateSettings` with a mocked `vscode.workspace.getConfiguration`/`inspect`/`update` asserting legacy strings rewrite at the correct scope and booleans/undefined are left untouched + src/core/settingsMigration.test.ts

## Phase 2: package.json schema

- [x] **T003** In `package.json`, change `speckit.viewer.activityPanel`, `speckit.companion.turboWorkflowPicker`, `speckit.companion.installPrompt` to `"type": "boolean"`, `"default": true`, remove `enum` + `enumDescriptions`, keep "opt-in beta" wording in each `description` + package.json

## Phase 3: Readers → boolean

- [x] **T004** In `src/speckit/specKitExtensionInstall.ts`, replace `readInstallPromptMode(): 'off'|'beta'|'on'` with a boolean reader (`coerceLegacyBoolean(get('companion.installPrompt'), true)`) and change `shouldShowInstallPrompt(enabled: boolean, installed: boolean) => enabled && !installed` + src/speckit/specKitExtensionInstall.ts
- [x] **T005** Update both `shouldShowInstallPrompt`/`readInstallPrompt` call sites in `src/features/spec-editor/specEditorProvider.ts` and `src/features/spec-viewer/specViewerProvider.ts` to the boolean signature + src/features/spec-editor/specEditorProvider.ts, src/features/spec-viewer/specViewerProvider.ts
- [x] **T006** In `src/features/spec-editor/specEditorProvider.ts` `buildTurboWorkflowEntry()`, read the boolean via `coerceLegacyBoolean`, return undefined when disabled, drop the `(beta)` label suffix and the `beta` field on the returned `WorkflowDefinition` + src/features/spec-editor/specEditorProvider.ts
- [x] **T007** In `src/features/spec-viewer/specViewerProvider.ts`, rename `readActivityPanelMode()` → `readActivityPanelEnabled(): boolean` (default true, via `coerceLegacyBoolean`) and update its two call sites; thread boolean `activityPanelEnabled` into the viewer payload + src/features/spec-viewer/specViewerProvider.ts

## Phase 4: Types + payload threading

- [x] **T008** [P] Change `activityPanelMode?: 'off'|'beta'|'on'` → `activityPanelEnabled?: boolean` in `src/features/spec-viewer/types.ts` and `webview/src/spec-viewer/types.ts` + src/features/spec-viewer/types.ts, webview/src/spec-viewer/types.ts
- [x] **T009** Update `src/features/spec-viewer/html/generator.ts` to accept/forward `activityPanelEnabled: boolean` (default true) in place of `activityPanelMode` + src/features/spec-viewer/html/generator.ts
- [x] **T010** [P] Drop the now-unused `beta?: boolean` field from `WorkflowDefinition` in `src/features/spec-editor/types.ts` and `webview/src/spec-editor/types.ts` + src/features/spec-editor/types.ts, webview/src/spec-editor/types.ts

## Phase 5: Badge removal (webview)

- [x] **T011** In `webview/src/spec-viewer/components/NavigationBar.tsx`, read `ns.activityPanelEnabled ?? true`, render the toggle when truthy, and remove the `<span class="activity-toggle__beta">beta</span>` markup + webview/src/spec-viewer/components/NavigationBar.tsx
- [x] **T012** [P] Remove the `.activity-toggle__beta` rule from `webview/styles/spec-viewer/_activity.css` + webview/styles/spec-viewer/_activity.css

## Phase 6: Activation wiring + verify

- [x] **T013** Call `migrateBetaTriStateSettings()` early in `activate()` in `src/extension.ts` (before providers build) + src/extension.ts
- [x] **T014** Run `npm run compile` and `npm test`; fix any failures (grep for residual `'beta'`/`'on'`/`'off'` reads, `activityPanelMode`, `.activity-toggle__beta`, `(beta)` suffix) + (verification)
