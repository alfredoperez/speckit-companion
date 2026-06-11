# Tasks: Launch prep — spec-kit extension discovery, safety & one-click install

Dependency-ordered. `[P]` marks tasks that can run in parallel.

## Primitive 1 — Install module + constants

- [x] **T001** Create `src/speckit/specKitExtensionInstall.ts`: `RELEASE_URL`, `BY_NAME_INSTALL` constants + `TODO(catalog)`, `CLI_PREREQ_COMMAND`, `README_FALLBACK_URL`, `buildInstallCommand()`, `runInstallSpecKitExtension()`, `shouldShowInstallPrompt()` + `src/speckit/specKitExtensionInstall.ts`
- [x] **T002** Register `speckit.companion.installSpecKitExtension` command in `src/speckit/specKitExtensionInstallCommands.ts` and wire it into activation + `src/speckit/specKitExtensionInstallCommands.ts`
- [x] **T003** [P] Unit tests for `shouldShowInstallPrompt` and `buildInstallCommand` + `src/speckit/specKitExtensionInstall.test.ts`

## Primitive 2 — Detection → fallback in dispatch

- [x] **T004** Add `resolveProfileCommandWithFallback()` + new-spec variant to `src/features/specs/profileDispatch.ts` — never return a `/speckit.companion.*` command when the extension dir is absent; flag `fellBack` + `src/features/specs/profileDispatch.ts`
- [x] **T005** Wire the two dispatch call-sites to warn on `fellBack` and run stock + `src/features/specs/specCommands.ts`
- [x] **T006** [P] Unit tests for the fallback logic (missing → stock + flag; installed → twin) + `src/features/specs/profileDispatch.test.ts`

## Consumer surfaces — banners

- [x] **T007** Create-Spec banner: gated `<div>` in `getWebviewHtml`, `installSpecKitExtension`/`openReadme` message types + handlers + `src/features/spec-editor/specEditorProvider.ts`
- [x] **T008** Create-Spec webview click handler posts the install message + `webview/src/spec-editor/index.ts`
- [x] **T009** Activity panel banner: `showInstallPrompt` arg threaded into `generateHtml`, gated server-rendered banner + handler + `src/features/spec-viewer/html/generator.ts`
- [x] **T010** Thread `showInstallPrompt` from `specViewerProvider` + handle the message in `src/features/spec-viewer/messageHandlers.ts` + `src/features/spec-viewer/specViewerProvider.ts`

## Consumer surfaces — sidebar + upgrade + context key

- [x] **T011** `package.json`: register command, title/icon, `view/title` install affordance gated `!speckit.companion.installed`, config flag `speckit.companion.installPrompt` + `package.json`
- [x] **T012** Add "Update spec-kit extension" to the `speckit.upgrade` quickpick + `src/speckit/cliCommands.ts`
- [x] **T013** Set + refresh the `speckit.companion.installed` context key on activation and on config/fs change + `src/extension.ts`

## Surface 6 — README

- [x] **T014** Overhaul root `README.md`: benefits, per-feature, both-extension install, mode-comparison, image + eval-stat placeholders + `README.md`

## Verify

- [x] **T015** `npm run compile` clean + `npm test` green; fix any breakage + (whole tree)
