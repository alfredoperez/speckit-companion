# Tasks: Record and show Spec Kit's converge step

**Input**: [converge-step.spec.md](./converge-step.spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/converge-hooks.md](./contracts/converge-hooks.md)

> **Scale note**: about 30 files across the shared step vocabulary, the spec-kit extension scripts and hook commands, the editor's readers and the viewer. Watch that every reader treating implement as last also treats converge as implement, and that the gated command inventories (`extension.yml`, README, `docs/commands.md`, `.registry`) move together.

## Phase 1: Setup

No setup work: the worktree already has dependencies and the dev install.

## Phase 2: Foundational (blocks every story)

**Wave 1 — independent (different files):**
- [x] **T001** [P] Add `converge` to `StepName` and `STEP_NAMES` after `implement`, make `STEP_STATUS` partial so converge owns no status, and add `lifecycleStepFor(step)` returning `implement` for converge · apps/vscode/src/core/types/specContext.ts
- [x] **T002** [P] Add `converge` to the `currentStep` and history `step` enums · apps/vscode/src/core/types/spec-context.schema.json
- [x] **T003** [P] Add `converge` to `CANONICAL_STEPS` and `STEP_ORDER` (6), and make `_is_more_advanced` refuse a converge write only at `completed`/`archived` · apps/speckit-extension/scripts/spec_context.py
- [x] **T004** [P] Add the `Converge` label to the per-step label map · apps/vscode/src/features/specs/lastTransition.ts

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**
- [x] **T005** [P] Pin the history step enum against `STEP_NAMES` and the Python mirror including converge · apps/vscode/src/core/types/__tests__/specContextSchema.consistency.test.ts
- [x] **T006** [P] Iterate only prompt steps when rendering every preamble, so converge does not reach the preamble's step maps · apps/vscode/src/ai-providers/__tests__/promptPreambleSelfClose.test.ts

## Phase 3: User Story 1 - A converge run is recorded like any other step (P1)

Files: apps/speckit-extension/commands/speckit.companion.before-converge.md, apps/speckit-extension/commands/speckit.companion.after-converge.md, apps/speckit-extension/extension.yml, apps/speckit-extension/README.md, apps/speckit-extension/docs/commands.md, apps/speckit-extension/scripts/check_capture.py, apps/speckit-extension/scripts/check_quality.py, apps/speckit-extension/tests/test_custom_steps.py, .specify/extensions/.registry, .specify/extensions.yml

### Tests
- [x] **T007** [US1] Converge start and finish at `implemented` are written with status unchanged and `currentStep` converge, a repeat adds nothing, and both are refused at `completed` · apps/speckit-extension/tests/test_custom_steps.py

### Implementation

**Wave 1 — independent (different files):**
- [x] **T008** [P] [US1] Write the before-converge capture command (start, no status, never fails) · apps/speckit-extension/commands/speckit.companion.before-converge.md
- [x] **T009** [P] [US1] Write the after-converge capture command (finish, no status, never fails) · apps/speckit-extension/commands/speckit.companion.after-converge.md
- [x] **T010** [P] [US1] Add `converge` to the fallback step list · apps/speckit-extension/scripts/check_capture.py

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**
- [x] **T011** [P] [US1] Declare both commands and the `before_converge`/`after_converge` hooks · apps/speckit-extension/extension.yml
- [x] **T012** [P] [US1] Add `converge` to the parity port's step order and both commands to the never-prompt roster · apps/speckit-extension/scripts/check_quality.py
- [x] **T013** [P] [US1] Add both hooks to the hook table · apps/speckit-extension/README.md
- [x] **T014** [P] [US1] Add both hooks to the family table, the lifecycle hook table, a section each, and `converge` to the `--step` row · apps/speckit-extension/docs/commands.md

**⟶ Wait for Wave 2 to finish, then:**
- [x] **T015** [US1] Reinstall the dev extension and keep only the converge additions in the committed registry and hook file; run `check-command-emissions.py`, `package-manifest.py --check`, `build.py --check` · .specify/extensions/.registry, .specify/extensions.yml

**Checkpoint**: a stock `/speckit.converge` run records its start and finish through the hooks.

## Phase 4: User Story 2 - The viewer shows converge running and how long it took (P1)

Files: apps/vscode/webview/src/spec-viewer/stepInFlight.ts, apps/vscode/webview/src/spec-viewer/components/StepTab.tsx, apps/vscode/src/features/specs/stepHistoryDerivation.ts, apps/vscode/webview/src/spec-viewer/components/StepTab.stories.tsx, apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx

### Tests
- [x] **T016** [P] [US2] `isConvergeInFlight` reads a converge start with no finish as running at `implemented`, and not once finished or shipped · apps/vscode/webview/src/spec-viewer/__tests__/stepInFlight.test.ts
- [x] **T017** [P] [US2] The percent host shows the sync glyph, a `converge` label and the timer while converge runs, and none once it finishes · apps/vscode/webview/src/spec-viewer/components/__tests__/StepTab.test.tsx
- [x] **T018** [P] [US2] A trusted converge after implement extends the total, an untrusted one does not, a run without converge is unchanged, and the Overview lists Converge after Implement · apps/vscode/src/features/specs/__tests__/stepHistoryDerivation.test.ts, apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx

### Implementation

