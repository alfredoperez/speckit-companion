# Implementation Plan: Fix Badge Status Display

**Branch**: `049-fix-badge-status-display` | **Date**: 2026-04-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/049-fix-badge-status-display/spec.md`

## Summary

Fix `computeBadgeText()` to distinguish between in-progress and completed states for each workflow step. Currently it only maps `currentStep` to an action verb (e.g. "CREATING TASKS") regardless of completion. The fix adds `stepHistory` awareness so that when `currentStep` has a `completedAt` timestamp, the badge shows a completion label (e.g. "TASKS COMPLETE") instead of the in-progress verb. When `progress` is non-null, it continues to append `...` for active work.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`)
**Storage**: File-based (`.spec-context.json` per spec directory)
**Testing**: Jest with ts-jest, `npm test`
**Target Platform**: VS Code desktop (all platforms)
**Project Type**: Single (VS Code extension)
**Performance Goals**: N/A — badge computation is synchronous and trivial
**Constraints**: Must not break existing badge behavior for specs without `stepHistory`
**Scale/Scope**: Single function change + documentation update

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extensibility and Configuration | **PASS** | No new settings; badge logic remains internal |
| II. Spec-Driven Workflow | **PASS** | Enhances pipeline visibility — badge now correctly reflects step lifecycle |
| III. Visual and Interactive | **PASS** | Improves visual accuracy of workflow state indicator |
| IV. Modular Architecture | **PASS** | Change is scoped to existing `phaseCalculation.ts` module |

No violations. No Complexity Tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/049-fix-badge-status-display/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/features/spec-viewer/
└── phaseCalculation.ts           # computeBadgeText() — primary change target

docs/
└── viewer-states.md              # Badge state documentation — update required
```

**Structure Decision**: No new files needed. All changes are to existing modules.

---

## Phase 0: Outline & Research

### Research Tasks

1. **How does `stepHistory` flow into spec viewer?** — Already resolved: `featureCtx` passed directly to `computeBadgeText(featureCtx)` at `specViewerProvider.ts:480,696`. The `featureCtx` object is the full `FeatureWorkflowContext` which includes `stepHistory`.

2. **What happens when a step completes?** — `specContextManager.ts` sets `stepHistory[step].completedAt` when a step finishes. `currentStep` may or may not advance immediately — the bug surfaces when `completedAt` is set but `currentStep` hasn't moved.

3. **Legacy compat: specs without stepHistory** — Per FR-006, must fall back to current behavior (step name only, no completion indicator). This is the existing default path.

4. **Badge text patterns** — Current: `SPECIFYING`, `PLANNING`, `CREATING TASKS`, `IMPLEMENTING`. New completion variants: `SPECIFY COMPLETE`, `PLAN COMPLETE`, `TASKS COMPLETE`, `IMPLEMENT COMPLETE`.

### Findings → research.md

See `research.md` for consolidated findings.

---

## Phase 1: Design & Contracts

### Data Model

The core change is to `computeBadgeText()` signature and logic:

**Current signature** (`phaseCalculation.ts:209-214`):
```typescript
computeBadgeText(ctx?: {
    currentStep?: string | null;
    progress?: string | null;
    currentTask?: string | null;
    status?: string;
} | null): string | null
```

**New signature** — add `stepHistory`:
```typescript
computeBadgeText(ctx?: {
    currentStep?: string | null;
    progress?: string | null;
    currentTask?: string | null;
    status?: string;
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>;
} | null): string | null
```

**New badge text derivation logic** (priority order):
1. `status === "completed"` → `"COMPLETED"`
2. `status === "archived"` → `"ARCHIVED"`
3. `stepHistory[currentStep].completedAt` is set AND `progress` is null → `"<STEP> COMPLETE"` (step finished, not yet advanced)
4. `progress` is non-null → `"<STEP_VERB>..."` (actively working)
5. Fallback → `"<STEP_VERB>"` (step started but idle — no progress, no completedAt)

**Step-to-completion-label mapping**:
| currentStep | In-progress label | Completion label |
|-------------|------------------|-----------------|
| specify | SPECIFYING | SPECIFY COMPLETE |
| plan | PLANNING | PLAN COMPLETE |
| tasks | CREATING TASKS | TASKS COMPLETE |
| implement | IMPLEMENTING | IMPLEMENT COMPLETE |

**Edge cases**:
- `completedAt` set but `progress` non-null: Treat as in-progress (progress takes precedence — an agent may be doing post-completion work)
- No `stepHistory` at all: Fall through to existing verb-based logic (legacy compat)
- `currentStep` not in `stepHistory`: Same as no stepHistory — use verb-based label
- `status: "tasks-done"`: Not currently handled by badge — falls through to step-based logic (no change needed)

### No external contracts needed

This change is purely internal — no public APIs, CLIs, or external interfaces affected.

### Documentation Update

`docs/viewer-states.md` must be updated:
- Badge Text flowchart: Add completion branch after step check
- Badge table: Add `SPECIFY COMPLETE`, `PLAN COMPLETE`, `TASKS COMPLETE`, `IMPLEMENT COMPLETE` rows
- Document the priority: status > step-completion > in-progress > idle-step > fallback
