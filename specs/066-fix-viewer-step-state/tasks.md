# Tasks: Fix Viewer Step State

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-13

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add `viewedStep` to derivation context types — `src/core/types/specContext.ts` | R001, R002
  - **Do**: Add optional `viewedStep?: StepName` to the derivation input type used by `ViewerState`. Keep `ViewerState` output shape; document that `highlights` must gate on step document existence.
  - **Verify**: `npm run compile` passes; no runtime behavior change yet.
  - **Leverage**: existing `StepName` union and `ViewerState` interface in same file.

- [x] **T002** Gate highlights on doc existence and accept `viewedStep` *(depends on T001)* — `src/features/spec-viewer/stateDerivation.ts` | R002, R003, R004
  - **Do**: In `deriveHighlights`, filter out any step whose document does not exist even if `isStepCompleted` returns true. Thread `viewedStep` through and expose an `activeStep` signal that prefers `viewedStep` when set.
  - **Verify**: Unit test — spec with `plan` completed but `plan.md` missing → `highlights` omits `plan`.
  - **Leverage**: existing `isStepCompleted` and file-existence helpers already used in derivation.

- [x] **T003** Make `computeBadgeText` viewed-step aware *(depends on T002)* — `src/features/spec-viewer/phaseCalculation.ts` | R001, NFR002
  - **Do**: Accept optional `viewedStep`. When `viewedStep && viewedStep !== currentStep`, compute label from that step's own state (e.g., "PLAN COMPLETE", "TASKS NOT STARTED") instead of current progress. Keep function pure.
  - **Verify**: Unit tests — (viewed=plan, current=tasks in-progress) → "PLAN COMPLETE"; (viewed=tasks, tasks.md missing) → not-started label; viewed===current unchanged.

- [x] **T004** Evaluate footer `visibleWhen` against viewed step *(depends on T003)* — `src/features/spec-viewer/footerActions.ts` | R005
  - **Do**: Update `visibleWhen(ctx, step)` callers to pass `viewedStep` when set so review-appropriate buttons (Regenerate / Archive) surface for earlier completed steps rather than Mark Completed for current.
  - **Verify**: Unit test — viewing completed plan while tasks in-progress returns review actions for plan, not tasks actions.

- [x] **T005** Track `viewedStep` in provider and re-post ViewerState *(depends on T004)* — `src/features/spec-viewer/specViewerProvider.ts`, `src/features/spec-viewer/messageHandlers.ts` | R001, R005
  - **Do**: Add `viewedStep` panel-state field. In `handleStepperClick`, update it and re-run derivation + `postMessage('viewerState', …)`. On watcher-triggered context refresh that advances the workflow, reset `viewedStep` to `currentStep` (risk mitigation).
  - **Verify**: Run extension (F5); click Plan tab on a spec mid-Tasks — ViewerState message includes new `viewedStep` and updated badge/highlights.
  - **Leverage**: existing `stepperClick` handler and `postViewerState` path.

- [x] **T006** Render viewed-vs-active distinction in tabs *(depends on T005)* — `webview/src/spec-viewer/components/StepTab.tsx`, `webview/src/spec-viewer/components/NavigationBar.tsx`, `webview/src/spec-viewer/signals.ts` | R003, R006
  - **Do**: Checkmark only when `vsCompleted && stepDocExists`. Add `reviewing` class when `phase === viewedStep && phase !== currentStep`. Mirror `viewedStep` in signals from incoming `ViewerState`.
  - **Verify**: Load extension, click completed Plan tab while on Tasks — Plan tab shows `reviewing` styling, Tasks keeps `working`, uncreated future step shows no check.

- [x] **T007** Add `reviewing` indicator style *(depends on T006)* — `webview/styles/spec-viewer/` | R006
  - **Do**: Add subtle style (border/opacity) for `.reviewing` on step tab so users see context has shifted from active step.
  - **Verify**: Visual check in dev host.

- [x] **T008** Update docs — `docs/viewer-states.md`, `README.md` | R001–R006
  - **Do**: Document viewed-step behavior: badge text, highlight gating on doc existence, reviewing indicator, footer action resolution. Note `viewedStep` in the viewer state data flow.
  - **Verify**: Manual read — scenarios from spec.md are covered.

---

## Progress

- Phase 1: T001–T008 [ ]