**Wave 1 — independent (different files):**
- [x] **T019** [P] [US2] Add `isConvergeInFlight` (history-based, ignores the settled status) · apps/vscode/webview/src/spec-viewer/stepInFlight.ts
- [x] **T020** [P] [US2] Count a trusted converge span that starts at or after the last expected phase's end in the total, and move `endedAt` to its finish · apps/vscode/src/features/specs/stepHistoryDerivation.ts

**⟶ Wait for Wave 1 to finish, then:**
- [x] **T021** [US2] Host converge on the percent host: glyph, `converge` label, elapsed timer from converge's start · apps/vscode/webview/src/spec-viewer/components/StepTab.tsx

**⟶ Wait, then:**

**Wave 3 — independent (different files):**
- [x] **T022** [P] [US2] Add a story with converge in flight on the Tasks entry · apps/vscode/webview/src/spec-viewer/components/StepTab.stories.tsx
- [x] **T023** [P] [US2] Add an Overview story with a measured Converge phase after Implement · apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx

**Checkpoint**: the viewer shows converge on the rail and in the Overview.

## Phase 5: User Story 3 - Converge never strands a finished spec (P2)

Files: apps/vscode/src/features/specs/specContextReconciler.ts, apps/vscode/src/features/spec-viewer/footerActions.ts, apps/vscode/src/features/specs/stepLifecycle.ts, apps/vscode/src/features/spec-viewer/runRecovery.ts, apps/vscode/src/features/spec-viewer/stepCompletionNotifier.ts, apps/vscode/src/features/specs/specsSortMode.ts, apps/speckit-extension/scripts/status-context.py, apps/speckit-extension/scripts/doctor_checks.py

### Tests
- [x] **T024** [P] [US3] Reconcile leaves `currentStep: converge` at `implemented` alone and the drift check accepts converge after implement and implement after converge · apps/vscode/src/features/specs/__tests__/specContextReconciler.test.ts
- [x] **T025** [P] [US3] Footer at `implemented` with converge current offers Mark Completed and Archive and no Regenerate; at `implementing` converge offers no Approve · apps/vscode/src/features/spec-viewer/__tests__/footerActions.test.ts
- [x] **T026** [P] [US3] Status with `currentStep: converge` and open tasks names the next task; with none says Pipeline complete · apps/speckit-extension/tests/test_context.py
- [x] **T027** [P] [US3] Notifier reads "Converge complete" and run recovery has a converge threshold · apps/vscode/src/features/spec-viewer/__tests__/stepCompletionNotifier.test.ts, apps/vscode/src/features/spec-viewer/__tests__/runRecovery.test.ts

### Implementation

**Wave 1 — independent (different files):**
- [x] **T028** [P] [US3] Read converge as implement in the rollback and drift checks · apps/vscode/src/features/specs/specContextReconciler.ts
- [x] **T029** [P] [US3] Treat converge like implement in the Approve gate and hide Regenerate for converge · apps/vscode/src/features/spec-viewer/footerActions.ts
- [x] **T030** [P] [US3] Reactivate maps converge to implement's in-flight status · apps/vscode/src/features/specs/stepLifecycle.ts
- [x] **T031** [P] [US3] Add the converge quiet threshold · apps/vscode/src/features/spec-viewer/runRecovery.ts
- [x] **T032** [P] [US3] Add the Converge label · apps/vscode/src/features/spec-viewer/stepCompletionNotifier.ts
- [x] **T033** [P] [US3] Rank converge with implement · apps/vscode/src/features/specs/specsSortMode.ts
- [x] **T034** [P] [US3] Know converge's position and report the next unticked task for it · apps/speckit-extension/scripts/status-context.py
- [x] **T035** [P] [US3] Add converge to the extension-stamped steps and give an in-flight converge at `implemented` the dangling grace · apps/speckit-extension/scripts/doctor_checks.py

**Checkpoint**: a spec that ran converge still completes, reads right in status, and is not rewritten by the editor.

## Phase 6: Polish

**Wave 1 — independent (different files):**
- [x] **T036** [P] Replace the stale converge note and relate converge to living-drift and living-sync · apps/speckit-extension/docs/living-specs.md
- [x] **T037** [P] Fold converge into the run-record living specs · capabilities/run-record/record-a-run.spec.md, capabilities/run-record/see-where-a-spec-stands.spec.md
- [x] **T038** [P] Fold converge into the viewer living specs · capabilities/spec-viewer/move-a-spec-forward.spec.md, capabilities/spec-viewer/see-what-the-run-recorded.spec.md
- [x] **T039** [P] Add the user-facing changelog lines · CHANGELOG.md, apps/speckit-extension/CHANGELOG.md

**⟶ Wait for Wave 1 to finish, then:**
- [x] **T040** Validate against the Success Criteria: full `npx jest`, `npm run compile`, `npx tsc -p tsconfig.webview.json --noEmit`, the extension's python unittest suite, the CI gate scripts, `living_validate.py` and `drift.py --since main --working`

## Dependencies & Execution Order

- Setup (empty) → Foundational → US1, US2, US3 (disjoint files, any order) → Polish.
- Foundational: Wave 1 (T001–T004) blocks Wave 2 (T005–T006).
- US1: T007 tests; Wave 1 (T008–T010) blocks Wave 2 (T011–T014), which blocks T015.
- US2: tests T016–T018; Wave 1 (T019–T020) blocks T021, which blocks the stories T022–T023.
- US3: tests T024–T027; one wave T028–T035.
- Polish: Wave 1 (T036–T039) blocks T040.
