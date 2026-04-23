# Tasks: Elapsed Timer and Step-Complete Notification

<!-- Template variables: {Feature Name}, {TODAY}, {NNN}, {slug}, {NNN}-{slug} -->

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-23

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** Pure elapsed-time formatter — `webview/src/spec-viewer/elapsedFormat.ts` | R002
  - **Do**: Create `formatElapsed(ms: number): string` that returns `Ns` when `< 60_000`, `Mm Ss` when `< 3_600_000` (e.g. `3m 22s`), and `Hh Mm` at or above one hour (e.g. `1h 07m`). Zero-pad the minor unit in the two longer forms. Export as a named function.
  - **Verify**: `npm run compile` passes; T002 tests pass.

- [x] **T002** [P] Unit tests for `formatElapsed` *(depends on T001)* — `webview/src/spec-viewer/__tests__/elapsedFormat.test.ts` | R002
  - **Do**: Cover 0s, 59s, 60s→`1m 00s`, 3m 22s, 59m 59s, 60m→`1h 00m`, 1h 7m→`1h 07m`. BDD `describe`/`it`.
  - **Verify**: `npm test -- elapsedFormat` green.
  - **Leverage**: existing webview Jest tests (e.g., `webview/src/spec-viewer/__tests__/` if present, else `src/features/spec-viewer/__tests__/` as style reference).

- [x] **T003** [P] `ElapsedTimer` Preact component *(depends on T001)* — `webview/src/spec-viewer/components/ElapsedTimer.tsx` | R001, R003, R008
  - **Do**: Export `function ElapsedTimer({ startedAt }: { startedAt: string | null | undefined })`. Return `null` when `startedAt` is falsy. Use `useState<number>(Date.now())` + `useEffect` that starts `setInterval(() => setNow(Date.now()), 1000)` keyed on `startedAt` and clears the interval on unmount or `startedAt` change. Render `<span class="step-tab__elapsed">{formatElapsed(now - Date.parse(startedAt))}</span>`.
  - **Verify**: `npm run compile` passes; component imports from `preact` and `preact/hooks` (same as `StepTab.tsx`).
  - **Leverage**: `webview/src/spec-viewer/components/StepTab.tsx` for Preact JSX conventions and class-attribute style.

- [x] **T004** Wire `ElapsedTimer` into `StepTab` — `webview/src/spec-viewer/components/StepTab.tsx` | R001, R003
  - **Do**: Import `ElapsedTimer`. When `canonicalState === 'in-flight'` and `stepHistory?.[phase]?.startedAt` is set and no `completedAt`, render `<ElapsedTimer startedAt={stepHistory[phase].startedAt} />` as a sibling after `step-tab__substep`. Do not render when `inProgress` (last-step task-percent case) — only for true dispatch runs.
  - **Verify**: `npm run compile` passes; manual check in dev host shows the ticker on a running step.

- [x] **T005** [P] Derive `runningStepIndex` from `stepHistory` — `webview/src/spec-viewer/components/NavigationBar.tsx` | R001
  - **Do**: Replace the `runningStepIndex` IIFE to scan `stepHistory` for an entry with `startedAt` set and `completedAt == null`, then map that step name (aliased via the same doc-type mapping as StepTab) to an index in `coreDocs`. Remove the reliance on `activeStep` being populated.
  - **Verify**: `npm run compile` passes; existing NavigationBar stories still render.

- [x] **T006** [P] Mirror derivation in extension-side HTML — `src/features/spec-viewer/html/navigation.ts` | R001
  - **Do**: Change `runningStepIndex` computation to the same stepHistory-driven rule (step with `startedAt && !completedAt`). Render a static `<span class="step-tab__elapsed"></span>` placeholder for the in-flight tab so the first paint doesn't reflow when the Preact app mounts.
  - **Verify**: `npm run compile` passes.

