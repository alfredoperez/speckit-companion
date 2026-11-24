# Tasks: Open questions and a Clarify action

## Phase 1: Setup

None.

## Phase 2: Foundational

None: the two hosts own disjoint files.

## Phase 3: User Stories 1 and 2 - VS Code (Priority: P1)

Files: packages/viewer/src/contract/viewerState.ts, packages/viewer/src/core/stateDerivation.ts, packages/viewer/src/view/components/SpecHeader.tsx, apps/vscode/src/features/spec-viewer (the host file that derives state), apps/vscode/webview tests and stories for the header, .changeset/open-questions.md

- [x] **T001** [US1] [US2] Tests: derivation carries `openQuestions`; header shows the count and pluralises; pressing it posts `{type:'clarify'}`; no count without markers (FR-001, FR-002)
- [x] **T002** [US1] `openQuestions` on ViewerState and in the derivation, fed by the host from spec.md (FR-001)
- [x] **T003** [US2] The header count button and its story; a viewer changeset (FR-002, FR-005)

## Phase 4: User Stories 1 and 2 - the Copilot board (Priority: P1)

Files: apps/copilot-canvas/build.mjs, apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/{prompts.mjs,specs-core.mjs,public/app.js,vendor/}, apps/copilot-canvas/tests

- [x] **T004** [US1] [US2] Tests: each spec carries `openQuestions`; `clarify` resolves to the stock command in both sets; the chip shows only above zero (FR-003, FR-004)
- [x] **T005** [US1] Bundle `clarificationsIn`; `openQuestions` per spec (FR-003)
- [x] **T006** [US2] `clarify` in SPEC_COMMANDS; the Clarify chip with the count (FR-004)

## Phase 5: Polish

- [x] **T007** Changelog lines, docs (copilot-app/index.mdx, the viewer page), `npm run canvas:build` and `npm run mod:build`, and every suite (FR-005)

## Dependencies & Execution Order

- Phases 3 and 4 run side by side; Polish last.
