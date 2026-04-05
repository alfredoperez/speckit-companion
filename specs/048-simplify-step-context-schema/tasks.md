# Tasks: Simplify Step Context Schema

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-04-05

## Phase 1: Implementation

### T001: Update FeatureWorkflowContext type ✅

**File**: `src/features/workflows/types.ts`

Remove `step`, `substep`, `next`, `task`, `updated` from `FeatureWorkflowContext`. Add `progress?: string | null`, `currentTask?: string | null`, `createdAt?: string`. Keep old fields as `@deprecated` optional for migration typing.

**Checkpoint**: Type compiles. Old fields marked deprecated, new fields present.

---

### T002: Add migrateContext helper in specContextManager ✅

**File**: `src/features/specs/specContextManager.ts`

Add `migrateContext()` function called from `readSpecContext`/`readSpecContextSync` that maps old field names to new:
- `step` → `currentStep` (if `currentStep` not already set)
- `substep` → `progress` (if `progress` not already set)
- `task` → `currentTask` (if `currentTask` not already set)
- `next` and `updated` are dropped (derived at read time)

New fields take precedence if both exist.

**Checkpoint**: `readSpecContext` returns migrated context with new field names.

---

### T003: Add migration tests ✅

**File**: `src/features/specs/__tests__/specContextManager.test.ts`

Add tests for `migrateContext`:
- Old fields map to new fields correctly
- New fields take precedence when both exist
- Missing fields stay undefined
- `next` and `updated` are not carried forward

**Checkpoint**: All migration tests pass.

---

### T004: Update computeBadgeText and phaseCalculation ✅

**File**: `src/features/spec-viewer/phaseCalculation.ts`

Update `computeBadgeText` signature: `step` → `currentStep`, `substep` → `progress`, `task` → `currentTask`. Remove `next` from signature. Remove `contextUpdated` parameter from `computeLastUpdatedDate` — derive last updated from `stepHistory` timestamps instead. Update `mapSddStepToTab` to accept `currentStep`.

**Checkpoint**: `computeBadgeText` uses new field names. `computeLastUpdatedDate` no longer takes `contextUpdated`.

---

### T005: Update specViewerProvider ✅

**File**: `src/features/spec-viewer/specViewerProvider.ts`

Change all `featureCtx?.step` → `featureCtx?.currentStep`, `featureCtx?.task` → `featureCtx?.currentTask`. Remove `contextUpdated` from `computeLastUpdatedDate` calls.

**Checkpoint**: No references to `featureCtx.step`, `featureCtx.task`, or `featureCtx.updated` remain.

---

### T006: Update specExplorerProvider ✅

**File**: `src/features/specs/specExplorerProvider.ts`

Change `specContext.step ?? specContext.currentStep` → `specContext.currentStep` (migration layer handles the mapping).

**Checkpoint**: Explorer uses only `currentStep`.

---

### T007: Fix handleStepperClick race condition ✅

**File**: `src/features/spec-viewer/messageHandlers.ts`

Make `handleStepperClick` await `updateStepProgress` before the terminal command fires. Remove fire-and-forget pattern so AI agent sees updated `.spec-context.json` when it starts.

**Checkpoint**: `updateStepProgress` is awaited before terminal dispatch. Stepper click persists step before AI command runs.
