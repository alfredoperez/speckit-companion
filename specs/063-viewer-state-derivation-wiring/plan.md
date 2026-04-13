# Plan: Viewer State Derivation Wiring

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-13

## Approach

Push a single `ViewerState` payload from the extension to the webview on every `contentUpdated` message, and refactor the three consumer components (`SpecHeader`, `FooterActions`, stepper) plus their CSS to read it directly. The derivation is already done in `stateDerivation.ts` / `footerActions.ts`, so this is pure wiring: one call site in `specViewerProvider.sendContentUpdateMessage`, a shared `ViewerState` type in `webview/src/types.ts`, and three component rewrites. Legacy `navState.specStatus` / per-tab heuristics are deleted rather than preserved — the extension and webview ship in the same `.vsix`, so no compatibility shim is needed.

## Technical Context

**Stack**: TypeScript 5.3+, VS Code Extension API, Preact (webview), Webpack 5
**Constraints**: No new filesystem reads in webview; `footer` must serialize (drop any function fields).

## Files

### Modify

- `webview/src/types.ts` — add `ViewerState` type (mirror of `src/core/types/specContext::ViewerState`); add optional `viewerState?: ViewerState` to `contentUpdated` message shape.
- `src/features/spec-viewer/specViewerProvider.ts` — in `sendContentUpdateMessage`, call `deriveViewerState(ctx, activeStep)`; strip function fields from `footer` (keep `{ id, label, scope, tooltip }`); attach as `viewerState` on the outgoing message.
- `src/features/spec-viewer/messageHandlers.ts` — dispatch footer button clicks by `id` to existing handlers.
- `webview/src/spec-viewer/components/FooterActions.tsx` — iterate `viewerState.footer`; render button per entry with scope-suffixed tooltip; remove `isTasksDone` / `isCompleted` / `isArchived` heuristics.
- `webview/src/spec-viewer/components/SpecHeader.tsx` — read `viewerState.status` for badge; remove per-tab recomputation.
- `webview/src/spec-viewer/components/StepTab.tsx` — apply `.pulse` only when `viewerState.pulse === step`; `.completed` when `viewerState.highlights.includes(step)`; render secondary substep label when `viewerState.activeSubstep?.step === step`.
- `src/features/spec-viewer/html/stepper.ts` (or equivalent) — remove `.in-progress` / `.working` class toggles.
- `webview/styles/spec-viewer/_navigation.css` — drop `.step-tab.in-progress` / `.working`; add `.step-tab.completed`; add substep label style.
- `webview/styles/spec-viewer/_animations.css` — consolidate pulse animation onto `.step-tab.pulse` only.

### Create

- `webview/src/spec-viewer/components/__tests__/FooterActions.spec.tsx` — Preact component test: button count and scope-suffixed tooltips match supplied `viewerState.footer`.

## Testing Strategy

- **Unit**: Existing `tests/unit/spec-viewer/stateDerivation.spec.ts` already covers derivation. Add Preact test for `FooterActions` rendering from `viewerState.footer`.
- **Manual**: Follow the 5 scenarios in spec.md (completed spec, mid-plan pulse, active substep label, footer scope tooltips, sdd-workflow Auto button visibility).

## Risks

- **CSS specificity fights**: Removing `.working` / `.in-progress` may leave dangling selectors elsewhere. Mitigation: grep both class names across `webview/styles/**` before landing and delete every match.
- **Signal plumbing**: `navState` is a Preact signal consumed by multiple components; add `viewerState` as a sibling signal (or extend the same signal) so updates reach all consumers synchronously.
