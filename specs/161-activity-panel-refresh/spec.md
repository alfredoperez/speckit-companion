# Activity Panel Refresh

Tracking issue: https://github.com/alfredoperez/speckit-companion/issues/278

## Overview

The Activity panel in the spec viewer must update on its own as a spec progresses — new step transitions and per-task progress appearing within a second or two with no navigation. The live-refresh code path for this already shipped (the spec-context file watcher now feeds a complete viewer-state refresh into the panel), so this change verifies the issue-#278 acceptance criteria hold on current `main` and locks the behavior with regression coverage, since the original defect was an uncovered watcher-scoping miss that this class of change keeps reintroducing.

## Functional Requirements

- **FR-001** The system MUST observe `.spec-context.json` writes under every configured spec-directory location (including the default `specs/` layout), not only under `.claude/`, so a step or task write is never missed by the open viewer.
- **FR-002** On any observed `.spec-context.json` write for the spec a viewer has open, the viewer MUST receive a refresh carrying the complete current activity state — full step history, per-task summaries, and the modified-files list — rather than a partial payload, so every Activity card can re-render from a single message.
- **FR-003** When a step transition is recorded, the Activity panel's step-progression view MUST reflect it without the user navigating to another step and back.
- **FR-004** When task progress is recorded (a per-task summary is journaled during implement), the Activity panel's task view MUST reflect it as soon as it is recorded, not only after a step switch.
- **FR-005** The live update MUST behave consistently across all steps (specify through implement) and MUST NOT depend on the user also opening a different document.
- **FR-006** Manual navigation between step tabs MUST continue to refresh the Activity panel exactly as before — the live-refresh path MUST NOT regress the existing tab-switch refresh.
- **FR-007** The change MUST add automated regression coverage for the two behaviors the original defect lacked: (a) a spec-context watcher is registered for each configured spec-directory pattern and a write dispatches the viewer refresh, and (b) the refresh payload includes step history, per-task summaries, and modified files.
- **FR-008** If verification finds any Activity field still going stale until a tab switch, that field MUST be included in the live-refresh payload and covered by a regression assertion; absent such a finding, no production behavior change is required.

## Success Criteria

- **SC-001** With a spec open and the Activity panel visible, a recorded step completion is reflected in the panel within 2 seconds with zero tab switches.
- **SC-002** A newly-journaled implement task appears in the Activity panel's task view within 2 seconds, without switching steps.
- **SC-003** SC-001 and SC-002 hold for every step in the pipeline and do not depend on opening any other document.
- **SC-004** Navigating between step tabs still refreshes the Activity panel — no observable regression versus current behavior.
- **SC-005** The test suite gains at least one passing test asserting a context watcher is registered per configured spec-directory pattern and that a context write triggers the viewer refresh, and at least one passing test asserting the refresh payload carries step history, per-task summaries, and modified files. The full suite passes.

## Assumptions

- The watcher-and-refresh code path already landed (issue #278 is a symptom of #277 Child 3 / #270; the fix shipped in the reliable-implement-settle change). This work verifies and guards it; it does not re-implement the watcher unless verification exposes a real gap.
- No user-facing behavior change is expected. The primary deliverable is verification plus regression tests. A changelog/docs note is warranted only if FR-008 forces an actual payload fix.
- Tests rely on the existing extension-side VS Code mock (`tests/__mocks__/vscode.ts`); a watcher test captures the handlers passed to `createFileSystemWatcher` to assert registration and dispatch, consistent with the repo's known config-mock coverage gap.
- The "within 2 seconds" target reflects the existing debounce/refresh timing of the spec-context watcher path, not a new performance budget.

## Approach

The live-refresh chain already exists on `main`: `setupSpecContextWatchers` (`src/core/fileWatchers.ts`) watches `.spec-context.json` under each configured pattern and calls `refreshContextIfDisplaying`, which posts a complete `viewerStateUpdated` (history + task summaries + modified files); the webview handler updates the shared viewer-state signal so every Activity card re-renders. The missing piece is coverage — there is no `fileWatchers` test, and `refreshContextIfDisplaying` is only mocked.

Files to touch:
- `tests/__mocks__/vscode.ts` — ensure `createFileSystemWatcher` returns a capturable stub (record registered patterns and `onDidChange`/`onDidCreate`/`onDidDelete` handlers) if not already supported.
- `tests/unit/core/fileWatchers.spec.ts` (new) — assert `setupSpecContextWatchers` registers one watcher per `getFileWatcherPatterns().specContext` pattern, that an `onDidChange` on a `.spec-context.json` invokes `refreshContextIfDisplaying`, and that an `onDidCreate` also refreshes the sidebar.
- `tests/unit/spec-viewer/stateDerivation.spec.ts` (extend, or a new `refreshPayload.spec.ts`) — assert the derived viewer state used by the refresh path carries `history`, per-task `taskSummaries`, and `filesModified` from `.spec-context.json`, so the refresh is not a partial payload.
- `src/features/spec-viewer/specViewerProvider.ts` — only if FR-008's verification surfaces a residual stale field omitted from the `skipContentAndStaleness` refresh payload.

Dependencies: existing VS Code mock and `getFileWatcherPatterns`/`deriveViewerState` helpers; manual confirmation in the Extension Development Host for SC-001–SC-004.
