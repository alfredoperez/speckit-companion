# Tasks: Specs Pane UX — Collapse Toggle, Refresh Flicker, Sub-File Indent

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-20

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Single-fire refresh to kill flicker — `src/features/specs/specExplorerProvider.ts` | R007, R009
  - **Do**: Replace `refresh()` (lines 41–49) so it fires `this._onDidChangeTreeData.fire()` once. Remove the `isLoading = true`, `setTimeout`, and second fire. Leave the `isLoading` field reference in `getChildren` (line 83) harmless — it will simply never be true via this path.
  - **Verify**: `npm run compile` passes. Manual: trigger a spec-context write; tree should update in place without a blank "loading..." flash.
  - **Leverage**: `src/core/providers/BaseTreeDataProvider.ts:41-43` (the single-fire pattern used by the base class).

- [x] **T002** Remove duplicate un-debounced file watcher — `src/features/specs/specCommands.ts` | R008, R009
  - **Do**: Delete lines 176–184 (the `for (const pattern of watcherPatterns.specs)` block that registers `onDidCreate/onDidDelete/onDidChange → specExplorer.refresh()`). Also delete the now-unused import of `getFileWatcherPatterns` if no other caller remains. Verify `core/fileWatchers.ts` setupClaudeDirectoryWatcher already covers `.claude/**/*` with its 1s debounce; if specs can live outside `.claude/`, instead replace the three direct `refresh()` calls with coalesced debounced calls (1s setTimeout, shared across the three events).
  - **Verify**: `npm run compile` + `npm test` pass. Manual: create/edit/delete a spec file; tree refreshes within ~1 second (not instantly, not flickering).

- [x] **T003** Add `expandAllSpecs` flag + toggle the `spec` item collapsible state — `src/features/specs/specExplorerProvider.ts` | R003, R005, R006
  - **Do**: Add `public expandAllSpecs: boolean = true` as a field on `SpecExplorerProvider`. Change the `SpecItem` construction at line 180 from the literal `vscode.TreeItemCollapsibleState.Expanded` to `this.expandAllSpecs ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed`. No other `collapsibleState` literals change (group headers and step items keep their existing values).
  - **Verify**: `npm run compile` passes. The unit test added in T006 will exercise both states.

- [x] **T004** Add command constant — `src/core/constants.ts` | R001
  - **Do**: Add `toggleCollapseAllSpecs: 'speckit.specs.toggleCollapseAll'` to the `CommandIds` map (co-located with `refresh: 'speckit.refresh'` at line 15).
  - **Verify**: `npm run compile` passes.
  - **Leverage**: existing entries in `CommandIds` (`create`, `refresh`).

- [x] **T005** Register toggle command and wire context key — `src/features/specs/specCommands.ts` + `src/extension.ts` | R001, R002, R003, R004
  - **Do**: In `specCommands.ts` (next to `speckit.refresh` registration at line 71), register `speckit.specs.toggleCollapseAll`. Handler logic: read `specExplorer.expandAllSpecs`; if `true`, call `vscode.commands.executeCommand('workbench.actions.treeView.speckit.views.explorer.collapseAll')`, set `specExplorer.expandAllSpecs = false`, and set context `speckit.specs.allCollapsed = true`; else set `specExplorer.expandAllSpecs = true`, call `specExplorer.refresh()`, and set context `speckit.specs.allCollapsed = false`. In `src/extension.ts` activate (after `specExplorer` is constructed at line 108), call `vscode.commands.executeCommand('setContext', 'speckit.specs.allCollapsed', false)` to seed the default.
  - **Verify**: `npm run compile` passes; unit test in T006.
  - **Leverage**: `speckit.refresh` registration pattern at `specCommands.ts:71-76`.

- [x] **T006** Contribute command + title-bar menu entries with icon swap — `package.json` | R001, R004, R007-tooltip (R007 renumbered as tooltip requirement)
  - **Do**: Under `contributes.commands`, add `speckit.specs.toggleCollapseAll` twice-in-one entry style is not supported — add one command with `title: "Collapse All Specs"`, `category: "SpecKit"`, `icon: "$(collapse-all)"`. Under `contributes.menus."view/title"`, add two entries both referencing `speckit.specs.toggleCollapseAll` at `group: "navigation@3"` but with opposite icon + tooltip + `when` clauses: one entry `when: "view == speckit.views.explorer && !speckit.specs.allCollapsed"` with icon `$(collapse-all)` and title `"Collapse All Specs"`; the other `when: "view == speckit.views.explorer && speckit.specs.allCollapsed"` with icon `$(expand-all)` and title `"Expand All Specs"`. Use the per-menu `icon`/`title` override fields so the same command id shows different visuals based on state.
  - **Verify**: `npm run compile` passes; run Extension Development Host (F5), open the Specs view, confirm the new icon appears to the right of the refresh icon and flips between `$(collapse-all)` and `$(expand-all)` on click.

- [x] **T007** Unit tests for toggle behavior and single-fire refresh — `src/features/specs/__tests__/specExplorerProvider.test.ts` (add or extend) + `src/features/specs/specCommands.test.ts` | R002, R003, R005, R007
  - **Do**: Add a test asserting `expandAllSpecs=true` yields `spec` items with `collapsibleState === Expanded` and `false` yields `Collapsed`. Add a test asserting `refresh()` fires `_onDidChangeTreeData` exactly once per call (spy/count). In `specCommands.test.ts`, assert the toggle command is registered and that first invocation calls `workbench.actions.treeView.speckit.views.explorer.collapseAll` and second invocation calls `refresh()`.
  - **Verify**: `npm test` passes.
  - **Leverage**: `tests/__mocks__/vscode.ts` for `commands.executeCommand` mock; existing test in `specCommands.test.ts` at line 87 for the command-registered pattern.

- [x] **T008** Verify sub-file indentation renders correctly; document finding — `src/features/specs/specExplorerProvider.ts` (verify only) + `docs/viewer-states.md` or inline code comment | R011, R012
  - **Do**: In Extension Development Host, open a spec with sub-files (e.g. `060-spec-context-tracking` which has `data-model.md`, `quickstart.md`, `research.md`). Confirm that when Plan is expanded, its children render one indentation level deeper than Plan. If they do (expected — `getRelatedDocItems` returns them from `getChildren(planItem)` and VS Code indents automatically), no code change needed; add a one-line code comment above `getRelatedDocItems` noting the parent-child contract. If visually they appear flush with Plan, inspect the contextValue — `spec-document-plan` children go through the `contextValue?.startsWith('spec-document-')` branch at line 204; ensure that branch is actually hit and not short-circuited. Adjust only if a bug is found.
  - **Verify**: Screenshot of the Specs tree with Plan expanded showing three indented sub-files.

- [x] **T009** Update docs — `docs/architecture.md`, `README.md` | R001-R012
  - **Do**: In `README.md`, add a line under the Specs pane / tree description mentioning the new title-bar toggle button. In `docs/architecture.md`, note the single-fire refresh contract and that `core/fileWatchers.ts` is the sole refresh driver for the Specs tree (remove any reference to the now-deleted `specCommands.ts` watchers).
  - **Verify**: `npm run compile` passes (docs-only change, but re-run for safety); readme/architecture read through for consistency.

---

## Progress

- Phase 1: T001–T009 [ ]
