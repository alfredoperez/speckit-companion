# Phase 1 Data Model: Fix Footer Button Visibility

This is a UI-determinism fix; there is no persisted-schema change. The "data model" here is the **in-memory state that drives the footer** and the **invariants** that make it deterministic.

## Source of truth

```
.spec-context.json  ──(read)──▶  SpecContext  ──deriveViewerState()──▶  ViewerState  ──▶  webview footer
```

`.spec-context.json` (per spec dir) is unchanged. `SpecContext` (status, currentStep, append-only `history[]`) is the canonical input. `ViewerState` is derived from it deterministically and becomes the **sole** footer input.

## Entity: ViewerState (footer-relevant view)

The footer must derive entirely from these fields. Run-step/generating fields move onto `ViewerState` (currently only on `NavState`).

| Field | Type | Source | Footer use |
|-------|------|--------|------------|
| `status` | `Status` | `ctx.status` | The single status the footer reads (replaces the 4-source chain) |
| `activeStep` | `StepName` | `ctx.currentStep` (validated) | Which step Regenerate/Approve target |
| `footer` | `SerializedFooterAction[]` | `getFooterActions(ctx, activeStep, workflowSteps)` | The button catalog — the deterministic oracle |
| `stepHistory` | `Record<step, {startedAt, completedAt}>` | `deriveStepHistory(ctx.history, …)` | Running-step detection, tab indicators |
| `runningStepArtifactReady` | `boolean` | `hasNonTrivialArtifact()` / 100% tasks for implement | Whether to keep the generating chip |
| `runningStepStartedAt` | `string \| null` | running step's `startedAt` | Recovery-timeout anchor |
| `runningStepLabel` | `string \| null` | `getDocTypeLabel(runningStep)` | Generating chip label |
| `pulse`, `highlights`, `steps`, `activeSubstep` | (existing) | derived | Step-tab indicators (US3) |

*(Activity-panel passthroughs on `ViewerState` are unrelated to the footer and unchanged.)*

### Entity: SerializedFooterAction
```
{ id: string, label: string, scope: 'spec' | 'step', tooltip: string }
```
`visibleWhen` is stripped at the serialization boundary (extension → webview). `label` for `approve` is resolved to the next step's label before serialization.

### Entity: NavState (footer no longer reads it)
`NavState` retains pure navigation/document concerns (`coreDocs`, `relatedDocs`, `currentDoc`, `stalenessMap`, dates, branch, `enhancementButtons`, …). The footer-relevant duplicates (`footerState`, `specStatus`, `runningStep*`, `activeStep`) are removed from the footer's read path; `enhancementButtons` either move onto `ViewerState` or are shipped complete on every footer-affecting message (see contract).

## Footer button matrix (validation oracle)

Derived from `FOOTER_ACTIONS.visibleWhen` + `docs/viewer-states.md`. The full table is in `contracts/footer-button-matrix.md`. Summary of closure gates:

- `isSpecDone(ctx)` = `status ∈ {implemented, completed}` → gates `Archive` + `Mark Completed`.
- `Reactivate` ⇔ `status ∈ {archived, completed}`.
- `Regenerate` ⇔ not terminal AND current step has `startedAt`.
- `Approve` ⇔ not terminal AND `shouldShowApprove` (current step started, no later step started, and step in flight or a later step exists). Hidden on `implement` and on past tabs.
- Generating overlay ⇔ running step has `startedAt`, no `completedAt`, artifact not ready, not timed out.

## Invariants (the determinism contract)

- **INV-1 (single source)**: every footer button and step-tab indicator is a pure function of one `ViewerState` snapshot. No footer decision reads `NavState`.
- **INV-2 (idempotent render)**: same `ViewerState` ⇒ identical footer button set, every render (SC-001).
- **INV-3 (no partial reads)**: no message updates a field the footer reads without delivering a complete, self-consistent footer snapshot (no mixing of two points in time).
- **INV-4 (single render path per state)**: exactly one of {normal `CatalogFooter`, `GeneratingFooter`} renders for a given `ViewerState`; the legacy fallback branch is removed (FR-009).
- **INV-5 (generating revert)**: when `runningStepArtifactReady` becomes true or the recovery timeout elapses, the footer returns to `CatalogFooter` buttons — never leaves them hidden (FR-005).
- **INV-6 (external change)**: an on-disk `.spec-context.json` change re-derives `ViewerState` and refreshes footer + tabs within 2 s via the existing watcher, no reopen (FR-007, SC-004).

## State transitions (footer outcomes)

| True state (`status` / step) | Footer right zone | Footer left zone |
|------------------------------|-------------------|------------------|
| `specified` (specify done, plan not started) | Approve→"Plan" | Regenerate |
| `planned` | Approve→"Tasks" | Regenerate |
| `ready-to-implement` (tasks created) | Approve→"Implement" | Regenerate |
| step generating | Generating chip (right) | Mark step complete (left) |
| `implemented` (final gate) | Mark Completed, Archive | Regenerate |
| `completed` | Reactivate, Archive | — |
| `archived` | Reactivate | — |

A control valid for the resulting state never disappears because a different control was clicked (FR-002) — because the set is recomputed from the true state, not mutated incrementally.
