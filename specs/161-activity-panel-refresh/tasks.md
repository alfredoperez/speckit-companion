# Tasks: Activity Panel Refresh

- [x] **T001** [P] Ensure the VS Code test mock's `createFileSystemWatcher` records the registered pattern and the `onDidChange`/`onDidCreate`/`onDidDelete` handlers so a test can invoke them + tests/__mocks__/vscode.ts
- [x] **T002** Add a watcher regression test: `setupSpecContextWatchers` registers one watcher per `getFileWatcherPatterns().specContext` pattern; firing `onDidChange` on a `.spec-context.json` calls `refreshContextIfDisplaying`, and `onDidCreate` also refreshes the sidebar + tests/unit/core/fileWatchers.spec.ts
- [x] **T003** [P] Add a payload-completeness test asserting the derived viewer state used by the refresh path carries full `history`, per-task `taskSummaries`, and `filesModified` from `.spec-context.json` + tests/unit/spec-viewer/stateDerivation.spec.ts
- [x] **T004** Run `npm test`; confirm the new tests pass and the full suite is green + (suite)
- [ ] **T005** Manually verify in the Extension Development Host: open a spec with the Activity panel visible, advance a step and journal a task, confirm the panel reflects each within ~2s with no tab switch, and that tab navigation still refreshes + (manual, Extension Development Host)
- [x] **T006** If T005 reveals a field still stale until a tab switch, include it in the refresh payload and add a covering assertion; otherwise record that no production change was needed + src/features/spec-viewer/specViewerProvider.ts
