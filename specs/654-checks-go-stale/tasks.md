# Tasks: A check says what code it ran on, and when that code moved

## Phase 1: Setup

None.

## Phase 2: Foundational

Files: `apps/vscode/src/core/types/specContext.ts`, `apps/vscode/src/features/living-specs/livingSpecsModel.ts`

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US2] `commit`, `tree`, `changedSince` on `ViewerVerification` · apps/vscode/src/core/types/specContext.ts
- [x] **T002** [P] [US2] Export `GitRunner` and `makeDefaultGitRunner` · apps/vscode/src/features/living-specs/livingSpecsModel.ts

## Phase 3: User Story 1 - Record the code a check ran on (P1)

Files: `apps/speckit-extension/scripts/capture.py`, `apps/speckit-extension/tests/test_verify_run.py`

- [x] **T003** [US1] `run_verification` records `commit` and a temp-index `tree` after the command, never failing · apps/speckit-extension/scripts/capture.py
- [x] **T004** [US1] Tests: a git sandbox with an uncommitted file records both; outside git records neither; the real index is untouched · apps/speckit-extension/tests/test_verify_run.py

**Checkpoint**: run checks carry the code they ran on.

## Phase 4: User Story 2 - See when a check is out of date (P1)

Files: `apps/vscode/src/features/spec-viewer/stateDerivation.ts`, `apps/vscode/src/features/spec-viewer/checkFreshness.ts`, `apps/vscode/src/features/spec-viewer/specViewerProvider.ts`, `apps/vscode/src/features/spec-viewer/__tests__/checkFreshness.test.ts`, `apps/vscode/src/features/spec-viewer/__tests__/verifiedProvenance.test.ts`, `apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx`, `apps/vscode/webview/styles/spec-viewer/_overview-dossier.css`, `apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx`, `apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx`

**Wave 1 — independent (different files):**

- [x] **T005** [P] [US2] `pickVerified` passes hex-checked `commit`/`tree` for derived checks; `markStaleChecks(verified, counts)` · apps/vscode/src/features/spec-viewer/stateDerivation.ts
- [x] **T006** [P] [US2] `filesChangedSince(root, tree, git)`: tracked diff plus untracked files the tree lacks, excluding specs and .specify · apps/vscode/src/features/spec-viewer/checkFreshness.ts
- [x] **T007** [P] [US2] Verified rows: `at <commit>`, OUT OF DATE pill, amber line, section tone · apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx
- [x] **T008** [P] [US2] Stale row tint, pill, meta line; narrow rules · apps/vscode/webview/styles/spec-viewer/_overview-dossier.css

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T009** [P] [US2] Enrichment beside `markMissingTests`: one git round per distinct tree, then `markStaleChecks` · apps/vscode/src/features/spec-viewer/specViewerProvider.ts
- [x] **T010** [P] [US2] Tests for `filesChangedSince` and `markStaleChecks` with an injected runner · apps/vscode/src/features/spec-viewer/__tests__/checkFreshness.test.ts
- [x] **T011** [P] [US2] Provenance tests: commit/tree pass for derived only, non-hex dropped · apps/vscode/src/features/spec-viewer/__tests__/verifiedProvenance.test.ts
- [x] **T012** [P] [US2] Story with a current check, a stale one and a reported one · apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx
- [x] **T013** [P] [US2] VerifiedSection tests: at-commit line, OUT OF DATE with count, one-file wording, tone, legacy unchanged · apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx

**Checkpoint**: a check followed by a code edit reads out of date.

## Phase 5: Polish

- [x] **T014** Canvas vendor rebuild and clip recapture; commit only images that changed
- [x] **T015** Extend the two #963 changelog lines with this PR
- [x] **T016** Validate: `tsc`, Jest, canvas and Python suites, build check, emissions, manifest

## Dependencies & Execution Order

- Foundational → Phase 3 and Phase 4 (disjoint) → Polish.
- Phase 4: Wave 1 blocks Wave 2.
