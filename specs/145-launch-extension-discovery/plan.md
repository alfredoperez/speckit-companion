# Implementation Plan: Launch prep — spec-kit extension discovery, safety & one-click install

## Summary

Ship two primitives and make every UI surface a thin consumer. (1) A **detection** signal — reuse `isCompanionInstalled()` (presence of `.specify/extensions/companion/`). (2) A single **install/update** terminal action wrapped in a new `speckit/specKitExtensionInstall.ts` module that owns the `RELEASE_URL` / `BY_NAME_INSTALL` constants, builds the `specify extension add companion --from <url> --force` command, surfaces the github-source CLI prereq, and registers `speckit.companion.installSpecKitExtension`. Wire missing-extension **fallback** into turbo dispatch so a `/speckit.companion.*` command is never dispatched when the extension is absent. Add install banners to the Create-Spec (vanilla webview) and Activity (Preact webview) panels, a sidebar install affordance + upgrade-menu entry, all gated `missing && flagged`. Overhaul `README.md` with placeholdered images and eval-stat TODOs.

## Technical Context

- **Language**: TypeScript (VS Code extension `src/`, vanilla TS webview `webview/src/spec-editor`, Preact webview `webview/src/spec-viewer`).
- **Detection primitive**: `isCompanionInstalled(workspaceRoot)` — already in `src/features/settings/companionPresetReconciler.ts` (#218). Reused, not reimplemented.
- **Terminal**: `vscode.window.createTerminal(...).sendText(...)` — same pattern as `src/speckit/detector.ts` upgrade actions.
- **Banner gate**: follow the `speckit.viewer.activityPanel` `'off'|'beta'|'on'` precedent for a new `speckit.companion.installPrompt` flag (default `'on'` — launch-critical safety prompt, not an experiment, but still suppressible).
- **Constraint**: behavior lives only in `src/`, `webview/`, `package.json`. Reading `.specify/` for detection is allowed; no writes to `.claude/`/`.specify/`.

## Approach & Structure

Order of attack (primitives first, consumers after):

1. **`src/speckit/specKitExtensionInstall.ts`** (new) — the install primitive:
   - `RELEASE_URL` constant (the `speckit-ext-v0.3.0` `companion-0.3.0.zip` release asset) and `BY_NAME_INSTALL` (`'companion'`) with a single `// TODO(catalog):` to swap once the catalog lists it.
   - `buildInstallCommand()` → the `specify extension add companion --from <RELEASE_URL> --force` string (and the by-name form behind the TODO flag).
   - `CLI_PREREQ_COMMAND` (`uv tool install specify-cli --from git+…spec-kit.git --force`).
   - `runInstallSpecKitExtension(workspaceRoot?)` → opens a terminal, echoes the prereq note, runs the install command.
   - `README_FALLBACK_URL` for the banner fallback link.
   - `shouldShowInstallPrompt(mode, installed)` → pure gate: `mode !== 'off' && !installed`. Unit-tested.
2. **`src/speckit/specKitExtensionInstallCommands.ts`** (new) — registers `speckit.companion.installSpecKitExtension`.
3. **`src/features/specs/profileDispatch.ts`** — add `resolveProfileCommandWithFallback()` (and new-spec variant) layering on `resolveProfileCommand`: if the resolved command is a `/speckit.companion.*` twin AND the extension is missing, return `{ command: <stock>, fellBack: true }` so the caller warns and runs stock. Pure + unit-tested. Wire the two dispatch call-sites (viewer footer / new-spec) to warn on `fellBack`.
4. **Create-Spec banner** — `specEditorProvider.getWebviewHtml`: inject a server-rendered banner `<div id="install-banner">` (gated by `shouldShowInstallPrompt`) with Install + README buttons; add `installSpecKitExtension` / `openReadme` message types handled in `handleMessage` → dispatch the command. Webview `index.ts` posts the message.
5. **Activity banner** — `spec-viewer/html/generator.ts`: same server-rendered banner `<div>` injected into the body (above `#app-root`), gated by a new `showInstallPrompt` arg threaded from `specViewerProvider`. Click posts `installSpecKitExtension` to the existing `vscode` api; `messageHandlers.ts` handles it.
6. **Sidebar affordance + upgrade menu** — `package.json`: register the command + title/icon; add a `view/title` menu entry on `speckit.views.explorer` gated `when: !speckit.companion.installed`; add an "Update spec-kit extension" item to the `speckit.upgrade` quickpick in `cliCommands.ts`. Set the `speckit.companion.installed` context key on activation + on config/fs change.
7. **README** — overhaul with benefits, per-feature section, both-extension install, mode-comparison; image placeholders + eval TODOs.

### Decisions
- **Banner is server-rendered HTML, not a Preact/React component.** Both webviews already build their outer HTML server-side; a gated `<div>` with a `postMessage` button is the smallest, most testable surface and avoids reworking the Preact render tree. The gate (`shouldShowInstallPrompt`) is the unit-tested logic; the markup is a thin string.
- **Context key `speckit.companion.installed`** drives the sidebar `when` clause (VS Code menus can't call functions). Set from `isCompanionInstalled` on activation and refreshed alongside the existing reconciler triggers.
- **Default flag `'on'`** (not `'beta'`): this is launch safety, shown to everyone missing the extension; `'off'` is the opt-out.

## Out of Scope

- The catalog by-name install (kept behind a constant + TODO until github/spec-kit lists it).
- Running `/eval-speckit-extension` to fill real mode-comparison numbers (left as `TODO(eval)` placeholders).
- Generating the README images (left as `🎨 IMAGE` placeholders).
- Reworking the Preact Activity-panel component tree (banner is server-rendered instead).

## Constitution Check

No constitution gates defined for this repo. Isolation rule honored: behavior in `src/`/`webview/`/`package.json`; `.specify/` read-only for detection.
