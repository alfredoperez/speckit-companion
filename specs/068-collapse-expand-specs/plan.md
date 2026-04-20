# Plan: Specs Pane UX — Collapse Toggle, Refresh Flicker, Sub-File Indent

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-20

## Approach

Three narrowly-scoped changes to the Specs tree, all landing in the existing `SpecExplorerProvider` + `specCommands.ts` + `package.json` surfaces: (1) add an in-memory `expandAllSpecs` flag on the provider, wire it to the `spec`-item collapsible state, and expose a single `speckit.specs.toggleCollapseAll` title-bar command whose icon swaps via a `speckit.specs.allCollapsed` context key; (2) eliminate flicker by replacing the two-phase loading fire in `refresh()` with a single `_onDidChangeTreeData.fire()` and deleting the duplicate un-debounced file watcher in `specCommands.ts`, leaving `core/fileWatchers.ts` as the only refresh driver; (3) confirm sub-file children (e.g. `data-model`, `quickstart`, `research` under Plan) return from `getChildren(planStepItem)` as real tree children — if the issue is merely visual VS Code indent, document the root cause and, if needed, ensure each sub-file item is returned with `collapsibleState = None` so VS Code renders it at the correct child depth.

## Technical Context

**Stack**: TypeScript 5.3+, VS Code Extension API (`@types/vscode ^1.84.0`).
**Constraints**: Changes must live entirely in `src/` and `package.json` (extension isolation — cannot ship `.claude/` or `.specify/` files). No new runtime dependencies.

## Files

### Create

_None — all changes modify existing files._

### Modify

- `package.json` — add command `speckit.specs.toggleCollapseAll` with two icons (via two menu entries gated on the `speckit.specs.allCollapsed` context key), place at `view/title` group `navigation@3`.
- `src/core/constants.ts` — add `toggleCollapseAll: 'speckit.specs.toggleCollapseAll'` to the `CommandIds` map.
- `src/features/specs/specCommands.ts` — register the toggle handler: on first click delegate to `workbench.actions.treeView.speckit.views.explorer.collapseAll` and set `speckit.specs.allCollapsed = true`; on second click flip `provider.expandAllSpecs = true`, call `provider.refresh()`, and set context key `false`. Also **remove** the three `watcher.onDidCreate/Change/Delete` direct `specExplorer.refresh()` calls at lines 180–182 — `core/fileWatchers.ts` already debounces refresh.
- `src/features/specs/specExplorerProvider.ts` —
  - Add `public expandAllSpecs: boolean = true` field.
  - At line 180 change the `spec` item creation to use `this.expandAllSpecs ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed`.
  - Replace `refresh()` (lines 41–49) with a single-fire implementation: `this._onDidChangeTreeData.fire()` only (drop `isLoading` two-phase fire, which is the flicker root cause; loading state is sub-second in practice and the two-fire pattern repaints the whole tree).
  - For sub-file children (`getStepSubFiles` output returned via `getRelatedDocItems` path), verify each leaf returns `TreeItemCollapsibleState.None` — they already do (line 317), so no code change; if verification shows indentation is a VS Code native rendering quirk, note it and close as WAI.
- `src/extension.ts` — on activate, call `vscode.commands.executeCommand('setContext', 'speckit.specs.allCollapsed', false)` so the default icon state matches the default `expandAllSpecs=true` flag.

## Data Model

_None — in-memory boolean on the provider and a VS Code context key only; no persisted state._

## Testing Strategy

- **Unit (specExplorerProvider)**: assert `getChildren(activeGroup)` returns `spec` items whose `collapsibleState` reflects `expandAllSpecs`.
- **Unit (specCommands)**: verify toggle command registered; when invoked, it executes `workbench.actions.treeView...collapseAll` first time and sets `speckit.specs.allCollapsed`; second invocation flips provider flag and calls `refresh()`.
- **Manual smoke**: open Extension Development Host, open a workspace with 3+ specs, click toggle button — observe specs collapse (button icon switches), click again — observe specs expand. Trigger a background write to a `.spec-context.json` and confirm no flicker and no loss of expanded nodes.

## Risks

- **Built-in `collapseAll` command ID drift**: the literal `workbench.actions.treeView.speckit.views.explorer.collapseAll` is VS Code–generated from the view id and can break on future VS Code versions or id rename. Mitigation: keep the view id `speckit.views.explorer` stable and centralize the literal in one constant.
- **Removing `specCommands.ts` watchers** may remove a refresh trigger we don't realize is load-bearing. Mitigation: verify `core/fileWatchers.ts` uses a pattern that covers the same files (`.claude/**/*` covers `.claude/specs/**`) before deletion; if the spec dir configured is outside `.claude/`, the pattern in `getFileWatcherPatterns().specs` is needed — in that case keep the watchers but have them funnel into the same 1s debounce.
