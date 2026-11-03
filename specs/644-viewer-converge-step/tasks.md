# Tasks: The viewer shows converge as its own step

**Scale note**: 18 tasks over about 25 files in three areas: the writer, the host's viewer state and footer, and the webview. Phase 2 sets the record field, the types and the one derivation; every later phase only reads `ViewerState.converge`. User Stories 1 and 2 share one phase because both draw in `OverviewDossier.tsx`. User Story 4 (per-round implement times) is deferred by the plan and has no tasks.

## Phase 1: Setup

No setup: every file exists or is created by its owning task.

## Phase 2: Foundational

Files: `apps/speckit-extension/scripts/write-context.py`, `apps/speckit-extension/tests/test_converge_passes.py`, `apps/vscode/src/core/types/specContext.ts`, `apps/vscode/webview/src/spec-viewer/types.ts`, `apps/vscode/src/core/utils/taskCheckboxes.ts`, `apps/vscode/src/core/constants.ts`, `apps/vscode/src/features/spec-viewer/convergeResult.ts`, `apps/vscode/src/features/spec-viewer/__tests__/convergeResult.test.ts`, `apps/vscode/src/features/spec-viewer/specViewerProvider.ts`

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US1] Record each converge pass: the start hook appends `{startedAt, by, before}` to `convergePasses`; the finish hook fills the last open pass with `finishedAt`, `added`, `completed` and drops `before`; `_complete_after_clean_converge` uses the id rule when the open pass has a snapshot and keeps the mtime rule otherwise; record the pass on a completed spec too; merge, one lock, never-fail · `apps/speckit-extension/scripts/write-context.py`
- [x] **T002** [P] [US1] Type `convergePasses` on `SpecContext`, and the converge result (outcome, passes, addedTasks with id/title/checked, openAdded) on the host `ViewerState` and its webview mirror · `apps/vscode/src/core/types/specContext.ts`, `apps/vscode/webview/src/spec-viewer/types.ts`
- [x] **T003** [P] [US1] Add `taskTitle(rawLine)` beside `taskId`, reading the raw line after the id so backticked text survives · `apps/vscode/src/core/utils/taskCheckboxes.ts`
- [x] **T004** [P] [US3] Add footer ids `IMPLEMENT_GAPS: 'implement-gaps'` and `OPEN_TASKS: 'open-tasks'` · `apps/vscode/src/core/constants.ts`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T005** [P] [US1] Tests for the writer: a pass that appends ids records them as `added`; a pass that adds none records `[]` and completes the spec; a reworded-only pass completes; a pass started before this change (no `before`) has no `added`; a pass on a completed spec is recorded and keeps the concern; a failing pass write never fails the hook · `apps/speckit-extension/tests/test_converge_passes.py`
- [x] **T006** [P] [US1] `deriveConvergeResult(ctx, tasksContent)`: coerce `convergePasses` defensively, outcome from the latest pass (running when unfinished, unknown without `added`), pass rows with durations, added tasks still in tasks.md with titles and checked state, `openAdded`; returns `undefined` when converge never ran · `apps/vscode/src/features/spec-viewer/convergeResult.ts`

**⟶ Wait for Wave 2 to finish, then:**

- [x] **T007** [P] [US1] Tests for `deriveConvergeResult`: gaps, clean, unknown, running, a deleted added task, malformed passes, no passes · `apps/vscode/src/features/spec-viewer/__tests__/convergeResult.test.ts`
- [x] **T008** [P] [US1] `readViewerState` reads tasks.md when passes exist and attaches `converge` to the viewer state · `apps/vscode/src/features/spec-viewer/specViewerProvider.ts`

## Phase 3: User Stories 1 and 2 - converge in the overview (P1)

Files: `apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx`, `apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx`, `apps/vscode/webview/styles/spec-viewer/_overview-dossier.css`, `apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx`

**Goal**: the overview tells a spec sent back by converge from one a clean converge completed.

**Independent Test**: render the overview with a gaps result and with a clean result; read the pill, the waiting round and the card.

### Tests

- [x] **T009** [P] [US1] [US2] Overview tests: amber pill with duration and "3 gaps" plus "round 2, waiting"; "CONVERGE FOUND 3 GAPS" card with chips and titles; singular "1 GAP"; green "2 passes · clean" and "clean" for one pass; the clean card's PASS and COMPLETED rows; amber on a completed spec whose last pass added tasks; nothing when converge never ran; a title with markup renders as text · `apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T010** [P] [US1] [US2] Converge pill in `OverviewTiming`, the round-waiting phase after it, and `ConvergeCard` (gaps and clean) under the timing row, all reading `state.converge` · `apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx`
- [x] **T011** [P] [US1] [US2] Pill and card styles from tokens only: `--warning`/`--warning-subtle`, `--success`/`--success-subtle`, `--text-body`; task id chips match the coverage chips; wraps at narrow widths · `apps/vscode/webview/styles/spec-viewer/_overview-dossier.css`
- [x] **T012** [P] [US1] [US2] Stories: converge found gaps, clean converge completed · `apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx`

