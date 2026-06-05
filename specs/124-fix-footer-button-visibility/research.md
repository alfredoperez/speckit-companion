# Phase 0 Research: Fix Footer Button Visibility

## Root cause investigation

The visibility *rules* are already deterministic and centralized. The defect is in **how state reaches the footer**, not in what the rules decide.

### Finding 1 — The footer rules are already a single deterministic catalog

`src/features/spec-viewer/footerActions.ts` defines `FOOTER_ACTIONS` with per-action `visibleWhen(ctx, step, stepHistory)` predicates and `getFooterActions()` filters them. `deriveViewerState()` (`stateDerivation.ts`) calls this and ships the result as `viewerState.footer`. Given the same `.spec-context.json`, this yields the same button set every time. So FR-001's *intent* is already met at the catalog layer — the bug is downstream.

### Finding 2 — The footer reads from TWO parallel state objects

`webview/src/spec-viewer/components/FooterActions.tsx` mixes inputs from two signals:
- `viewerState` (`vs`) → the button **catalog** (`vs.footer`) and `vs.status`.
- `navState` (`ns`) → the **`isGenerating` short-circuit** and run-step gating (`ns.activeStep`, `ns.runningStepArtifactReady`, `ns.runningStepStartedAt`, `ns.stepHistory[runningStep]`), plus `ns.footerState`, `ns.enhancementButtons`.

`status` is resolved from a **4-source fallback chain**: `vs?.status || ns.footerState?.specStatus || ns.specStatus || initialSpecStatus`. These sources can disagree (FR-008).

The run-step / generating fields (`activeStep`, `runningStepArtifactReady`, `runningStepStartedAt`, `runningStepLabel`, `footerState`, `specStatus`) exist **only on `NavState`** (`webview/src/spec-viewer/types.ts`), **not on `ViewerState`**.

### Finding 3 — The two refresh messages have different completeness

- `contentUpdated` (built by `specViewerProvider.sendContentUpdateMessage`) — tab switch / `*.md` change. Carries a **full `NavState`** *and* a **full `viewerState`**. Both fresh → footer correct.
- `viewerStateUpdated` (built by `specViewerProvider.refreshContextIfDisplaying`) — fires on every `.spec-context.json` change, i.e. **after every footer/lifecycle action** and on **external disk changes (FR-007)**. Carries a **full fresh `viewerState`** but only a **3-field navState partial** (`stepHistory`, `currentStep`, `badgeText`).

In the webview (`index.tsx → handleMessage`), `viewerStateUpdated` merges that partial into the existing `navState`, leaving `activeStep`, `runningStep*`, `footerState`, `specStatus` **stale** from the last `contentUpdated`.

**Bug mechanism**: after a footer/lifecycle action (only `viewerStateUpdated` fires), the footer evaluates its `isGenerating` short-circuit and run-step gating from a **stale `navState`** while rendering the catalog from a **fresh `viewerState`** — two snapshots from different points in time. The result is the reported symptom: a still-valid button disappears (footer drops into `GeneratingFooter` on stale run-step fields) or an expected button never appears.

### Finding 4 — Three render paths can produce different button sets for the same true state (FR-009)

`FooterActions` chooses among:
1. `GeneratingFooter` — when `isGenerating` (computed from stale-prone `navState`).
2. `CatalogFooter` — when `vs.footer.length > 0` (the canonical path).
3. **Legacy fallback** — when `viewerState` is absent/empty; uses `ns.footerState` + a *different* closure gate: `isLegacyDone = tasks-done | completed | archived`, which does **not** match the catalog's `isSpecDone = implemented | completed`.

`index.tsx` documents a real race where `viewerStateUpdated` arrives before the first `navState` and the partial is dropped — a window where the footer can fall to the legacy path and render a different set. Same true state, different buttons → FR-009 violation.

## Decisions

