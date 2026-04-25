# Tasks: Fix Viewer State Display

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-25

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** Type `workingBranch` in SpecContext + preserve in reader — `src/core/types/specContext.ts`, `src/features/specs/specContextReader.ts` | R004
  - **Do**:
    - In `src/core/types/specContext.ts`, after the `branch: string;` line in the `SpecContext` interface, add: `workingBranch?: string | null;`
    - In `src/features/specs/specContextReader.ts` `normalizeSpecContext` (the `out` literal), add: `workingBranch: typeof raw.workingBranch === 'string' ? (raw.workingBranch as string) : (raw.workingBranch === null ? null : undefined),`
  - **Verify**: `npm run compile` passes with no type errors. The index signature `[key: string]: unknown` already preserved this field; the change is purely additive typing.

- [x] **T002** Branch chip falls back to workingBranch — `src/features/spec-viewer/specViewerProvider.ts` | R001
  - **Do**: At lines ~568 (call to `generateHtml`) and ~833 (`navState` literal), replace `featureCtx?.branch ?? null` with:
    ```ts
    (featureCtx?.workingBranch as string | null | undefined) ??
      featureCtx?.branch ??
      null;
    ```
  - **Verify**: `npm run compile` passes. Manually confirm in extension host that the branch chip shows `feat/foo-bar` when `.spec-context.json` has `workingBranch` set.
  - **Leverage**: `branch-creation.md` semantics — `workingBranch` is set by `/sdd:implement` when `branchStage` matches; `branch` is the immutable audit field.

- [x] **T003** Plumb currentStep through navState/types/initial-render — `src/features/spec-viewer/types.ts`, `src/features/spec-viewer/html/generator.ts`, `src/features/spec-viewer/specViewerProvider.ts` | R002
  - **Do**:
    - In `src/features/spec-viewer/types.ts` `NavState` (after `branch?:`), add: `/** SDD currentStep from spec-context (drives implement-phase pill) */ currentStep?: string | null;`
    - In `src/features/spec-viewer/html/generator.ts` `initialNavState` literal, add: `currentStep: currentStep ?? null,` next to the existing `branch:` field.
    - In `src/features/spec-viewer/specViewerProvider.ts` `navState` literal at line ~810, add: `currentStep: featureCtx?.currentStep ?? documentType ?? null,`
  - **Verify**: `npm run compile` passes. The `currentStep` argument was already passed to `generateHtml` (line 570); this task only widens NavState and the literals.

- [x] **T004** StepTab uses currentStep for in-flight predicate _(depends on T003)_ — `webview/src/spec-viewer/components/StepTab.tsx`, `webview/src/spec-viewer/components/NavigationBar.tsx` | R002
  - **Do**:
    - In `webview/src/spec-viewer/components/StepTab.tsx`:
      - Add `currentStep?: string | null;` to `StepTabProps` (after `runningStepIndex`).
      - Destructure `currentStep` in the function body alongside the other props.
      - Rewrite the `inProgress` predicate (line 45) to: `const inProgress = isLastStep && currentStep === 'implement' && taskCompletionPercent < 100;`
    - In `webview/src/spec-viewer/components/NavigationBar.tsx`:
      - Destructure `currentStep` from `navState`.
      - Pass `currentStep={currentStep}` to `<StepTab ... />`.
  - **Verify**: `npm run compile` passes. With a spec at `currentStep: "implement"` and 0/1 tasks done, the Tasks tab shows a `0%` pill (not a green check). At 1/1, it shows `✓`.

- [x] **T005** Substep fallback to top-level progress — `src/features/spec-viewer/stateDerivation.ts` | R003
  - **Do**: In `deriveActiveSubstep` (~line 78), replace the function body with:
    ```ts
    for (const step of STEP_NAMES) {
      const entry = ctx.stepHistory[step];
      const active = entry?.substeps?.find((s) => !s.completedAt);
      if (active) return { step, name: active.name };
    }
    const progress = (ctx as { progress?: string | null }).progress;
    if (progress) return { step: ctx.currentStep, name: progress };
    return null;
    ```
  - **Verify**: `npm test -- stateDerivation` passes (after T006 adds tests). With a context that has `currentStep: "specify"`, `progress: "exploring"`, and no `stepHistory.specify.substeps`, the active step tab shows `exploring` as a `step-tab__substep`.

- [x] **T006** Add unit tests for the three derivations _(depends on T005)_ — `src/features/spec-viewer/__tests__/stateDerivation.test.ts` | R002, R003
  - **Do**: In the existing `describe('deriveViewerState', ...)` block, add three `it` cases:
    - "falls back to top-level `progress` when stepHistory.substeps is empty" — input ctx with `currentStep: "specify"`, `progress: "exploring"`, empty stepHistory → expect `activeSubstep: { step: "specify", name: "exploring" }`.
    - "returns null activeSubstep when neither stepHistory.substeps nor progress is present" — confirms backward compat.
    - "prefers stepHistory.substeps over top-level progress" — both populated → uses substeps entry.
  - **Verify**: `npm test -- stateDerivation` passes; all new cases green.
  - **Leverage**: existing `it('returns activeSubstep when an entry has substeps with no completedAt'` test as the structural template.
