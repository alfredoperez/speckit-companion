# Tasks: Plan code block

**Scale note**: about 20 files across the viewer, the spec-kit extension and docs. The render loop change in T003 is the one that can move an existing fence, so its tests in T007 come before the styles.

## Phase 1: Foundational

Files: `markdown/blockFences.ts`, `markdown/codeCard.ts`, `markdown/renderer.ts`

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add the `code` block name and a `pins` list to the block context · apps/vscode/webview/src/spec-viewer/markdown/blockFences.ts
- [x] **T002** [P] `parseCodeInfo`, `parseCode` and `renderCodeCard` by the grammar and DOM contracts · apps/vscode/webview/src/spec-viewer/markdown/codeCard.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** Route a sketch or citation fence to `code`, collect the pin lines after a fence, skip the lines a drawn block consumed, register the card · apps/vscode/webview/src/spec-viewer/markdown/renderer.ts

## Phase 2: User Story 1 - the card (P1)

Files: `markdown/__tests__/codeCard.test.ts`, `styles/spec-viewer/_code-card.css`, `styles/spec-viewer/index.css`, `markdown/PlanComponents.stories.tsx`

**Wave 1 — independent (different files):**

- [x] **T004** [P] [US1] Tests: info line parser, numbering for a sketch and a citation, `hl`, pins under their line, link only for a citation, text shown as text, every fallback case, row and pin `data-line` · apps/vscode/webview/src/spec-viewer/markdown/__tests__/codeCard.test.ts
- [x] **T005** [P] [US1] Card styles from existing tokens: outlined badge, quiet note, accent tint and pin edge, body-font pin · apps/vscode/webview/styles/spec-viewer/_code-card.css
- [x] **T006** [P] [US1] Stories for a sketch, a citation and a malformed fence, each in light and dark · apps/vscode/webview/src/spec-viewer/markdown/PlanComponents.stories.tsx

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T007** [US1] Import the new stylesheet after `_calls.css` · apps/vscode/webview/styles/spec-viewer/index.css

**Checkpoint**: a sketch and a citation render as cards, a malformed one as the plain block.

## Phase 3: User Story 2 - everything else untouched (P1)

Files: `markdown/__tests__/renderer.test.ts`

- [x] **T008** [US2] Tests: a plain fence, a titled fence, a diagram and a calls fence render as before, and `code` falls back when no renderer is registered · apps/vscode/webview/src/spec-viewer/markdown/__tests__/renderer.test.ts

**Checkpoint**: every existing viewer test passes unchanged.

## Phase 4: User Story 3 - comment on a line (P2)

Files: `src/features/spec-viewer/extractBlock.ts`, `tests/unit/spec-viewer/extractBlock.spec.ts`

**Wave 1 — independent (different files):**

- [x] **T009** [P] [US3] A line inside a code card fence, and a `pin` line, is a block of one line · apps/vscode/src/features/spec-viewer/extractBlock.ts
- [x] **T010** [P] [US3] Tests for both, and an ordinary fence unchanged · apps/vscode/tests/unit/spec-viewer/extractBlock.spec.ts

**Checkpoint**: a comment on a code line quotes that line only.

## Phase 5: User Story 4 - the part and the check (P2)

Files: `scripts/check_plan.py`, `tests/test_check_plan.py`, `presets/_parts/code-pins.md`, `.specify/companion/nodes/code-pins.md`, `docs/code-pins.md`, `docs/node-model.md`, `scripts/package-manifest.py`, `tests/test_packaging.py`

**Wave 1 — independent (different files):**

- [x] **T011** [P] [US4] Code block grammar and checks: missing file, range, body length, grammar, budgets, drifted text; read `tasks.md` too · apps/speckit-extension/scripts/check_plan.py
- [x] **T012** [P] [US4] The `code-pins` part, with the check recorded by `--verify-run` · apps/speckit-extension/presets/_parts/code-pins.md
- [x] **T013** [P] [US4] The docs page: turn it on, grammar, check rules · apps/speckit-extension/docs/code-pins.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T014** [P] [US4] Tests for every rule and for a plan with no block · apps/speckit-extension/tests/test_check_plan.py
- [x] **T015** [P] [US4] Mirror the part · .specify/companion/nodes/code-pins.md
- [x] **T016** [P] [US4] Name the part beside call-paths, and keep packaging and its test true · apps/speckit-extension/docs/node-model.md

**Checkpoint**: the check catches a bad citation and an oversized sketch.

## Phase 6: Polish

- [x] **T017** [P] Changelog entry and README section for the spec-kit extension · apps/speckit-extension/CHANGELOG.md
- [x] **T018** [P] Changelog entry for the viewer · CHANGELOG.md
- [x] **T019** [P] Add the part to the hooks page on the site · apps/website/src/content/docs/docs/customize/hooks.mdx
- [x] **T020** Rebuild the Copilot board's copy with `npm run canvas:build` · apps/copilot-canvas/vendor/viewer-markdown.mjs
- [x] **T021** Run `npx jest`, the Python tests, `build.py --check` and `check_shape_parity.py` · specs/634-plan-code-block/tasks.md

## Dependencies & Execution Order

Foundational blocks every story. Stories 1 to 4 own disjoint files and can run in any order after it. Polish runs last, and T020 needs the viewer and the styles finished. Inside Foundational, T003 waits for T001 and T002. Inside story 4, the tests, the mirror and the docs links wait for the check and the part.