### Decision 1 — Single authoritative snapshot for the entire footer
**Decision**: Make `ViewerState` (derived solely from `.spec-context.json`) the **sole** input to the footer. Add the run-step/generating fields (`activeStep` already present; add `runningStepArtifactReady`, `runningStepStartedAt`, `runningStepLabel`) to `ViewerState`, derived in `deriveViewerState()`. The webview footer reads **only** `viewerState`.
**Rationale**: The footer becomes a pure function of one object that is already derived deterministically from the canonical file. Cross-object drift is impossible because there is only one object. Directly satisfies FR-001, FR-008.
**Alternatives considered**:
- *Patch the partial* — have `refreshContextIfDisplaying` also send the missing navState fields. Rejected as the *primary* fix: it keeps two parallel objects the footer must read in lockstep forever; the 3-path + 4-source-chain fragility (FR-009) remains. (Adopted only as a hygiene corollary — see Decision 3.)

### Decision 2 — Collapse render paths and the status fallback chain
**Decision**: Remove the legacy `navState`-driven fallback branch in `FooterActions` and the 4-source `status` chain. Keep exactly two render shapes, both driven by `viewerState`: the normal `CatalogFooter` and the `GeneratingFooter` (generating fields now from `viewerState`). `status` = `viewerState.status` only.
**Rationale**: One state source → at most one correct button set per true state (FR-009). Fewer branches = the "clean and simple" handling the user asked for.
**Alternatives considered**: keep the legacy path as a safety net — rejected; it is precisely where the divergent button set comes from, and an always-present `viewerState` makes it dead code.

### Decision 3 — One shared payload builder; never emit a partial that the footer reads
**Decision**: Extract the payload construction in `sendContentUpdateMessage` into a single builder and have **both** `sendContentUpdateMessage` and `refreshContextIfDisplaying` emit a **complete** `viewerState` (and, for fields that legitimately remain on `navState` such as workflow-derived `enhancementButtons`, a complete navState too). No refresh path ships a partial that the footer depends on.
**Rationale**: Removes the cross-*path* divergence to match the cross-*object* fix; guarantees SC-004 (external change reflected ≤ 2 s) via the existing watcher with no new polling.
**Alternatives considered**: leave two bespoke builders — rejected; duplication is how the shapes drifted in the first place.

### Decision 4 — Enhancement buttons stay workflow-derived but ship complete
**Decision**: `enhancementButtons` (per-tab/workflow optional commands) are not `.spec-context.json`-derived, so they remain resolved from workflow/custom-command config; but the context-refresh path must include them so they don't go stale. Gate them on the footer's actual closure actions (as `CatalogFooter` already does), not on a separate status string.
**Rationale**: keeps provider/workflow extensibility (Principle I) while still being deterministic for a given (tab, workflow, true-state).

### Decision 5 — Preserve the generating UX and 10-minute recovery timeout
**Decision**: Keep the `GeneratingFooter` chip + `Mark step complete` override and the client-side `RECOVERY_TIMEOUT_MS` timer; only change its inputs to come from `viewerState`. When generation ends (artifact detected via `hasNonTrivialArtifact`) or the timeout elapses, the footer reverts to the normal `CatalogFooter` buttons — never leaves them hidden (FR-005, Edge Cases).
**Rationale**: spec Assumptions explicitly retain this behavior; the fix is only that the revert is now driven by the same fresh snapshot as the buttons.

### Decision 6 — Step tabs share the same snapshot (US3 / FR-006)
**Decision**: Verify `navigation.ts` tab-class derivation (enabled/checkmark/active/reviewing) and the green-✓ on-disk check stay consistent with the same refreshed snapshot; ensure a footer action that advances the workflow updates tab indicators without a reopen.
**Rationale**: FR-006 requires tabs not to desync after footer actions; they ride the same refresh messages.

## Outcome

All open questions resolved; no `NEEDS CLARIFICATION` remain. The target behavior is the existing `docs/viewer-states.md` matrix (spec Assumptions); this fix makes the live viewer match it deterministically by giving the footer a single state source and a single complete-payload contract.
