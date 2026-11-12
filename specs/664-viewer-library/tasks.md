# Tasks: Spec viewer as a shared library (V1 to V4)

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

> **Scale note**: about 120 files in four areas (workspace, contract and core move, styles move, build plumbing). The moves are mechanical; the risk is in the build wiring and the cascade, so each story ends on a diff that must come back empty.

## Phase 1: Setup

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add npm workspaces, the `speckit-viewer` package (MIT, private) and the 12-line lockfile link; prove the webview bundle byte-identical · package.json, package-lock.json, packages/viewer/package.json, packages/viewer/LICENSE
- [x] **T002** [P] Add `packages/viewer/**` to the release QA surface map · .claude/skills/release-qa/surface-map.yml
- [x] **T003** [P] Keep `packages/**` out of the .vsix and name `packages/` in the CLAUDE.md repo map · .vscodeignore, CLAUDE.md

## Phase 2: Foundational

**Wave 1 — independent (different files):**

- [x] **T004** [P] Package exports (`source`, `types`, `default`), `typesVersions`, `sideEffects: false`, a `build` script, and the CommonJS build tsconfig · packages/viewer/package.json, packages/viewer/tsconfig.json
- [x] **T005** [P] Webview and extension webpack: resolve the `source` condition, alias the core signals module to the extension's signal, copy the package's built CSS · webpack.config.js
- [x] **T006** [P] Jest: add the package root and map `speckit-viewer/*` and the core signals seam · jest.config.js, tsconfig.test.json
- [x] **T007** [P] Root `pre*` scripts build the package before `compile`, `watch`, `compile-web` and `package-web` · package.json

## Phase 3: User Story 1 - The extension keeps working on the new package (P1)

Files: packages/viewer/src/contract/{specContext,viewer,viewerState,index}.ts, packages/viewer/src/core/**, apps/vscode/src/core/types/specContext.ts, apps/vscode/src/protocol/viewer.ts, apps/vscode/src/core/utils/overviewAvailability.ts, apps/vscode/src/features/reports/clarifications.ts, apps/vscode/webview/src/spec-viewer/** (imports only), tsconfig.webview.json, apps/copilot-canvas/build.mjs and its vendor/, tooling/scripts/viewer-bundle-diff.mjs

### Tests

- [x] **T008** [US1] FR-002, FR-007: a script that strips webpack module ids and path comments and diffs two builds' `spec-viewer.js`; it must report zero lines after the move · tooling/scripts/viewer-bundle-diff.mjs
- [x] **T009** [US1] FR-008: the moved renderer tests run from the package against the same fixtures and pass unchanged · packages/viewer/src/core/markdown/__tests__/

### Implementation

**Wave 1 — independent (different files):**

- [x] **T010** [P] [US1] FR-004: move `specContext.ts`, the viewer protocol types and the webview's shared viewer types into `/contract`; `NavState` takes the report payload as a type parameter · packages/viewer/src/contract/
- [x] **T011** [P] [US1] FR-005: move the DOM-free renderer, the pure derivations, `overviewAvailability` and `clarificationsIn` into `/core`, with the `signals.ts` holder; split `ledger/refs.ts` so the DOM resolver stays · packages/viewer/src/core/

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T012** [US1] FR-006: point the extension at the package: host shims re-export, webview files import `speckit-viewer/*`, stories and DOM tests keep working · apps/vscode/src/core/types/specContext.ts, apps/vscode/src/protocol/viewer.ts, apps/vscode/webview/src/spec-viewer/**, tsconfig.webview.json
- [x] **T013** [US1] Canvas: build from the package paths, drop the signals stub, rebuild vendor · apps/copilot-canvas/build.mjs, its vendor/

**Checkpoint**: the extension builds, its suites pass and the normalized bundle diff is empty.

## Phase 4: User Story 2 - Another host loads the package (P1)

Files: packages/viewer/src/contract/schemas.ts, packages/viewer/tests/

### Tests

- [x] **T014** [P] [US2] FR-004: a valid fixture `.spec-context.json` parses and keeps unknown fields; a malformed one reports the bad field; the message schema accepts every outgoing `type` · packages/viewer/tests/schemas.test.ts
- [x] **T015** [P] [US2] FR-013: plain Node imports `speckit-viewer/contract` and `/core` by name from the built package, parses a context and renders a spec with no DOM · packages/viewer/tests/node-import.test.ts

### Implementation

- [x] **T016** [US2] FR-004: Zod schemas for the spec context, navigation state, viewer state and outgoing messages, with type tests tying them to the interfaces · packages/viewer/src/contract/schemas.ts, packages/viewer/package.json (zod), package-lock.json
- [x] **T017** [US2] FR-013: load the package from Factory's toolchain in a scratch folder and record what was proven · specs/664-viewer-library/factory-proof.md

**Checkpoint**: a host with no VS Code validates a context file and renders a spec.

## Phase 5: User Story 3 - A host themes the viewer with tokens (P2)

Files: packages/viewer/styles/**, packages/viewer/scripts/build-css.mjs, apps/vscode/webview/styles/spec-viewer.css, apps/vscode/webview/styles/_install-banner.css, apps/vscode/webview/styles/spec-editor.css, apps/vscode/src/features/spec-viewer/html/generator.ts, .storybook/preview.tsx, apps/copilot-canvas/public/*, tooling/scripts/viewer-style-diff.mjs, apps/vscode/tests/unit/spec-viewer/tokensScope.spec.ts

### Tests

- [x] **T018** [US3] FR-010: no `--vscode-` name outside `themes/vscode.css`, every token the stylesheet reads is set by each theme, and the built CSS has no unscoped selector · apps/vscode/tests/unit/spec-viewer/tokensScope.spec.ts
- [x] **T019** [US3] FR-012: a headless computed-style diff of every element in the viewer stories, main against the branch, dark and light · tooling/scripts/viewer-style-diff.mjs

### Implementation

**Wave 1 — independent (different files):**

- [x] **T020** [P] [US3] FR-009: move the partials to the package, rename theme tokens to `--sk-*`, give `_content.css`'s host colours roles · packages/viewer/styles/
- [x] **T021** [P] [US3] FR-009: PostCSS build that inlines the partials and prefixes every selector with `:where(.sk-viewer)` · packages/viewer/scripts/build-css.mjs

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T022** [US3] FR-010, FR-011: the four themes and `roles.css` · packages/viewer/styles/themes/
- [x] **T023** [US3] FR-012: the extension loads the built CSS and vscode theme with `sk-viewer` on `<body>`; the install banner reads both token sets; Storybook and the canvas page follow · apps/vscode/webview/styles/, generator.ts, .storybook/preview.tsx, apps/copilot-canvas/

**Checkpoint**: the style diff is empty and the theme checks pass.

## Phase 6: Polish

- [x] **T024** Validate against Success Criteria: `npx tsc --noEmit -p ./`, `npx tsc --noEmit -p tsconfig.webview.json`, related Jest tests, then `npm run test:all` once · (no file)

## Dependencies & Execution Order

- Setup → Foundational → US1 → US2 and US3 → Polish. US2 needs the contract US1 moves; US3 needs only Foundational but runs after US1 to keep one webpack edit at a time.
- Phase 1: one wave (T001–T003). Phase 2: one wave (T004–T007). US1: T010, T011 block T012, T013. US2: T016 before T014, T015 pass; T017 last. US3: T020, T021 block T022, T023; T018, T019 check the result.
