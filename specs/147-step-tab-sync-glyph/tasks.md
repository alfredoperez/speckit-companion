# Tasks: Step tab sync glyph + locked in-flight clearing (#229)

Feature dir: `specs/147-step-tab-sync-glyph/`. Ordered by dependency. `[P]` = parallelizable.

## Implementation

- [x] **T001** Render the sync glyph in the empty in-flight indicator — `webview/src/spec-viewer/components/StepTab.tsx`. When `canonicalState === 'in-flight'` and there is no percentage string, render a `<span class="codicon codicon-sync step-status__sync" aria-hidden="true">` inside `.step-status` (keep the `NN%` pill path for implement `inProgress` unchanged). Satisfies FR-001, FR-003, FR-008.
- [x] **T002** Style the glyph — `webview/styles/spec-viewer/_navigation.css`. For the empty in-flight `.step-status`: remove the filled-circle look (transparent bg/border, no `working-pulse`), color the `codicon-sync` with a VS Code theme var, and spin it via the existing `spin` keyframe. Leave `.step-tab.in-flight .step-status:not(:empty)` (percentage pill) intact. Satisfies FR-001, FR-002, FR-008.

## Regression tests

- [x] **T003 [P]** Extension derivation lock — `src/features/specs/__tests__/stepHistoryDerivation.test.ts`. Add: a `by: "ai"` step-level `complete` (currentStep still on that step, status advanced) sets a non-null `completedAt` and `findRunningStep` returns null; a started-but-not-completed step stays in flight. Satisfies SC-001, FR-004, FR-007.
- [x] **T004 [P]** Webview tab lock — `webview/src/spec-viewer/components/__tests__/StepTab.test.tsx`. Add: an in-flight tab renders the `codicon-sync` glyph; re-rendering with completed `stepHistory` + null `activeStep` flips the tab to `done`, shows the checkmark, and the sync glyph is gone; the elapsed timer is present while running and absent when done. Satisfies SC-002, SC-003, SC-004, FR-005.

## Stories + docs

- [x] **T005 [P]** Update StepTab stories — `webview/src/spec-viewer/components/StepTab.stories.tsx`. Ensure an in-flight story surfaces the new sync glyph. Satisfies FR-009.
- [x] **T006 [P]** Update `docs/viewer-states.md` — document the step-tab in-flight sync glyph and when in-flight clears. Satisfies FR-010.

## Verification

- [x] **T007** Run `npm run compile`, `npm run compile-web`, and `npm test` — all clean. Satisfies SC-005.
