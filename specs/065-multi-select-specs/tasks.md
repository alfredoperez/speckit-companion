# Tasks: Multi Select Specs

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-13

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add selection context keys module — `src/features/specs/selectionContextKeys.ts` | R003, R004
  - **Do**: Create new module exporting `updateSelectionContextKeys(selection: SpecItem[])` that calls `vscode.commands.executeCommand('setContext', ...)` for `speckit.specs.selection.count`, `speckit.specs.selection.allActive`, `speckit.specs.selection.allCompleted`, `speckit.specs.selection.allArchived`, and `speckit.specs.selection.mixed`. Derive booleans from each item's status group.
  - **Verify**: `npm run compile` succeeds; module exports a single function.
  - **Leverage**: Inspect existing status derivation in `src/features/specs/specExplorer.ts` (or similar) for how status groups are resolved per item.

- [x] **T002** Migrate sidebar to createTreeView with canSelectMany *(depends on T001)* — `src/extension.ts` | R001, R004
  - **Do**: Replace `vscode.window.registerTreeDataProvider(Views.explorer, specExplorer)` with `const specsTreeView = vscode.window.createTreeView(Views.explorer, { treeDataProvider: specExplorer, canSelectMany: true })`. Wire `specsTreeView.onDidChangeSelection(e => updateSelectionContextKeys(e.selection))`. Push `specsTreeView` into `context.subscriptions`. Export/pass `specsTreeView` to command registration so bulk handlers can read the current selection as a fallback.
  - **Verify**: Extension loads in dev host; Ctrl/Cmd+click in the Specs tree selects multiple items; no regressions in single-click behavior.

- [x] **T003** Bulk status command handlers *(depends on T002)* — `src/features/specs/specCommands.ts` | R002, R005, R006
  - **Do**: Change `speckit.markCompleted`, `speckit.archive`, and `speckit.reactivate` to the `(item, items?: SpecItem[])` signature. Resolve target list as `items ?? (item ? [item] : [])`. Iterate, call existing `setStatus`/`reactivate` per spec, await all, then call `specExplorer.refresh()` exactly once and show one `vscode.window.showInformationMessage` summarizing the count (singular when 1, e.g. `"1 spec marked as completed"` vs `"3 specs marked as completed"`). Also call `updateSelectionContextKeys` synchronously at the start of each handler as a safety net against stale keys. Register `speckit.reactivate` command contribution if missing.
  - **Verify**: Manual run — multi-select 3 active specs → Mark as Complete → single toast "3 specs marked as completed", tree refreshes once, all 3 move to Complete group.
  - **Leverage**: Existing single-item handler bodies in `src/features/specs/specCommands.ts`.

- [x] **T004** Context-menu `when` clauses *(depends on T003)* — `package.json` | R003, R004
  - **Do**: Update `contributes.menus.view/item/context` entries for the three commands. Add `when` clauses using the new context keys: "Mark as Complete" shown when `!speckit.specs.selection.allCompleted && !speckit.specs.selection.allArchived`; "Archive" shown when `!speckit.specs.selection.allArchived`; "Move to Active" shown when `!speckit.specs.selection.allActive`. Ensure `speckit.reactivate` has a command contribution entry if newly added.
  - **Verify**: Right-click two already-completed specs → "Mark as Complete" is hidden; "Archive" and "Move to Active" appear. Mixed selection shows only Archive.

- [x] **T005** Tests for bulk handlers *(depends on T003)* — `src/features/specs/specCommands.test.ts` | R002, R005, R006
  - **Do**: Add BDD tests: (a) invoking `markCompleted` with `items` of 3 specs calls `setStatus` 3× and `specExplorer.refresh` once and `showInformationMessage` once with plural message; (b) invoking with only `item` (no `items`) behaves identically to current single-select — `setStatus` once, singular toast; (c) `archive` and `reactivate` follow the same bulk semantics.
  - **Verify**: `npm test` passes; new tests cover both multi and single-select paths.
  - **Leverage**: Existing test harness / mocks in `src/features/specs/specCommands.test.ts`; VS Code mock at `tests/__mocks__/vscode.ts` (extend if needed for `showInformationMessage`).

---

## Progress

- Phase 1: T001–T005 [x]
