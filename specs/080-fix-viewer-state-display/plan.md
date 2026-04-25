# Plan: Fix Viewer State Display

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-25

## Approach

Three independent, viewer-side derivation fixes wired through the existing `.spec-context.json` → `SpecContext` → `NavState` / `ViewerState` → Preact components pipeline. All changes are read-only at the schema layer (no SDD pipeline writes added) and add no new components — just one new typed field (`workingBranch`), one prop plumbed through (`currentStep`), and a fallback branch in `deriveActiveSubstep`.

## Files to Change

### Modify

- `src/core/types/specContext.ts` — add `workingBranch?: string | null` to the `SpecContext` interface (~line 84) so downstream consumers get a typed field instead of relying on the index signature.
- `src/features/specs/specContextReader.ts` — in `normalizeSpecContext` (~line 67), explicitly preserve `workingBranch` when present (`workingBranch: typeof raw.workingBranch === 'string' ? raw.workingBranch : (raw.workingBranch === null ? null : undefined)`), so legacy and current shapes both flow through cleanly.
- `src/features/spec-viewer/specViewerProvider.ts` —
  - Two branch-chip writes: line ~568 and ~833. Change `featureCtx?.branch ?? null` → `(featureCtx?.workingBranch as string | null | undefined) ?? featureCtx?.branch ?? null`.
  - Two `navState`/`generateHtml` argument lists need a new `currentStep` value derived from `featureCtx?.currentStep ?? doc?.type ?? null`. Already passed at line 570 to `generateHtml`; needs to be added to the `NavState` literal at line ~810.
- `src/features/spec-viewer/types.ts` — add `currentStep?: string | null` to the `NavState` interface (after line 264) so it can be plumbed to webview components.
- `src/features/spec-viewer/html/generator.ts` — in the `initialNavState` literal (~line 97), include `currentStep: currentStep ?? null` so the initial render (pre-Preact-hydrate) carries the field.
- `webview/src/spec-viewer/components/NavigationBar.tsx` — destructure `currentStep` from `navState`; pass it as a prop to `<StepTab currentStep={currentStep} ... />`.
- `webview/src/spec-viewer/components/StepTab.tsx` —
  - Add `currentStep?: string | null` to `StepTabProps`.
  - Rewrite the `inProgress` predicate (line 45):
    ```ts
    const inProgress = isLastStep && currentStep === 'implement' && taskCompletionPercent < 100;
    ```
  - Update `statusIcon` (line 81) so the pill text shows `${taskCompletionPercent}%` whenever `canonicalState === 'in-flight' && inProgress` (existing condition is already correct once `inProgress` is fixed; no separate change needed).
- `src/features/spec-viewer/stateDerivation.ts` — in `deriveActiveSubstep` (~line 78), after the existing `stepHistory.substeps` scan finds no active substep, fall back to:
  ```ts
  const progress = (ctx as { progress?: string | null }).progress;
  if (progress) return { step: ctx.currentStep, name: progress };
  return null;
  ```
  This surfaces the SDD pipeline's top-level `progress` field as the active substep without requiring SDD to populate `stepHistory.substeps`.

### Tests to Add

- `src/features/spec-viewer/__tests__/stateDerivation.test.ts` — extend the `deriveViewerState` describe block with three cases covering R002, R003, and R005 (workingBranch fallback is not exercised here — it lives in specViewerProvider, hard to unit-test without VSCode mocks; covered by manual smoke).
