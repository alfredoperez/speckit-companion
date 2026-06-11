# Tasks: status-driven in-flight, banner relocation, sub-nav dot

Dependency-ordered, traceable to files and `FR-…`. `[P]` = parallelizable (different files, no incomplete dependency).

## Foundational

- [x] **T001** [P] Add optional `showInstallPrompt?: boolean` to `NavState` in `webview/src/spec-viewer/types.ts` (FR-005)

## Core work

- [x] **T002** Drive the in-flight indicator off transition `status` in `webview/src/spec-viewer/components/StepTab.tsx`: add a status→in-flight-step map and a settled-status set, redefine `isWorking` so settled statuses never spin (even with missing `completedAt`) and the active in-flight status always spins (FR-001, FR-002, FR-003, FR-004, FR-009)
- [x] **T003** [P] Remove the `.step-child--parent::after { content: '·' }` middot rule in `webview/styles/spec-viewer/_navigation.css` (FR-008)
- [x] **T004** Render the install banner markup inside `ActivityPanel` in `webview/src/spec-viewer/components/ActivityPanel.tsx`, gated on `navState.value.showInstallPrompt`, reusing the same id/classes/`data-action` buttons as `installBanner.ts` (FR-005, FR-006, FR-007)

## Integration

- [x] **T005** In `src/features/spec-viewer/html/generator.ts`: drop the `${installBanner}` injection above `#app-root`, pass `showInstallPrompt` into `initialNavState`, and change the banner click `<script>` to delegate from `document` (`.closest('#install-banner [data-action]')`) so it survives the Preact mount, keeping the `instanceof Element` guard and the two message dispatches (FR-005, FR-006)

## Polish

- [x] **T006** Extend `webview/src/spec-viewer/components/__tests__/StepTab.test.tsx` with a test that a settled `status` (e.g. `ready-to-implement`) does NOT spin even when `stepHistory[step].completedAt` is missing, plus a test that the in-flight `status` (e.g. `implementing`) does spin; assert the #229 glyph/checkmark cases still hold (FR-002, FR-003, FR-009, SC-001, SC-002, SC-006)
- [x] **T007** Run `npm run compile && npm test`; fix any failures and confirm green (SC-006)

## Dependencies

- T001 blocks T004 and T005 (NavState field must exist before the webview/generator read it).
- T002 is independent of T001/T003 (different file).
- T006 depends on T002 (tests the new derivation).
- T007 depends on all prior tasks.

## Parallel

- T001 and T002 and T003 touch different files and can run together.
- T004 and T005 both depend on T001; run after it (T004/T005 are not mutually `[P]` since they share the banner contract but touch different files — they can proceed in parallel once T001 lands).
