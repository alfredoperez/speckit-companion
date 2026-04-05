# Spec: Simplify Step Context Schema

**Slug**: 048-simplify-step-context-schema | **Date**: 2026-04-05

## Summary

The `FeatureWorkflowContext` type and `.spec-context.json` files contain overlapping step-related fields from two sources (extension-managed and SDD-enriched) that can diverge and cause confusion. This spec audits every field, removes redundancy, ensures step persistence is reliable before AI commands run, and defines a clear completion model.

## Requirements

- **R001** (MUST): Ensure `handleStepperClick` awaits `updateStepProgress` (or confirms write is flushed) before dispatching the AI terminal command, so the AI agent sees the updated `.spec-context.json` when it starts
- **R002** (MUST): Remove the `step` field from `FeatureWorkflowContext` — unify on `currentStep` as the single source of truth for which step is active; update all consumers (`specExplorerProvider`, `phaseCalculation`, `specViewerProvider`) to read `currentStep` instead of `step`
- **R003** (MUST): Remove the `substep` field — replace with a `progress` field (string | null) that serves the same "in-progress indicator" role but with a clearer name; update `computeBadgeText` and SDD skill templates accordingly
- **R004** (MUST): Remove the `next` field — derive the next step from `currentStep` + the workflow's step array at read time instead of persisting it; update `computeBadgeText` to use the derived value
- **R005** (MUST): Remove the `task` field — replace with `currentTask` (string | null) for clarity; update `computeBadgeText` and `specViewerProvider` (which already uses `currentTask` in NavState)
- **R006** (MUST): Remove the `updated` field — use the latest timestamp from `stepHistory` entries instead; update `computeLastUpdatedDate` to drop the `contextUpdated` parameter
- **R007** (SHOULD): Add a `createdAt` field (ISO string) to `FeatureWorkflowContext` — populated when the spec directory is first created; distinct from `selectedAt` (which tracks workflow selection)
- **R008** (SHOULD): Ensure AI agent SDD skill templates write the new field names (`currentStep`, `progress`, `currentTask`) instead of the old ones (`step`, `substep`, `task`, `next`, `updated`)
- **R009** (MUST): Add a migration path — `readSpecContext` should map old field names to new ones at read time so existing `.spec-context.json` files continue to work without manual edits

## Scenarios

### Stepper click persists before AI command

**When** a user clicks the "Plan" step button in the spec viewer
**Then** `updateStepProgress` completes (write flushed to disk) before the terminal command is dispatched, and the AI agent sees `currentStep: "plan"` in `.spec-context.json`

### Badge shows in-progress state

**When** an SDD skill sets `progress: "exploring"` in `.spec-context.json`
**Then** `computeBadgeText` returns `"SPECIFYING..."` (appending `...` when `progress` is non-null)

### Next step derived at read time

**When** `currentStep` is `"specify"` and the workflow defines steps `[specify, plan, tasks, implement]`
**Then** the next step is derived as `"plan"` without needing a persisted `next` field

### Legacy spec-context files still load

**When** a `.spec-context.json` file contains old fields (`step`, `substep`, `task`, `next`, `updated`)
**Then** `readSpecContext` maps them to the new schema (`currentStep`, `progress`, `currentTask`) transparently, preferring new fields if both exist

### Last updated derived from stepHistory

**When** a `.spec-context.json` has no `updated` field but has `stepHistory` with multiple timestamps
**Then** `computeLastUpdatedDate` returns the most recent timestamp from `stepHistory` entries

## Non-Functional Requirements

- **NFR001** (MUST): Migration mapping in `readSpecContext` adds negligible overhead — simple property remapping, no file writes on read

## Out of Scope

- Rewriting SDD skill templates end-to-end (only the field names they write to `.spec-context.json` change)
- Changing the `stepHistory` structure itself (start/complete model is fine)
- Auto-detecting AI completion via file creation heuristics (deferred — extension-side `completedAt` marking on next-step click is sufficient for now)
- Parallel task execution redesign (out of scope; `currentTask` remains a single string)
