# Plan: Elapsed Timer and Step-Complete Notification

<!-- Template variables: {Feature Name}, {TODAY}, {NNN}, {slug}, {NNN}-{slug} -->

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-23

## Approach

Render a per-second elapsed-time ticker inside `StepTab` for whichever step currently has `stepHistory[step].startedAt` set and `completedAt == null`, deriving elapsed time from the timestamp (survives reloads) with a single interval on the webview root. For completion detection, the extension already calls `completeStep()` on dispatch/advance — add a thin observer in `SpecViewerProvider` that compares the previous and next `stepHistory` snapshots per spec and fires `vscode.window.showInformationMessage` with an "Open spec" action exactly once per `null → timestamp` transition, guarded by an in-memory `Set<"{specDir}:{step}:{startedAt}">` so reopens don't re-notify.

## Technical Context

**Stack**: TypeScript 5.3 (ES2022, strict), VS Code Extension API, Preact (webview).
**Constraints**: No new fields in `.spec-context.json`; interval must be cleared on webview dispose; respect `speckit.notifications.stepComplete` setting (default `true`).

## Files

### Create

- `webview/src/spec-viewer/components/ElapsedTimer.tsx` — small Preact component that renders `{format(elapsedMs)}`, owns a single `setInterval(1000)` keyed on `startedAt`, and clears itself on unmount or when `startedAt` is cleared.
- `webview/src/spec-viewer/elapsedFormat.ts` — pure formatter: `Ns` < 60s, `Mm Ss` < 1h, `Hh Mm` ≥ 1h. Exported separately for unit tests.
- `src/features/spec-viewer/stepCompletionNotifier.ts` — extension-side observer. Exposes `observe(specDir, prevCtx, nextCtx): void` that detects `stepHistory[step].completedAt` flipping from null→string and calls `NotificationUtils` / `vscode.window.showInformationMessage` with an action button. Holds an in-memory `Set<string>` of `{specDir}:{step}:{startedAt}` keys already announced; consults `speckit.notifications.stepComplete` config before firing.
- `src/features/spec-viewer/__tests__/stepCompletionNotifier.test.ts` — dedupe + already-complete-on-load + setting-disabled cases.
- `webview/src/spec-viewer/__tests__/elapsedFormat.test.ts` — boundary tests for 59s→1m, 59m→1h formatting.

### Modify

- `webview/src/spec-viewer/components/StepTab.tsx` — derive `runningStartedAt` from `stepHistory[phase].startedAt` when `canonicalState === 'in-flight'`; render `<ElapsedTimer startedAt={runningStartedAt} />` beneath `.step-label` (under `step-tab__substep` if both present).
- `webview/src/spec-viewer/components/NavigationBar.tsx` — compute `runningStepIndex` from `stepHistory` (`entry.startedAt && !entry.completedAt`) instead of relying on the hardcoded-`null` `activeStep` field; this is the same derivation the extension-side `navigation.ts` already does.
- `src/features/spec-viewer/html/navigation.ts` — mirror the above derivation so the initial static HTML shows the timer placeholder on first paint before signals hydrate. Keep the render static (no ticking in HTML); the Preact component replaces it on mount.
- `src/features/spec-viewer/specViewerProvider.ts` — before posting `navState`, call `stepCompletionNotifier.observe(specDir, instance.state.lastCtx, featureCtx)` and stash `featureCtx` on the instance for the next tick. Also populate `activeStep` from `stepHistory` (running step name) so downstream UI no longer hardcodes `null`.
- `package.json` — add config contribution `speckit.notifications.stepComplete` (boolean, default `true`, description "Show a notification when a dispatched spec step completes.").
- `webview/styles/spec-viewer/_step-tabs.css` (or closest existing partial) — style `.step-tab__elapsed` as muted, monospace-optional small text.
- `README.md` — one-line note under the existing viewer UX section describing the timer and completion notification, plus the new setting.
- `docs/viewer-states.md` — add the elapsed-timer element to the in-flight row of the step-tab state table.

## Data Model

<!-- No persisted schema changes. All state is derived from existing stepHistory[step].{startedAt, completedAt}. -->

## Testing Strategy

- **Unit**: Jest tests for `elapsedFormat` (boundaries) and `stepCompletionNotifier` (dedupe, skip-on-load, respect-setting).
- **Integration**: extend `messageHandlers.test.ts` or `specViewerProvider` tests to verify `observe` is invoked with prev/next context on each webview update.
- **Manual**: dispatch a step in the Extension Development Host, confirm the timer ticks, switch apps before completion, and verify the OS notification surfaces.

## Risks

- Stale `lastCtx` on webview re-mount: Mitigation — store `lastCtx` on the `SpecViewerInstance` state, not module-global, so multiple viewers stay independent; seed on first `observe` call so the initial ctx never counts as a `null → timestamp` transition.
- Timer drift / idle CPU: Mitigation — one interval per running timer, cleared on unmount and on `completedAt` flip; compute elapsed from `Date.now() - startedAt` rather than accumulating, so drift is zero.
- `.sdd.json` vs `.spec-context.json` writer races: Mitigation — notifier reads only the post-update context already in hand; no extra disk reads.
