# Plan: Step tab sync glyph + locked in-flight clearing (#229)

## Summary

Swap the empty in-flight step-tab indicator from a filled pulsing circle to a spinning VS Code `sync` codicon, and lock the already-correct "in-flight clears on completion" behavior with regression tests. The state-clearing path (`stepHistoryDerivation` → `deriveViewerState` / `findRunningStep` → `refreshContextIfDisplaying` → `viewerStateUpdated` → NavigationBar re-render) was verified correct in `main` during investigation, including for `by: "ai"` completes; the only code defect is the missing glyph.

## Technical Context

- **Language**: TypeScript (extension `src/`) + Preact/TSX (webview `webview/src/`).
- **Styling**: plain CSS partials under `webview/styles/spec-viewer/`; codicon font already loaded; `spin` keyframe already in `_animations.css`.
- **Testing**: Jest (`npm test`) for both extension and webview (jsdom) suites. Compile gates: `npm run compile` (extension) + `npm run compile-web` (webview bundle).
- **Constraints**: No runtime deps on `.claude/**` or `.specify/**` from `src/`/`webview/`. Derive in-flight from the full discriminator. Guard `e.target instanceof Element` in delegated handlers (no new handlers added here).

## Approach & Structure

Order of attack:

1. **Glyph render — `webview/src/spec-viewer/components/StepTab.tsx`**
   The empty in-flight indicator currently renders `<span class="step-status">{statusIcon}</span>` where `statusIcon` is `''` for non-percentage in-flight. Render a `codicon-sync` element inside `.step-status` when `canonicalState === 'in-flight'` and there is no percentage string (i.e. not the implement `inProgress` pill). Keep the percentage pill path (`statusIcon` = `NN%`) unchanged (FR-008).

2. **Glyph styling — `webview/styles/spec-viewer/_navigation.css`**
   For the empty in-flight `.step-status`: drop the filled circle (transparent background/border, no border) and color the `codicon-sync` with a VS Code theme var; apply `animation: spin 1.5s linear infinite` (reuse the existing `spin` keyframe). Leave `.step-tab.in-flight .step-status:not(:empty)` (the percentage pill) untouched.

3. **Stories — `webview/src/spec-viewer/components/StepTab.stories.tsx`**
   Ensure an in-flight story exists/updates to surface the sync glyph (FR-009).

4. **Regression tests (lock the clearing behavior — SC-001/SC-002)**
   - Extension: `src/features/specs/__tests__/stepHistoryDerivation.test.ts` (or a focused new test) — assert a `by: "ai"` step-level `complete` sets `completedAt` and `findRunningStep` returns null; assert a genuinely-running step (start, no complete) stays in flight. Use the `specs/_01_demo-planned` shape inline (no `.specify` runtime dep).
   - Webview: `webview/src/spec-viewer/components/__tests__/StepTab.test.tsx` — assert the in-flight tab renders the `codicon-sync` glyph; assert the tab flips in-flight → done (and the glyph disappears) when re-rendered with a completed `stepHistory` + null `activeStep`.

5. **Docs — `docs/viewer-states.md`** — document the sync-glyph in-flight visual and when in-flight clears.

## Out of Scope

- Reworking the derivation or refresh path — verified correct; only regression coverage is added.
- The implement-step percentage pill visual (kept as-is).
- Any change to `.spec-context.json` write scripts or capture commands.
- The genuinely-still-running case "C" (substep completes with no step-level complete) — that is correct in-flight behavior, not a bug.

## Constitution Check

No constitution gates defined for this repo affect a webview-visual + test change. Isolation rule (no `src/`/`webview/` deps on `.claude`/`.specify`) is honored — tests inline their fixtures.
