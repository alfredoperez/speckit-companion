# Tasks: An opt-in mutation check marks weak requirements

## Phase 1: Setup

None.

## Phase 2: User Story 1 - Read the report (P1)

Files: `apps/speckit-extension/scripts/capture.py`, `apps/speckit-extension/scripts/write-context.py`, `apps/speckit-extension/tests/test_mutation_report.py`, `apps/speckit-extension/tests/fixtures/mutation/`, `apps/speckit-extension/nodes/implement/record-verified.md`, `apps/speckit-extension/nodes/implement/complete.md`, `apps/speckit-extension/commands/speckit.companion.implement.md`

- [x] **T001** [US1] `apply_mutation_report`: parse Stryker or mutmut, Verified row, weak marks set and cleared in one write · capture.py
- [x] **T002** [US1] `--mutation-report PATH`, declined on an unreadable report · write-context.py
- [x] **T003** [US1] Record node step 9, gated on `mutation.enabled`; close step renumbered 10; body rebuilt · record-verified.md, complete.md
- [x] **T004** [US1] Tests with a Stryker fixture (one weak, one strong, one not run), a report without testFiles, a mutmut summary, a newer report clearing a mark, a bad file · test_mutation_report.py, fixtures/mutation/

## Phase 3: User Story 2 - Show weak requirements (P1)

Files: `apps/vscode/src/core/types/specContext.ts`, `apps/vscode/src/core/types/spec-context.schema.json`, `apps/vscode/src/features/spec-viewer/stateDerivation.ts`, `apps/vscode/webview/src/spec-viewer/coverageState.ts`, `apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx`, `apps/vscode/webview/styles/spec-viewer/_overview-dossier.css`, `apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx`, `apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx`, `apps/vscode/src/features/spec-viewer/__tests__/stateDerivation.test.ts`

- [x] **T005** [US2] `weak` on CoverageEntry, ViewerCoverageRow and the schema; `pickCoverage` reads it · specContext.ts, schema, stateDerivation.ts
- [x] **T006** [US2] `weak` state (missing > weak > tested > assumed > untraced); Weak label and line; ordering keeps weak rows; amber dot · coverageState.ts, OverviewDossier.tsx, _overview-dossier.css
- [x] **T007** [US2] Tests and a story · OverviewDossier.test.tsx, stateDerivation.test.ts, ActivityPanel.stories.tsx

## Phase 4: Polish

- [x] **T008** Document `risk` and `mutation` in the `companion.yml` keys table · apps/website/src/content/docs/docs/customize/workflow-builder.mdx
- [x] **T009** Canvas vendor rebuild, clip recapture, changelog lines
- [x] **T010** Validate: `tsc`, Jest, canvas and Python suites, build check, budget, emissions, manifest

## Dependencies & Execution Order

Phases 2 and 3 are disjoint and run together; Polish follows.
