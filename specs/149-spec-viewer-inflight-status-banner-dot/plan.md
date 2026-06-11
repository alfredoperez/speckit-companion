# Implementation Plan: status-driven in-flight, banner relocation, sub-nav dot

## Summary

Drive the spec-viewer step in-flight spinner from the spec transition `status` (already on `ViewerState.status`) instead of step-history `completedAt` alone, so a settled step stops spinning even when its self-close `complete` entry is missing. Relocate the viewer install banner from full-width above `#app-root` into the Preact `ActivityPanel`, keeping its `data-action` click contract by delegating the click listener from `document` so it survives a late Preact mount. Remove the stray `::after` middot on the Specification sub-nav parent chip.

## Technical Context

- Language/version: TypeScript, Preact (webview), VS Code extension host (Node).
- Primary surfaces: `webview/src/spec-viewer/components/StepTab.tsx`, `webview/src/spec-viewer/components/ActivityPanel.tsx`, `webview/src/spec-viewer/types.ts` (NavState), `src/features/spec-viewer/html/generator.ts`, `webview/styles/spec-viewer/_navigation.css`.
- Testing: Jest + jsdom + `preact` render (`webview/src/spec-viewer/components/__tests__/StepTab.test.tsx`).
- Constraints: keep the #229 sync glyph and done checkmark intact; keep the Create-Spec banner (`specEditorProvider.ts`) unchanged; banner markup/id/`data-action` contract stays identical.

## Approach & Structure

1. **Status-driven in-flight (FR-001..FR-004, FR-009)** — `webview/src/spec-viewer/components/StepTab.tsx`.
   - Add a module-level map of in-flight status → step name: `specifying→specify`, `planning→plan`, `tasking→tasks`, `implementing→implement`.
   - Read `vs.status` (already `viewerState.value.status`). Compute `statusInFlight = STATUS_TO_INFLIGHT_STEP[vs.status] === stepName`.
   - Redefine `isWorking` so a settled status never spins and an in-flight status does, even when `completedAt` is missing:
     `isWorking = statusInFlight || (activeStep === stepName && !settled && !completedAt)`, where `settled` is true when `vs.status` is a settled value (`specified`/`planned`/`ready-to-implement`/`implemented`). The key change: when the status is settled, the step must NOT spin regardless of `activeStep`/`completedAt`; when the status is the step's in-flight value, it MUST spin regardless of `completedAt`.
   - Keep the implement-percentage path (`inProgress`) and the sync glyph / checkmark precedence untouched.

2. **Install banner relocation (FR-005..FR-007)** — `generator.ts`, `ActivityPanel.tsx`, `types.ts`.
   - Remove the `${installBanner}` injection above `#app-root` in `generator.ts`.
   - Carry the visibility into the webview via `initialNavState.showInstallPrompt` (new optional `NavState` field) instead of server-injected HTML.
   - Render the banner markup inside `ActivityPanel` (same id `install-banner`, same classes, same `data-action` buttons) when `navState.value.showInstallPrompt` is true.
   - Change the body `<script>` click wiring in `generator.ts` to delegate from `document` (query `.closest('#install-banner [data-action]')`) so it works after the Preact mount; keep the `instanceof Element` guard and the two message dispatches.
   - Leave `specEditorProvider.ts` (Create-Spec banner) and `installBanner.ts` markup untouched.

3. **Sub-nav middot (FR-008)** — `webview/styles/spec-viewer/_navigation.css`.
   - Remove the `.step-child--parent::after { content: '·'; … }` rule (and its `margin-right` companion if it only existed to space the dot — keep the chip's own spacing).

## Out of Scope

- The Create-Spec panel install banner (unchanged).
- Any change to `shouldShowInstallPrompt` visibility logic.
- The implement task-percentage pill behavior and the #229 glyph/checkmark visuals.
- Per-step status plumbing from the extension (the single spec-level `status` is sufficient).

## Decisions

- The status→step map lives in `StepTab.tsx` (the only consumer) rather than a shared module, mirroring the existing `DOC_TO_STEP` map there.
- Click wiring moves from element-bound to `document`-delegated because the relocated banner mounts after the inline script runs; element-bound `addEventListener` would silently no-op.
