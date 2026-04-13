# Tasks: Viewer State Derivation Wiring

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-13

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add `ViewerState` to webview types — `webview/src/types.ts` | R003
  - **Do**: Add `ViewerState` interface mirroring `src/core/types/specContext::ViewerState` (fields: `status`, `pulse`, `highlights`, `activeSubstep`, `steps`, `footer: Array<{id, label, scope, tooltip}>`). Add optional `viewerState?: ViewerState` to the `contentUpdated` message shape.
  - **Verify**: `npm run compile` passes with no type errors.
  - **Leverage**: `src/core/types/specContext.ts` (authoritative shape).

- [x] **T002** Derive and attach `viewerState` in extension send path *(depends on T001)* — `src/features/spec-viewer/specViewerProvider.ts` | R001, R002
  - **Do**: In `sendContentUpdateMessage`, call `deriveViewerState(ctx, activeStep)`; map `footer` entries to `{id, label, scope, tooltip}` (strip any function fields); attach as `viewerState` on the outgoing `contentUpdated` message.
  - **Verify**: `npm run compile` passes; manual webview inspect shows `viewerState` present on message.
  - **Leverage**: existing `deriveViewerState` in `src/features/spec-viewer/stateDerivation.ts`.

- [x] **T003** Route footer button clicks by id *(depends on T002)* — `src/features/spec-viewer/messageHandlers.ts` | R005
  - **Do**: Add/extend a case that receives `{type: 'footerAction', id}` from the webview and dispatches to the existing handler for that id.
  - **Verify**: Clicking each footer button triggers its prior behavior.

- [x] **T004** Add `viewerState` signal on webview *(depends on T001)* — `webview/src/spec-viewer/signals.ts` | R001
  - **Do**: Export a `viewerState` Preact signal, populated from the `contentUpdated` message alongside `navState`.
  - **Verify**: Components can read `viewerState.value` without type errors.
  - **Leverage**: existing `navState` signal in the same file.

- [x] **T005** Migrate `FooterActions` to iterate `viewerState.footer` *(depends on T004)* — `webview/src/spec-viewer/components/FooterActions.tsx` | R004, R010
  - **Do**: Replace the `isTasksDone` / `isCompleted` / `isArchived` heuristics with `state.footer.map(a => <Button id=a.id title={withScopeSuffix(a)} onClick={() => send({type:'footerAction', id:a.id})}>{a.label}</Button>)`. Keep `Edit Source` and `Archive` (or route them through footer entries if present).
  - **Verify**: Visible buttons match `viewerState.footer` in each scenario from spec.md.

- [x] **T006** Migrate `SpecHeader` to read `viewerState.status` *(depends on T004)* — `webview/src/spec-viewer/components/SpecHeader.tsx` | R008
  - **Do**: Replace `ns.badgeText` recomputation with a direct read of `viewerState.status` (format via a small helper if needed).
  - **Verify**: Header badge matches status in completed / active / archived specs.

- [x] **T007** Migrate stepper classes to `viewerState` *(depends on T004)* — `webview/src/spec-viewer/components/StepTab.tsx`, `src/features/spec-viewer/html/stepper.ts` | R006, R007, R009
  - **Do**: Apply `.step-tab.pulse` only when `viewerState.pulse === step`; `.step-tab.completed` when `viewerState.highlights.includes(step)`. Render a secondary substep label when `viewerState.activeSubstep?.step === step`. Remove all `.in-progress` / `.working` toggles.
  - **Verify**: Completed spec shows no pulse; mid-plan spec shows pulse on Plan only (stable across tab clicks); substep label appears when set.

- [x] **T008** CSS consolidation *(depends on T007)* — `webview/styles/spec-viewer/_navigation.css`, `webview/styles/spec-viewer/_animations.css` | R009, NFR002
  - **Do**: Delete all `.step-tab.in-progress` and `.step-tab.working` rules. Add `.step-tab.completed` (green highlight) and `.step-tab.pulse` (blue pulse animation). Add `.step-tab__substep` style for the secondary label.
  - **Verify**: Grep `webview/styles/**` for `in-progress` and `working` — no matches remain. Visual layout unchanged per R011.

- [x] **T009** Component test for `FooterActions` *(depends on T005)* — `webview/src/spec-viewer/components/__tests__/FooterActions.spec.tsx` | R010
  - **Do**: Render `FooterActions` with a mocked `viewerState.footer` of 3 entries; assert 3 buttons render and each tooltip contains the scope suffix.
  - **Verify**: `npm test` passes.
  - **Leverage**: any existing Preact component test under `webview/**/__tests__/` as a pattern reference.

- [x] **T010** Manual scenario walkthrough *(depends on T008, T009)* — N/A | all scenarios
  - **Do**: Run `npm run compile`; press F5; open a completed spec, a mid-plan spec, and an sdd-draft spec. Walk through the 5 scenarios from spec.md.
  - **Verify**: All 5 scenarios pass as described.

---

## Progress

- Phase 1: T001–T010 [ ]
