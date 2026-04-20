# Spec: Specs Pane UX — Collapse Toggle, Refresh Flicker, Sub-File Indent

**Slug**: 068-collapse-expand-specs | **Date**: 2026-04-20

## Summary

Improves the Specs tree (`speckit.views.explorer`) in three related ways: (1) adds a title-bar toggle button to collapse/expand all spec items at once; (2) fixes constant refresh flicker and loss of expand state caused by overlapping file watchers and a two-phase loading re-fire; (3) ensures sub-files beneath a step node (e.g. `data-model`, `quickstart`, `research` under `Plan`) render with proper tree indentation.

## Requirements

### Collapse/Expand Toggle

- **R001** (MUST): A title-bar button appears on the `speckit.views.explorer` view at `navigation@3` (after `speckit.create` and `speckit.refresh`).
- **R002** (MUST): Clicking the button while in the "expanded" state collapses all spec items inside each status group by delegating to VS Code's built-in `workbench.actions.treeView.speckit.views.explorer.collapseAll` command.
- **R003** (MUST): Clicking the button while in the "collapsed" state expands all spec items by re-emitting them with `TreeItemCollapsibleState.Expanded` and firing the tree's `onDidChangeTreeData` event.
- **R004** (MUST): The button icon reflects the current state — one icon when the next click will collapse, another when the next click will expand. Tooltip describes the next action.
- **R005** (MUST): The expand/collapse state is tracked in the provider (in-memory only) and does NOT persist across VS Code sessions.
- **R006** (MUST): Toggle applies only to `spec` items (individual specs), not to group headers (`Active` / `Completed` / `Archived`) nor to the per-spec document children under each spec.

### Refresh Flicker + State Loss

- **R007** (MUST): Refreshing the tree MUST NOT fire `onDidChangeTreeData` twice for a single refresh cycle. The current "loading state then content state" two-fire pattern in `SpecExplorerProvider.refresh()` (src/features/specs/specExplorerProvider.ts:41-49) must be replaced with a single fire.
- **R008** (MUST): Only one debounced file-watcher path drives tree refreshes. The un-debounced `watcher.onDidCreate/onDidDelete/onDidChange` handlers in `specCommands.ts:180-182` that call `specExplorer.refresh()` directly must be removed or coalesced into the existing debounced pipeline in `core/fileWatchers.ts`.
- **R009** (MUST): The user's expand/collapse state for individual tree nodes (which specs, which steps are expanded) is preserved across refreshes triggered by background file events. A passive background write (e.g. another tool updating `.spec-context.json`) MUST NOT collapse the user's currently expanded nodes.
- **R010** (SHOULD): Background transitions that don't change the set of specs or the status-group membership should avoid triggering a full tree re-emit — tree data fires only when displayed tree structure actually changes.

### Sub-File Indentation

- **R011** (MUST): Sub-file children under a step node (e.g. files discovered via `subDir`/`subFiles` such as `data-model`, `quickstart`, `research` under `Plan`) render with clear visual indentation one level deeper than the step node they belong to.
- **R012** (MUST): The indentation MUST be consistent with how other nested tree items (e.g. spec documents under a spec) render — achieved via the tree's natural parent-child structure (child returned from `getChildren(step)`), not through leading whitespace in the label.

## Scenarios

### Toggle collapses all specs on first click

**When** the Specs view has multiple specs expanded and the user clicks the title-bar toggle button
**Then** every `spec` tree item collapses, the provider state flips to "collapsed", and the button icon updates to indicate the next click will expand.

### Toggle expands all specs on second click

**When** the Specs view is in the "collapsed" state and the user clicks the toggle again
**Then** every `spec` tree item renders with `TreeItemCollapsibleState.Expanded`, the provider fires `onDidChangeTreeData`, and the icon updates.

### Toggle state does not persist across reload

**When** the user closes and reopens the workspace
**Then** the provider starts in its default state (spec items expanded by default, as before) — the prior toggle choice is not restored.

### Group headers are unaffected by toggle

**When** the toggle is clicked in either direction
**Then** `Active` / `Completed` / `Archived` group headers retain their default collapsible state (Active expanded, Completed and Archived collapsed); only the `spec` items under them are affected.

### Background update does not flicker or collapse nodes

**When** a background process (e.g. another extension command, the spec viewer, or an AI CLI) writes to `.spec-context.json` while the user has several spec trees expanded
**Then** the tree updates in place without a visible "blank → populated" flash, and any nodes the user had expanded remain expanded.

### Sub-files under Plan render indented

**When** a spec has sub-files beneath a step (e.g. `data-model.md`, `quickstart.md`, `research.md` under `Plan`)
**Then** those sub-files appear as children of the Plan node with one additional level of indentation beyond the Plan label, matching the visual depth of `spec-document` items under a `spec`.

## Out of Scope

- Persisting collapse/expand preference across sessions or workspace reloads.
- Collapsing/expanding document children (`spec-document-*`) under each spec via the title-bar toggle.
- Rewriting the file-watcher architecture beyond removing the duplicate un-debounced refresh path.
- Changes to the Steering view or other tree views.
