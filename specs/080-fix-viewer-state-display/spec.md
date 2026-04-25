# Spec: Fix Viewer State Display

**Slug**: 080-fix-viewer-state-display | **Date**: 2026-04-25

## Summary

The spec viewer header and step-stepper drift from the canonical `.spec-context.json` state in three ways: the branch chip shows the wrong field, the Tasks tab doesn't enter in-flight (% pill) until the first task ticks off, and `progress` substeps are never surfaced visually. This is a viewer-only fix — pure read-side derivation; no SDD pipeline changes.

## Requirements

- **R001** (MUST): The branch chip in `SpecHeader` displays `workingBranch` when present in `.spec-context.json`, falling back to the audit-trail `branch` field only when `workingBranch` is null/missing.
- **R002** (MUST): The last step tab (Tasks) renders the in-flight % pill from `0%` through `99%` whenever `currentStep === "implement"` and `taskCompletionPercent < 100`. At `100%` it switches to the `done` ✓ check.
- **R003** (MUST): When `.spec-context.json` has a non-null top-level `progress` field but `stepHistory[currentStep].substeps` is empty, the viewer treats `{ step: currentStep, name: progress }` as the active substep so the substep label renders on the active step tab.
- **R004** (MUST): The `SpecContext` TypeScript type explicitly declares `workingBranch?: string | null`, and the `specContextReader.normalizeSpecContext` function preserves the field through the read pipeline.

## Scenarios

### Branch chip during implement

**When** `.spec-context.json` has `branch: "main"` and `workingBranch: "feat/foo-bar"`
**Then** the spec-viewer header chip displays `feat/foo-bar` (with the existing `git-branch` codicon and `Branch: feat/foo-bar` tooltip).

### Tasks tab at 0% during implement

**When** the viewer renders for a spec with `currentStep: "implement"`, `taskCompletionPercent: 0`, and no `stepHistory.implement.startedAt`
**Then** the Tasks step tab renders with `canonicalState === "in-flight"` and the status pill shows `0%`.

### Tasks tab transitions to done at 100%

**When** the viewer renders for a spec with `currentStep: "implement"` and `taskCompletionPercent: 100`
**Then** the Tasks step tab renders with `canonicalState === "done"` and the status pill shows `✓` (not `100%`).

### Substep label from top-level progress

**When** `.spec-context.json` has `currentStep: "specify"`, `progress: "exploring"`, and `stepHistory.specify.substeps` is empty/missing
**Then** the Specify step tab renders a `step-tab__substep` element with text `exploring` (driven by `viewerState.activeSubstep`).

### Backward compatibility — old contexts

**When** `.spec-context.json` has no `workingBranch` field and no top-level `progress` field (older specs)
**Then** the branch chip falls back to `branch`, no substep is shown, and existing behavior is preserved.

## Out of Scope

- Changes to the SDD pipeline skills (no writes to `stepHistory.substeps[]` introduced in this PR).
- The dead-code path `src/features/spec-viewer/html/navigation.ts` (server-side mirror of StepTab) — it's only barrel-exported, never called. Leave as-is.
- Re-rendering on `.spec-context.json` file changes (separate viewer-refresh issue not covered here).
