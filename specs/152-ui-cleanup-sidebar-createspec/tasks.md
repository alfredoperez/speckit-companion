# Tasks: UI cleanup — sidebar install icon + Create-Spec touchups

Dependency-ordered. `[P]` = parallelizable with siblings (different files, no shared edit region).

## Sidebar (package.json)

- [x] **T001** Change `speckit.companion.installSpecKitExtension` command `icon` from `$(cloud-download)` to a distinct glyph `$(desktop-download)` + package.json
- [x] **T002** Regroup `contributes.menus."view/title"` explorer entries into `navigation@1` (create), `navigation@2` (filter, filter.clear, sort, collapseAll, expandAll), `navigation@3` (upgrade, install) so dividers render + package.json

## Load Template removal (full excision)

- [x] **T003** Remove `requestTemplateDialog`/`loadTemplate` switch cases + `handleRequestTemplateDialog`/`handleLoadTemplate` methods + Load Template button markup in HTML template + src/features/spec-editor/specEditorProvider.ts
- [x] **T004** [P] Remove `loadTemplate`/`requestTemplateDialog`/`templateLoaded` message-type union members + src/features/spec-editor/types.ts
- [x] **T005** [P] Remove `loadTemplateBtn` element lookup + click listener + `templateLoaded` message case + webview/src/spec-editor/index.ts
- [x] **T006** [P] Remove the three message-type union members + webview/src/spec-editor/types.ts
- [x] **T007** [P] Remove `.template-loader`, `.load-template-btn`, `.load-template-btn:hover`, `.load-template-btn .codicon`, `.workflow-row .template-loader` CSS + webview/styles/spec-editor.css
- [x] **T008** [P] Remove the Load Template mock button and restructure the mock row + webview/src/spec-editor/CreateSpecMock.tsx
- [x] **T009** Grep `loadTemplate|requestTemplateDialog|templateLoaded|LoadTemplate|load-template|Load Template` across src/webview/package.json/mocks/tests — confirm zero residual references + (verification)

## Turbo label

- [x] **T010** In `buildTurboWorkflowEntry`, set `displayName` to `Turbo`, move full label text into `description` (hover tooltip), keep `name`=`speckit-turbo` and `beta` unchanged + src/features/spec-editor/specEditorProvider.ts

## Responsive

- [x] **T011** Add `flex-wrap`+`gap`+`min-width:0`/ellipsis to `.workflow-row` and `.image-attachment-header`; extend `@media (max-width:500px)` to wrap/stack these rows + webview/styles/spec-editor.css

## Verify

- [x] **T012** Run `npm run compile && npm test`; confirm green excluding the 6 known pre-existing Python `test_context.py` failures + (verification)