**Checkpoint**: the overview shows both converge outcomes from `ViewerState.converge`.

## Phase 4: User Story 3 - act on the result anywhere (P2)

Files: `apps/vscode/webview/src/spec-viewer/components/RunStrip.tsx`, `apps/vscode/webview/src/spec-viewer/components/RunStrip.stories.tsx`, `apps/vscode/webview/src/spec-viewer/components/StepTab.tsx`, `apps/vscode/webview/src/spec-viewer/components/StepTab.stories.tsx`, `apps/vscode/webview/src/spec-viewer/components/NavigationBar.tsx`, `apps/vscode/webview/src/spec-viewer/components/footer/CatalogFooter.tsx`, `apps/vscode/webview/src/spec-viewer/components/FooterActions.stories.tsx`, `apps/vscode/webview/styles/spec-viewer/_navigation.css`, `apps/vscode/src/features/spec-viewer/footerActions.ts`, `apps/vscode/src/features/spec-viewer/stateDerivation.ts`, `apps/vscode/src/features/spec-viewer/messageHandlers.ts`, `apps/vscode/src/features/spec-viewer/__tests__/footerActions.test.ts`, `apps/vscode/src/features/spec-viewer/__tests__/footerMatrix.fixtures.ts`, `apps/vscode/webview/src/spec-viewer/components/__tests__/RunStrip.test.tsx`, `apps/vscode/webview/src/spec-viewer/components/__tests__/StepTab.test.tsx`

**Goal**: the header, the rail and the footer carry the same converge count and the next action.

**Independent Test**: with a gaps result, check the fact, the "+N" badge and the footer; then a cleanly completed spec.

### Tests

- [x] **T013** [P] [US3] Footer tests and matrix rows: `implement-gaps` primary and `open-tasks` while `openAdded > 0`, Mark Completed hidden, singular label at one, "Converge again" on a cleanly completed spec · `apps/vscode/src/features/spec-viewer/__tests__/footerActions.test.ts`, `apps/vscode/src/features/spec-viewer/__tests__/footerMatrix.fixtures.ts`
- [x] **T014** [P] [US3] Webview tests: run-strip fact "3 added by converge" and "converge clean"; "+N" badge on Tasks, hidden at zero; the same count in fact, badge and button · `apps/vscode/webview/src/spec-viewer/components/__tests__/RunStrip.test.tsx`, `apps/vscode/webview/src/spec-viewer/components/__tests__/StepTab.test.tsx`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T015** [P] [US3] Host footer: pass the converge result from `deriveViewerState` into `getFooterActions`; add the two actions with the count label, hide Mark Completed, relabel Converge; handlers dispatch implement for this spec and switch to tasks · `apps/vscode/src/features/spec-viewer/footerActions.ts`, `apps/vscode/src/features/spec-viewer/stateDerivation.ts`, `apps/vscode/src/features/spec-viewer/messageHandlers.ts`
- [x] **T016** [P] [US3] Webview: run-strip fact, "+N" badge prop through `NavigationBar` to `StepTab` with its style, footer context line "Converge added N tasks" and `implement-gaps` as primary; update the three sibling stories · `RunStrip.tsx`, `RunStrip.stories.tsx`, `StepTab.tsx`, `StepTab.stories.tsx`, `NavigationBar.tsx`, `footer/CatalogFooter.tsx`, `FooterActions.stories.tsx`, `_navigation.css`

**Checkpoint**: fact, badge and footer show one count and the right next action.

## Phase 5: Polish

Files: `CHANGELOG.md`, `apps/speckit-extension/CHANGELOG.md`, `apps/website/src/content/docs/docs/results/the-overview.mdx`, `apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/vendor/viewer.css`, `content/media/` (generated)

**Wave 1 — independent (different files):**

- [x] **T017** [P] One `[Unreleased]` line in each changelog in the voice gate, and the overview page explains the converge pill and cards · `CHANGELOG.md`, `apps/speckit-extension/CHANGELOG.md`, `apps/website/src/content/docs/docs/results/the-overview.mdx`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T018** Validate against the Success Criteria: rebuild the canvas `vendor/viewer.css`, run `npm run clips:capture`, then the speckit-extension Python suite, `build.py --check`, `npx tsc --noEmit -p ./`, the full `npx jest` and `npm run test:canvas` · `apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/vendor/viewer.css`, `content/media/`

## Dependencies & Execution Order

- Setup (none) → Foundational → Phase 3 and Phase 4 side by side → Polish.
- Foundational: Wave 1 (T001 to T004) blocks Wave 2 (T005 writer tests, T006 derivation), which blocks Wave 3 (T007 derivation tests, T008 provider).
- Phase 3: T009 tests first, then T010, T011, T012 together.
- Phase 4: T013 and T014 tests first, then T015 and T016 together.
- Polish: T017, then T018 last.

## Phase 6: Convergence

- [x] T019 Keep Open tasks in the footer on a completed spec whose last converge pass added open tasks, with implement still hidden there, per FR-008 (partial)