- [x] **T007** [P] Style the elapsed indicator — `webview/styles/spec-viewer/_step-tabs.css` | NFR003
  - **Do**: Add `.step-tab__elapsed` rule — small muted text (`var(--vscode-descriptionForeground)`), `font-size: 0.75rem`, `margin-left: 6px`, `font-variant-numeric: tabular-nums` so digits don't jitter.
  - **Verify**: Visual check in dev host.
  - **Leverage**: existing `.step-tab__substep` rule in the same partial for sizing/weight.

- [x] **T008** Extension-side completion notifier — `src/features/spec-viewer/stepCompletionNotifier.ts` | R004, R005, R006, R007, R009
  - **Do**: Export `class StepCompletionNotifier` with `observe(specDir: string, prevCtx: SpecContext | null, nextCtx: SpecContext): void`. On first observe per `specDir`, seed `seenKeys` with every already-completed `{specDir}:{step}:{startedAt}` — no notification. On subsequent calls, diff `stepHistory` per step and fire `vscode.window.showInformationMessage(\`Spec ${specNumber} · ${StepLabel} complete\`, 'Open spec')` when a `completedAt` flipped from null to a string and its key is new; add the key to the set. Gate firing on `vscode.workspace.getConfiguration('speckit').get('notifications.stepComplete', true)`. If the user clicks "Open spec", post a `vscode.commands.executeCommand('speckit.spec-viewer.openForSpec', specDir)` (or the existing open command — check constants).
  - **Verify**: `npm run compile` passes; T009 tests green.
  - **Leverage**: `src/features/spec-viewer/specViewerProvider.ts` for the open-command name, and `src/core/utils/notificationUtils.ts` for existing `showInformationMessage` patterns.

- [x] **T009** [P] Unit tests for notifier *(depends on T008)* — `src/features/spec-viewer/__tests__/stepCompletionNotifier.test.ts` | R005, R006, R009
  - **Do**: Cover (a) first observe with an already-complete step → no notification, (b) two observes where `completedAt` flips null→ts → one notification, (c) same transition observed again → no re-notification, (d) setting `speckit.notifications.stepComplete = false` → silent, (e) two specs run in parallel → independent dedupe.
  - **Verify**: `npm test -- stepCompletionNotifier` green.
  - **Leverage**: `tests/__mocks__/vscode.ts` for `window.showInformationMessage` and `workspace.getConfiguration` mocks; add new mock APIs there if missing.

- [x] **T010** [P] Register notification setting — `package.json` | R009
  - **Do**: Under `contributes.configuration.properties`, add `speckit.notifications.stepComplete` — type `boolean`, default `true`, description `"Show a notification when a dispatched spec step completes."`.
  - **Verify**: `npm run compile` passes; VS Code settings UI shows the new entry in the Extension Development Host.

- [x] **T011** Wire notifier and populate `activeStep` — `src/features/spec-viewer/specViewerProvider.ts` | R004, R005, R006, NFR002
  - **Do**: Instantiate a module-level `StepCompletionNotifier`. Before posting `navState` in the update path (around line 784), call `notifier.observe(specDirectory, instance.state.lastFeatureCtx ?? null, featureCtx)` then store `instance.state.lastFeatureCtx = featureCtx`. Populate `navState.activeStep` from `stepHistory` (the step whose entry has `startedAt && !completedAt`, or `null`). Clear the notifier entry for the spec on webview dispose.
  - **Verify**: `npm run compile` passes; manual dispatch in dev host surfaces the info message on step completion; reopening the viewer after completion does not.

- [x] **T012** [P] README note — `README.md` | —
  - **Do**: Add a short bullet under the viewer UX section: "Running steps show a live elapsed timer; a VS Code notification fires when a dispatched step finishes (toggle via `speckit.notifications.stepComplete`)."
  - **Verify**: Markdown renders cleanly.

- [x] **T013** [P] Viewer-states doc update — `docs/viewer-states.md` | —
  - **Do**: In the step-tab state table, add the elapsed-indicator element to the `in-flight` row with a short description. Note the completion-notification side effect in the "transitions" section.
  - **Verify**: Markdown renders cleanly.

- [x] **T014** Final checks — *(depends on all above)* | —
  - **Do**: Run `npm run compile` then `npm test`. Fix any type or test failures.
  - **Verify**: Both commands exit 0.
