# Tasks: Lock Steps While Running

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-13

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Lock future step tabs while a step is running + add tooltips — `webview/src/spec-viewer/components/StepTab.tsx` | R001, R005, R006, R007
  - **Do**: In `StepTab.tsx`, compute `anyStepRunning` from `activeStep` + `stepHistory[activeStep]?.completedAt` (passed via props or read from `viewerState`). For tabs whose `phase !== activeStep` AND whose `index > indexOf(activeStep)` AND whose doc does not exist, force `isClickable = false` and add `'locked'` class. Add a `title` attribute to the `<button>` describing the step (map: specify→"Specify — define requirements", plan→"Plan — design approach", tasks→"Tasks — break into work items", implement→"Implement — execute and ship"). When locked, append ` (disabled while ${activeStep} is running)` to the title.
  - **Verify**: `npm run compile` passes; hovering a locked tab shows the reason tooltip; clicking it does nothing.
  - **Leverage**: existing `isClickable` / `disabled` wiring at StepTab.tsx:41,71.

- [x] **T002** Disable Regenerate + primary action while running, add button tooltips *(depends on T001)* — `webview/src/spec-viewer/components/FooterActions.tsx` | R002, R003, R004, R007
  - **Do**: Derive `isRunning = !!(vs?.activeStep && !vs?.stepHistory?.[vs.activeStep]?.completedAt)` (or equivalent from navState/viewerState). Pass `disabled={isRunning}` to Regenerate and the primary Approve/Complete/Reactivate buttons. Add `title` to each button: Edit Source="Open the raw markdown in an editor", Archive="Archive this spec", Regenerate="Regenerate the current step from scratch", Approve/Complete/Reactivate=their existing intent string. When `isRunning` is true, append ` (disabled while ${activeStep} is running)` to the disabled buttons' titles.
  - **Verify**: `npm run compile` passes; while a step runs the Regenerate and primary buttons are dimmed, non-clickable, and hover shows the reason tooltip; once `stepHistory[step].completedAt` is set, both re-enable.
  - **Leverage**: pattern already in use for `title={withScopeSuffix(a)}` at FooterActions.tsx:62.

- [x] **T003** Confirm Button forwards `disabled`/`title` + add disabled styling if needed *(depends on T002)* — `webview/src/shared/components/Button.tsx`, `webview/styles/spec-viewer/_footer.css` | R002, R003, R007
  - **Do**: Verify Button spreads `...rest` so `disabled` and `title` pass through (already true at Button.tsx:14). Ensure `button[disabled]` in `_footer.css` has visible dimmed styling (opacity 0.5, cursor not-allowed); add the rule if missing.
  - **Verify**: disabled buttons render visibly dimmed; storybook (if applicable) unchanged.
  - **Leverage**: existing `.step-tab.disabled` styling in `webview/styles/spec-viewer/_tabs.css` for visual parity.

---

## Progress

- Phase 1: T001–T003 [ ]
