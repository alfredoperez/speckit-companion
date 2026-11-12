# Tasks: The spec viewer as an embeddable element

> **Scale note**: about 70 files in four areas (package, extension webview, extension host shims, build configs). The risk is a silent change in VS Code: the style diff and the unedited `vscode` mocks in tests and stories are the guards.

## Phase 1: Setup

**Wave 1 — independent (different files):**
- [x] **T001** [P] Add `highlight.js@11.9.0`, `preact` and `@preact/signals` to the package and the lockfile; add `./view` and `./element` exports and `typesVersions` · packages/viewer/package.json, package-lock.json
- [x] **T002** [P] Turn on `noUncheckedIndexedAccess`; exclude `src/view` and `src/element` from the DOM-free build; add `tsconfig.view.json` (DOM, Preact JSX, declarations to `dist/types`) · packages/viewer/tsconfig.json, packages/viewer/tsconfig.view.json
- [x] **T003** [P] Resolve `speckit-viewer/view` and `/element` in Jest, Storybook and the webview tsconfig · jest.config.js, .storybook/main.ts, tsconfig.webview.json

## Phase 2: Foundational

**Wave 1 — independent (different files):**
- [x] **T004** [P] [US3] Fix the unchecked-index errors in the renderer and cards · packages/viewer/src/core/markdown/{renderer,preprocessors,screenCard,callsCard,statesCard,codeCard,sourceLines,fenceInfo,inline}.ts, packages/viewer/src/core/relativeTime.ts
- [x] **T005** [P] [US3] Fix the unchecked-index errors in the ledger · packages/viewer/src/core/markdown/ledger/*.ts
- [x] **T006** [P] Export `ViewerAction` · packages/viewer/src/contract/viewer.ts
- [x] **T007** [P] Move `phaseCalculation`, `stepHistoryDerivation`, `stateDerivation` (footer builder as a parameter), `historyHelpers`, `taskCheckboxes`, `capabilityNames` and the status constants into core; leave one-line re-exports at the old paths; repoint the canvas build · packages/viewer/src/core/*.ts, apps/vscode/src/features/spec-viewer/{phaseCalculation,stateDerivation}.ts, apps/vscode/src/features/specs/{stepHistoryDerivation,historyHelpers}.ts, apps/vscode/src/core/utils/{taskCheckboxes,capabilityNames}.ts, apps/vscode/src/core/constants.ts, apps/copilot-canvas/build.mjs

**⟶ Wait for Wave 1 to finish, then:**
- [x] **T008** Add the view's host (`onAction`, `setActionHandler`), signals and `ViewerSlots` context · packages/viewer/src/view/{host,signals,slots}.ts

## Phase 3: User Story 1 - The VS Code viewer looks and works exactly as before (P1)

Files: packages/viewer/src/view/** (except host, signals, slots), apps/vscode/webview/src/spec-viewer/{App.tsx,signals.ts,index.tsx,components/**,toc.ts,highlighting.ts,documentLinks.ts}, apps/vscode/src/features/spec-viewer/html/generator.ts, webpack.config.js, .storybook/preview-head.html, packages/viewer/scripts/build-css.mjs

### Tests
- [x] **T009** [US1] FR-001/FR-005: every view action reaches `vscode.postMessage` with today's message, rail, header, cards and document links included · packages/viewer/src/view/__tests__/actions.test.tsx
- [x] **T010** [US1] FR-013: the bundled highlighter colours a TypeScript and a Python block, with no global `hljs` · packages/viewer/src/view/__tests__/highlighting.test.ts

### Implementation

**Wave 1 — independent (different files):**
- [x] **T011** [P] [US1] Move the host-neutral components, toc, highlighting (bundled `highlight.js/lib/common`) and document links into the package; `vscode.postMessage` becomes `onAction`; the install banner and report page come from `ViewerSlots` · packages/viewer/src/view/**
- [x] **T012** [P] [US1] Copy highlight.js's github-dark sheet to `dist/styles/highlight/` · packages/viewer/scripts/build-css.mjs

**⟶ Wait for Wave 1 to finish, then:**
- [x] **T013** [US1] Extension webview: `signals.ts` re-exports the package's and installs the postMessage handler; `App.tsx` fills the slots; old component paths re-export the package · apps/vscode/webview/src/spec-viewer/**
- [x] **T014** [US1] Link github-dark from the package and drop the highlight.js CDN tags, in the webview and in Storybook · apps/vscode/src/features/spec-viewer/html/generator.ts, .storybook/preview-head.html, webpack.config.js
- [ ] **T015** [US1] FR-006: run the computed-style diff and the bundle diff against the main baseline and record both · specs/670-viewer-element/proof.md

**Checkpoint**: the VS Code viewer runs on the package view and matches main.

## Phase 4: User Story 2 - Another app renders a spec with one element (P1)

Files: packages/viewer/src/core/navState.ts, packages/viewer/src/element/**, packages/viewer/scripts/build-element.mjs, packages/viewer/tests/element/**

### Tests
- [ ] **T016** [US2] FR-008/FR-009: `buildNavState` puts action steps on the rail, maps implement to the Tasks tab and falls back on an unknown `currentDoc` · packages/viewer/src/core/__tests__/navState.test.ts
- [ ] **T017** [US2] FR-007, FR-010 to FR-012, FR-014: a page with only the element bundle renders a fixture, switches document on a rail click, emits `speckit-action`, shows the `actions` slot first and requests no CDN script (headless Chrome) · packages/viewer/tests/element/element.check.mjs

### Implementation
- [ ] **T018** [US2] `buildNavState` from a record, the documents, the current document and task counts · packages/viewer/src/core/navState.ts
- [ ] **T019** [US2] `<speckit-viewer>`: properties, light-DOM render, internal navigation, `speckit-action` events, `actions` slot · packages/viewer/src/element/index.ts
- [ ] **T020** [US2] esbuild ESM bundle and declarations; wire into the package build · packages/viewer/scripts/build-element.mjs, packages/viewer/package.json

**Checkpoint**: a plain page renders a spec with the element alone.

## Phase 5: User Story 3 - The package type-checks in a strict consumer (P2)

Files: packages/viewer/tests/strict.test.ts

### Tests
- [ ] **T021** [US3] FR-015: both package tsconfigs type-check with `noUncheckedIndexedAccess` and report zero errors · packages/viewer/tests/strict.test.ts

**Checkpoint**: Factory can import the package without `@ts-nocheck`.

## Phase 6: Polish

- [ ] **T022** Docs: package README (both ways to plug in), CLAUDE.md repo map, surface map · packages/viewer/README.md, CLAUDE.md, .claude/skills/release-qa/surface-map.yml
- [ ] **T023** Validate against Success Criteria: `npx tsc --noEmit -p ./`, `-p tsconfig.webview.json`, `npm run check:vsix`, `npm run test:all` · (no file)

## Dependencies & Execution Order

- Setup → Foundational → US1 and US2 → US3 → Polish. US2 needs the view from US1 (T011).
- Setup: one wave. Foundational: wave 1 (T004–T007) blocks T008. US1: wave 1 (T011, T012) blocks T013, T014, then T015. US2: T018 → T019 → T020, then T017. US3: T021 after T004, T005, T011, T019.
