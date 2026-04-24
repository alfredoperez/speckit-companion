# Spec: Filter/search box above the specs tree

**Slug**: 075-filter-specs-tree | **Date**: 2026-04-23

## Summary

Add a fuzzy filter for the SpecKit specs tree so users with many specs can narrow the list by typing part of a slug or feature name. The active filter query persists in workspace state so it survives VS Code reloads, and an obvious affordance lets users clear it.

## Requirements

- **R001** (MUST): A title-bar action on the `speckit.views.explorer` tree view opens a filter prompt. Invoking the action with an existing query pre-fills the input with the current query so edits are incremental.
- **R002** (MUST): When a filter query is active, the tree shows only specs whose slug OR `specName` (from `.spec-context.json`) fuzzy-matches the query. Matching is case-insensitive, ignores non-alphanumeric characters, and treats the query as a subsequence (not substring) — e.g. `ftr` matches `filter-specs-tree`.
- **R003** (MUST): Group nodes (`Active`, `Completed`, `Archived`) are shown only if they contain at least one matching spec. A group's count badge reflects the number of **visible** (filtered) specs, not the total.
- **R004** (MUST): The active filter query is persisted to `context.workspaceState` under a stable key and restored on extension activation. Clearing the filter removes the persisted value.
- **R005** (MUST): A dedicated "clear filter" title-bar action is visible only while a filter is active. Invoking it empties the query, persists the cleared state, and refreshes the tree to show all specs.
- **R006** (MUST): While a filter is active, the tree view title or an inline indicator makes it obvious a filter is applied, so users aren't confused by a short spec list. A visible count (e.g. `Showing N of M`) in a welcome message, group label, or title suffix is acceptable.
- **R007** (SHOULD): If the filter is active and no specs match, the tree shows an empty-state message with a hint to clear the filter (via `viewsWelcome` or a visible no-match row), instead of rendering an empty tree.
- **R008** (SHOULD): The filter preserves user selection and multi-select behavior — specs that are filtered out become unselectable (as they are hidden), but re-appearing after a filter change does not destroy the selection of specs that remain visible.
- **R009** (MAY): A keybinding hint is surfaced in the action tooltip (e.g. "Filter specs…"). An explicit keybinding is out of scope but should be easy to add later via `package.json`.

## Scenarios

### Applying a filter

**When** the user clicks the filter action in the specs tree title bar and types `tree` into the prompt
**Then** the tree re-renders showing only specs whose slug or specName contains the subsequence `tree` (e.g. `068-collapse-expand-specs` if specName includes "tree", `071-tree-group-counts`, `075-filter-specs-tree`), group counts reflect only the visible specs, and the query is saved to workspace state.

### Filter persists across reloads

**When** the user has an active filter, reloads the VS Code window, and the extension reactivates
**Then** the same filter is still applied to the tree on first paint, and the clear-filter action is visible.

### Clearing the filter

**When** the user clicks the clear-filter action while a filter is active
**Then** the tree immediately shows all specs grouped as before, group counts return to their full totals, the clear-filter action disappears, and the persisted query is removed from workspace state.

### Empty filter result

**When** the user applies a filter that matches zero specs
**Then** the tree either shows a welcome/empty-state with text like "No specs match '{query}'. Clear filter to see all specs." or renders a single placeholder row with a clear action, instead of showing an empty groupless tree.

### Fuzzy matching

**When** the user types `fgc` as a filter
**Then** specs like `071-tree-group-counts` match (subsequence of letters `f`… wait no — `fgc` matches `filter-group-counts` if such a slug existed; but `071-tree-group-counts` does not contain `fgc` in order). The tree only shows specs whose slug or specName contains all query characters in order, case-insensitively, ignoring separators.

### Special characters and whitespace

**When** the user types a query with spaces or punctuation (e.g. `tree view`)
**Then** the matcher normalizes the query by lowercasing and stripping non-alphanumerics on both sides before subsequence matching, so `tree view` behaves like `treeview`.

### Interaction with collapse/expand and multi-select

**When** the user has multiple specs selected, then applies a filter that hides some selected specs, then clears the filter
**Then** the remaining visible specs retain their selected state; hidden specs' selection is not restored on clear (consistent with VS Code TreeView's standard behavior when items disappear from getChildren results).

## Non-Functional Requirements

- **NFR001** (MUST): Filtering is a pure, synchronous computation against already-read spec metadata — no extra filesystem or parsing work per keystroke. Applying a filter to a list of ≤200 specs completes in under 16ms (one frame).
- **NFR002** (SHOULD): The fuzzy matcher is implemented in-repo (small helper) to avoid adding a runtime dependency. ~30 lines of TypeScript is plenty for subsequence matching with normalization.
- **NFR003** (SHOULD): The filter action icon uses a standard VS Code codicon (`filter` or `search`) with a filled variant (`filter-filled`) when a filter is active, consistent with VS Code's built-in patterns.

## Out of Scope

- Filtering by status, type, date, or any facet other than slug + specName.
- Ranking results by match score or highlighting matched characters in labels.
- Regex mode, case-sensitive mode, or exact-match mode toggles.
- Filtering inside the spec viewer or spec editor webviews (this is tree-only).
- Global/user-level persistence (workspace-scoped is sufficient and correct).
- A persistent input element rendered **above** the tree — VS Code's TreeView API does not support embedded text inputs, so the UX uses a title-bar action that opens an `InputBox`. The issue title wording "Filter/search box above the specs tree" is interpreted as the user-visible intent, not a literal UI constraint.
- Adding a dedicated keybinding (tooltip hint only; users can bind the command themselves via VS Code keyboard preferences).
