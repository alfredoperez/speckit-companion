# Tasks: Review depth follows a risk tier the code computes

## Phase 1: Setup

None.

## Phase 2: User Story 1 and 2 - Compute and raise the tier (P1)

Files: `apps/speckit-extension/scripts/capture.py`, `apps/speckit-extension/scripts/write-context.py`, `apps/speckit-extension/tests/test_risk_tier.py`, `apps/speckit-extension/nodes/implement/record-verified.md`, `apps/speckit-extension/commands/speckit.companion.implement.md`, `.specify/companion.yml`

- [x] **T001** [US1] `compute_risk`, `set_risk` and `raise_risk`: changed files from the merge base plus untracked, outside the spec folders; default and project globs; tier = max(computed, raised) · apps/speckit-extension/scripts/capture.py

**⟶ Wait for T001, then:**

- [x] **T002** [P] [US1] `--risk` and `--risk-raise TIER REASON`, refusals declined · apps/speckit-extension/scripts/write-context.py
- [x] **T003** [P] [US3] Record node: compute after validation, raise with a reason, review depth per tier; rebuild the body · apps/speckit-extension/nodes/implement/record-verified.md
- [x] **T004** [P] [US3] This repo's review hook follows the tier; `risk.high` lists the renderer, the run-record writer and the publish commands · .specify/companion.yml

**⟶ Wait, then:**

- [x] **T005** [US1] Tests: migration high, docs low, code normal, project glob, no git normal, empty low, raise keeps, lower refused, reasonless refused, recompute keeps · apps/speckit-extension/tests/test_risk_tier.py

## Phase 3: User Story 3 - Show the review depth (P2)

Files: `apps/vscode/src/core/types/specContext.ts`, `apps/vscode/src/core/types/spec-context.schema.json`, `apps/vscode/src/features/spec-viewer/stateDerivation.ts`, `apps/vscode/src/features/spec-viewer/__tests__/stateDerivation.test.ts`, `apps/vscode/webview/src/spec-viewer/types.ts`, `apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx`, `apps/vscode/webview/styles/spec-viewer/_overview-dossier.css`, `apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx`, `apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx`

**Wave 1:**

- [x] **T006** [P] [US3] `RiskEntry`, `risk` on SpecContext and ViewerState, schema · specContext.ts, spec-context.schema.json, webview types.ts
- [x] **T007** [P] [US3] `pickRisk` like `pickClassification` · stateDerivation.ts

**⟶ Wait, then:**

- [x] **T008** [P] [US3] Verified head pill "Review depth: <tier>" and the raised wording; section shows with only a tier · OverviewDossier.tsx, _overview-dossier.css
- [x] **T009** [P] [US3] Tests and stories · stateDerivation.test.ts, OverviewDossier.test.tsx, ActivityPanel.stories.tsx

## Phase 4: Polish

- [x] **T010** Canvas vendor rebuild, clip recapture (commit only real changes), extend the #963 changelog lines
- [x] **T011** Validate: `tsc`, Jest, canvas and Python suites, build check, budget, emissions, manifest

## Dependencies & Execution Order

Phase 2 and Phase 3 are disjoint and run together; Polish follows both.
