# Plan: Fix Viewer Step State

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-13

## Approach

Make header badge, step-tab highlights, sidebar checkmarks, and footer actions reflect the *viewed* step rather than the spec's `currentStep`. Thread a `viewedStep` through `ViewerState` derivation so `computeBadgeText`, `deriveHighlights`, and footer `visibleWhen` all compute against the viewed step while keeping the active/working indicator on the true `currentStep`. No schema changes, no extra I/O — purely a derivation/rendering fix.

## Technical Context

**Stack**: TypeScript 5.3+, VS Code Extension API, Preact (webview)
**Constraints**: No additional file I/O per tab click; badge text function stays pure.

## Files

### Create

- (none)

### Modify

- `src/core/types/specContext.ts` — add optional `viewedStep?: StepName` input to derivation context; keep `ViewerState` shape but ensure `highlights` gates on step document existence.
- `src/features/spec-viewer/stateDerivation.ts` — accept `viewedStep`; `deriveHighlights` uses `isStepCompleted` AND filters out steps whose document doesn't exist (per R003); expose viewed-step-aware `activeStep` signal for tabs.
- `src/features/spec-viewer/phaseCalculation.ts` — `computeBadgeText` takes optional `viewedStep`; when present and different from `currentStep`, produce label from that step's state (completed / not-started) rather than current progress.
- `src/features/spec-viewer/footerActions.ts` — `visibleWhen(ctx, step)` evaluates against `viewedStep` when provided so review-appropriate actions show (R005).
- `src/features/spec-viewer/specViewerProvider.ts` — track `viewedStep` in panel state; pass to derivation on each `stepperClick`; re-post `ViewerState` to webview.
- `src/features/spec-viewer/messageHandlers.ts` — `handleStepperClick` updates `viewedStep` and triggers re-derivation.
- `webview/src/spec-viewer/components/StepTab.tsx` — checkmark only when `vsCompleted && stepDocExists`; add `reviewing` class when `phase === viewedStep && phase !== currentStep` (R006).
- `webview/src/spec-viewer/components/NavigationBar.tsx` — reflect viewed vs active distinction visually.
- `webview/src/spec-viewer/signals.ts` — expose `viewedStep` signal mirrored from `ViewerState`.
- `webview/styles/spec-viewer/*.css` — minor `reviewing` indicator style.

## Testing Strategy

- **Unit**: `computeBadgeText` — cover (viewed=plan, current=tasks/in-progress) → "PLAN COMPLETE"; (viewed=tasks, tasks.md missing) → not-started label; viewed===current keeps existing behavior.
- **Unit**: `deriveHighlights` — excludes step whose doc doesn't exist even if inferred completed.
- **Unit**: `footerActions.visibleWhen` — evaluated against viewed step returns review actions.
- **Edge cases**: spec R001–R004 scenarios from spec.md.

## Risks

- Webview state drift between `viewedStep` and `currentStep` on async file reloads: reset `viewedStep` to `currentStep` when a watcher triggers a context refresh that advances the workflow.
