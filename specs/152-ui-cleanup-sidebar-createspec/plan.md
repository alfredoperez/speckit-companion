# Implementation Plan: UI cleanup — sidebar install icon + Create-Spec touchups

## Summary

Three independent, low-risk touchups. (1) In `package.json` `contributes`, give `speckit.companion.installSpecKitExtension` a distinct codicon and regroup the `view/title` actions for `speckit.views.explorer` into create / list-controls / install-upgrade buckets so dividers render. (2) Fully excise the Load Template feature across extension provider, webview, types, CSS, and the Storybook mock. (3) Shorten the turbo workflow option's visible label to `Turbo` (keeping the full text in its description, which already drives the `<option title>`) and add a narrow-width responsive pass to the Create-Spec stylesheet.

## Technical Context

- **Language**: TypeScript (extension `src/`, webview `webview/src/`), CSS, JSON manifest.
- **Build/test**: `npm run compile` (tsc + esbuild bundles), `npm test` (node test runner + vitest webview). Python `test_context.py` has 6 known pre-existing failures — out of scope.
- **Constraints**: VS Code `view/title` icons are monochrome-themed (distinctness by glyph only). Must not change the turbo value `speckit-turbo`. No new dead code after Load Template removal.
- **No new dependencies, no schema/type-union widening beyond removing message-type members.**

## Approach & Structure

Order of attack (grouped by surface):

1. **Sidebar — `package.json`**
   - `contributes.commands`: change the `icon` of `speckit.companion.installSpecKitExtension` from `$(cloud-download)` to `$(desktop-download)` (distinct from `speckit.upgrade`'s `$(cloud-download)`).
   - `contributes.menus."view/title"`: regroup the `speckit.views.explorer` entries into `navigation@1` = create; `navigation@2` = filter, filter.clear, sort, collapseAll, expandAll; `navigation@3` = upgrade, install. Leave the `speckit.views.steering` entries untouched (separate view).

2. **Load Template removal** (remove every artifact)
   - `src/features/spec-editor/specEditorProvider.ts`: delete the `requestTemplateDialog` and `loadTemplate` switch cases, the `handleRequestTemplateDialog` and `handleLoadTemplate` methods, and the `.template-loader` / `load-template-btn` button markup in the HTML template.
   - `src/features/spec-editor/types.ts`: delete the `loadTemplate`, `requestTemplateDialog`, `templateLoaded` message-type union members.
   - `webview/src/spec-editor/index.ts`: delete the `loadTemplateBtn` element lookup, its click listener, and the `templateLoaded` message case.
   - `webview/src/spec-editor/types.ts`: delete the three message-type members.
   - `webview/styles/spec-editor.css`: delete the `.template-loader`, `.load-template-btn`, `.load-template-btn:hover`, and the `.load-template-btn .codicon` selector (split from the shared rule); drop `.workflow-row .template-loader`.
   - `webview/src/spec-editor/CreateSpecMock.tsx`: remove the Load Template mock button; left-align or restructure the remaining row.

3. **Turbo label — `src/features/spec-editor/specEditorProvider.ts`**
   - `buildTurboWorkflowEntry`: set `displayName` to `Turbo` (drop the `(beta)` suffix from the visible label); move the full former label text into the `description` so the `<option title>` hover still shows it. Keep `name: TURBO_WORKFLOW_NAME` (`speckit-turbo`) and `beta` flag unchanged.

4. **Responsive — `webview/styles/spec-editor.css`**
   - `.workflow-row`: add `flex-wrap: wrap` + `gap`. `.image-attachment-header`: add `flex-wrap: wrap` + `gap`. Add `min-width: 0` / ellipsis where a child label can overflow.
   - Extend the `@media (max-width: 500px)` block to also stack/wrap `.workflow-row` and `.image-attachment-header`.

5. **Verify**: grep the six Load Template tokens return zero in shipping source; `npm run compile && npm test` green (minus the known Python failures).

## Out of Scope

- Any change to the turbo command bodies, capture scripts, or `.spec-context.json` schema.
- The `speckit.views.steering` title-bar actions.
- The Python `test_context.py` suite (pre-existing failures).
- Reworking the install/upgrade *commands* themselves — only their icons/menu grouping.
