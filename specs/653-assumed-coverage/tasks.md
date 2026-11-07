# Tasks: "Assumed" is a coverage state

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## Phase 1: Setup

None.

## Phase 2: Foundational

Files: `apps/speckit-extension/scripts/capture.py`, `apps/speckit-extension/scripts/write-context.py`, `apps/speckit-extension/tests/fixtures/coverage-shape/written.json`, `apps/speckit-extension/tests/fixtures/coverage-shape/expected-rows.json`, `apps/vscode/src/core/types/specContext.ts`, `apps/vscode/src/core/types/spec-context.schema.json`, `apps/vscode/src/features/spec-viewer/stateDerivation.ts`, `apps/vscode/webview/src/spec-viewer/coverageState.ts`

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US1] `upsert_coverage` takes `assumes` (trimmed, blank ignored, replaces the old value, keeps title/tasks/tests); the batch coverage item passes `assumes` · apps/speckit-extension/scripts/capture.py
- [x] **T002** [P] [US2] `assumes?` on `CoverageEntry` and `ViewerCoverageRow` · apps/vscode/src/core/types/specContext.ts
- [x] **T003** [P] [US2] `assumes` in the schema's coverage object · apps/vscode/src/core/types/spec-context.schema.json

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T004** [P] [US1] `--assumes REQ TEXT` flag wired like `--coverage-req` (capture mode, dispatch, declined message, `_CAPTURE_FLAGS`, batch help) · apps/speckit-extension/scripts/write-context.py
- [x] **T005** [P] [US2] `pickCoverage` reads `assumes` · apps/vscode/src/features/spec-viewer/stateDerivation.ts
- [x] **T006** [P] [US2] `isTraced(row)` and `coverageState(row)` (missing, tested, assumed, untraced) · apps/vscode/webview/src/spec-viewer/coverageState.ts
- [x] **T007** [P] [US1] Shared shape fixture gains an assumed row · apps/speckit-extension/tests/fixtures/coverage-shape/written.json, expected-rows.json

## Phase 3: User Story 1 - Record what the code relies on (P1)

Files: `apps/speckit-extension/nodes/implement/record-verified.md`, `apps/vscode/src/ai-providers/promptPreamble.ts`, `apps/speckit-extension/tests/test_capture_fields.py`, `apps/speckit-extension/tests/test_cli_parity.py`

- [x] **T008** [P] [US1] Batch example gains `"assumes"`; one clause on when to record `--assumes <req> "<what>"` · apps/speckit-extension/nodes/implement/record-verified.md
- [x] **T009** [P] [US1] Implement lines in the preamble name `--assumes` · apps/vscode/src/ai-providers/promptPreamble.ts
- [x] **T010** [P] [US1] Upsert tests: assumes alone creates the entry, keeps tasks/tests, replaces, blank ignored, batch equals flag · apps/speckit-extension/tests/test_capture_fields.py
- [x] **T011** [P] [US1] CLI parity matrix gains `assumes` · apps/speckit-extension/tests/test_cli_parity.py

**Checkpoint**: an assumption lands on the record from the flag and the batch, and implement asks for it.

## Phase 4: User Story 2 - See tested, assumed or untraced (P1)

Files: `apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx`, `apps/vscode/webview/styles/spec-viewer/_overview-dossier.css`, `apps/vscode/webview/src/spec-viewer/activityHeroModel.ts`, `apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx`, `apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx`, `apps/vscode/webview/src/spec-viewer/__tests__/activityModels.test.ts`, `apps/vscode/src/features/spec-viewer/__tests__/stateDerivation.test.ts`

**Wave 1 — independent (different files):**

- [x] **T012** [P] [US2] Coverage row uses `coverageState`: Assumed label, assumption line under the requirement, three-bucket order, count from `isTraced` · apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx
- [x] **T013** [P] [US2] `.is-assumed` in `--info` with a ringed dot; assumption line wraps; narrow rules hold · apps/vscode/webview/styles/spec-viewer/_overview-dossier.css
- [x] **T014** [P] [US2] `covered` uses `isTraced` · apps/vscode/webview/src/spec-viewer/activityHeroModel.ts

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T015** [P] [US2] Story: one tested, one tested-with-assumption, one assumed, one untraced (local override, shared state untouched) · apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx
- [x] **T016** [P] [US2] Component tests: Assumed label and text, tests win, missing stays missing, 3/4 traced, legacy unchanged · apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx
- [x] **T017** [P] [US2] Hero stats count an assumed row · apps/vscode/webview/src/spec-viewer/__tests__/activityModels.test.ts
- [x] **T018** [P] [US2] Derivation keeps `assumes`, drops a blank one; shape fixture mapping includes it · apps/vscode/src/features/spec-viewer/__tests__/stateDerivation.test.ts

**Checkpoint**: Coverage and the header strip agree on traced, and assumed rows say why.

## Phase 5: Polish

- [x] **T019** Rebuild command bodies and check them · `build.py`, `build.py --check`, `instruction-budget.py --strict`
- [x] **T020** Regenerate canvas vendor files; recapture clips and commit only images that changed · `npm run canvas:build`, `npm run clips:capture`
- [x] **T021** Extend the two existing changelog lines with this PR · CHANGELOG.md, apps/speckit-extension/CHANGELOG.md
- [x] **T022** Validate: `tsc`, `npm run test:all`, emissions, manifest

## Dependencies & Execution Order

- Foundational → Phase 3 and Phase 4 (disjoint) → Polish.
- Foundational: Wave 1 blocks Wave 2.
- Phase 4: Wave 1 blocks Wave 2.
- Polish: T019 after Phase 3; T020 after Phase 4; T022 last.
