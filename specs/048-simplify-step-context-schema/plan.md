# Plan: Simplify Step Context Schema

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-05

## Approach

Unify the dual-source step tracking by removing the SDD-specific `step`, `substep`, `next`, `task`, and `updated` fields and replacing them with `currentStep` (already exists), `progress`, and `currentTask`. Add a migration layer in `readSpecContext` that maps old field names to new ones at read time so existing files keep working. Fix the fire-and-forget race in `handleStepperClick` by awaiting the step persistence before dispatching the terminal command.

## Technical Context

**Stack**: TypeScript 5.3+, VS Code Extension API
**Constraints**: Must not break existing `.spec-context.json` files — read-time migration only, no rewrite-on-read

## Files

### Create

(none)

### Modify

- `src/features/workflows/types.ts` — Remove `step`, `substep`, `next`, `task`, `updated` from `FeatureWorkflowContext`; add `progress?: string | null`, `currentTask?: string | null`, `createdAt?: string`; keep old fields as `@deprecated` optional for migration typing
- `src/features/specs/specContextManager.ts` — Add `migrateContext()` helper called from `readSpecContext`/`readSpecContextSync` that maps old→new fields (prefer new if both exist); drop `contextUpdated` param from `computeLastUpdatedDate` calls
- `src/features/spec-viewer/phaseCalculation.ts` — Update `computeBadgeText` signature: `step→currentStep`, `substep→progress`, `task→currentTask`; remove `next` from signature; remove `computeLastUpdatedDate`'s `contextUpdated` parameter; update `mapSddStepToTab` to accept `currentStep`
- `src/features/spec-viewer/specViewerProvider.ts` — Change all `featureCtx?.step` to `featureCtx?.currentStep`, `featureCtx?.task` to `featureCtx?.currentTask`, `featureCtx?.updated` to nothing; remove `contextUpdated` from `computeLastUpdatedDate` calls
- `src/features/spec-viewer/messageHandlers.ts` — Make `handleStepperClick` await `updateStepProgress` before the terminal command fires (remove fire-and-forget pattern)
- `src/features/specs/specExplorerProvider.ts` — Change `specContext.step ?? specContext.currentStep` to just `specContext.currentStep` (migration layer handles the mapping)
- `src/features/specs/__tests__/specContextManager.test.ts` — Add tests for `migrateContext`: old fields map to new, new fields take precedence, missing fields stay undefined

## Data Model

Before (mixed fields):
```
step, substep, next, task, updated     ← SDD-set
currentStep, stepHistory, status       ← Extension-set
```

After (unified):
```
currentStep    ← single source (was step + currentStep)
progress       ← was substep
currentTask    ← was task
createdAt      ← new
stepHistory    ← unchanged
status         ← unchanged
```

Removed entirely: `step`, `substep`, `next`, `task`, `updated`

Migration in `readSpecContext`:
```
if (raw.step && !raw.currentStep) → currentStep = raw.step
if (raw.substep && !raw.progress) → progress = raw.substep
if (raw.task && !raw.currentTask) → currentTask = raw.task
// next and updated are dropped — derived at read time
```

## Risks

- Updating `handleStepperClick` to await may add minor latency before the terminal command fires — mitigate by keeping the write simple (JSON stringify + fs.writeFile, typically <5ms)
- SDD skill templates that still write old field names will work via migration layer, but should be updated to avoid confusion — tracked as R008 (SHOULD)
