# Spec: Step tab sync glyph + locked in-flight clearing (#229)

## Overview

The spec-viewer header shows a step tab as "in progress" while the AI is running that step. Issue #229 asks for two things: (1) confirm the in-flight indicator clears the moment a step's completion lands in `.spec-context.json` — no manual refresh, with the timer stopping and the badge advancing — and (2) replace the in-flight visual from a filled circle to a looping-arrows / sync glyph that communicates "actively working" and disappears when the step completes. Investigation found the state-clearing behavior already works in `main` (derivation + re-render both correct); this change therefore locks that behavior with regression tests and delivers the outstanding icon swap.

## Functional Requirements

- **FR-001** The in-flight step-tab indicator MUST render a looping-arrows / sync glyph (VS Code codicon `sync`) with a continuous spin animation while a step is running, instead of the previous filled circle.
- **FR-002** The sync glyph MUST use VS Code theme variables for its color so it adapts to light/dark/high-contrast themes.
- **FR-003** The sync glyph MUST disappear the moment the step completes — when the tab's canonical state is no longer `in-flight` (i.e. `completedAt` is recorded or `activeStep` no longer points at the step).
- **FR-004** A step whose completion is recorded in `.spec-context.json` (status advanced, a `kind: "complete"` entry written) MUST render as done (checkmark) without any manual refresh, reopen, or reload — regardless of whether the completing entry's `by` is `"ai"` or `"extension"`.
- **FR-005** The step's elapsed timer MUST stop (unmount) when the step completes; it MUST keep counting only while the step is genuinely in flight.
- **FR-006** The header status badge MUST advance to the completed wording (e.g. PLANNING → PLANNED) as soon as the completion lands, driven by the same refreshed viewer state as the tabs.
- **FR-007** A step that is genuinely still running (started, no completion recorded) MUST continue to show the in-flight sync glyph and running timer — no regression to live feedback.
- **FR-008** The implement-step percentage pill (e.g. `60%`) MUST retain its existing in-flight pill styling; the sync glyph applies to the empty (non-percentage) in-flight indicator used by specify/plan/tasks.
- **FR-009** The StepTab stories MUST include an in-flight state that demonstrates the new sync glyph.
- **FR-010** `docs/viewer-states.md` MUST document the step-tab in-flight visual (sync glyph) and when in-flight clears.

## Success Criteria

- **SC-001** Given a `.spec-context.json` with an AI-authored step-level `complete` entry for a step and `currentStep` still pointing at it, the derived per-step history records a non-null `completedAt` and `findRunningStep` returns no running step for that step (100% of such fixtures).
- **SC-002** Re-rendering the NavigationBar with a fresh navState carrying that completion flips the affected tab from `in-flight` to `done` with a checkmark, with no reopen.
- **SC-003** The in-flight tab renders an element bearing the `codicon-sync` class (or equivalent sync-glyph marker) and no longer renders the filled-circle-only indicator for empty in-flight steps.
- **SC-004** A genuinely-running step (started, no completion) still renders the in-flight sync glyph and the elapsed timer.
- **SC-005** `npm run compile`, `npm run compile-web`, and `npm test` all pass clean.

## Assumptions

- The state-clearing logic in `stepHistoryDerivation.ts` / `stateDerivation.ts` / `specViewerProvider.refreshContextIfDisplaying` is already correct (verified during investigation); the only code defect to fix is the missing sync-glyph visual. Regression tests are added to lock the clearing behavior so a future change can't silently break it.
- The webview already loads the VS Code codicon font (SpecHeader uses `codicon codicon-git-branch`) and `_animations.css` already defines a `spin` keyframe, so the glyph + spin need no new asset.
- The sync glyph replaces only the empty in-flight `.step-status` content; the implement-step percentage pill path is left unchanged.
