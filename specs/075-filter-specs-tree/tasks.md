# Tasks: Filter/search box above the specs tree

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-23

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** [P] Add fuzzy match helper — `src/features/specs/fuzzyMatch.ts` | R002, NFR001, NFR002
  - **Do**: Create a new module exporting `normalize(s: string): string` (lowercase, strip non-alphanumerics — `/[^a-z0-9]/g` after `.toLowerCase()`) and `fuzzyMatch(query: string, ...haystacks: Array<string | undefined>): boolean`. `fuzzyMatch` returns `true` for empty/whitespace queries; otherwise normalizes the query, concatenates all normalized haystacks (skipping `undefined`), and returns whether the query characters appear as an in-order subsequence in the combined haystack.
  - **Verify**: `npm run compile` passes; the file is under ~30 lines excluding comments.
  - **Leverage**: No existing fuzzy helper in repo — write from scratch; no dependencies added.

- [x] **T002** [P] Tests for fuzzyMatch — `src/features/specs/__tests__/fuzzyMatch.test.ts` | R002
  - **Do**: BDD tests covering: empty query matches everything; case-insensitive match (`TREE` matches `filter-specs-tree`); subsequence match (`fst` matches `filter-specs-tree`); non-subsequence rejected (`ftst` against `tree` returns false); punctuation/whitespace normalized (`tree view` behaves like `treeview`); matches against multiple haystacks (slug + specName); `undefined` haystacks are skipped.
  - **Verify**: `npm test -- fuzzyMatch` passes all cases.
  - **Leverage**: Follow the describe/it BDD style from `src/features/specs/__tests__/transitionLogger.test.ts`.

- [x] **T003** Add command + workspaceState key constants — `src/core/constants.ts` | R001, R004, R005
  - **Do**: Add `specsFilter: 'speckit.specs.filter'` and `specsFilterClear: 'speckit.specs.filter.clear'` to the `Commands` object. Add a new `workspaceState` group to `ConfigKeys` with `specsFilterQuery: 'speckit.specs.filter.query'`. Preserve existing entries; keep alphabetical/grouped ordering in place.
  - **Verify**: `npm run compile` passes; no other files break (these are new keys).
  - **Leverage**: Existing `Commands.toggleCollapseAllSpecs` and `ConfigKeys.globalState` patterns in this file.

- [x] **T004** Add SpecsFilterState — `src/features/specs/specsFilterState.ts` | R004, R005, NFR001
  - **Do**: Create `SpecsFilterState` class. Constructor takes `context: vscode.ExtensionContext` and `onChange: () => void`. Methods: `getQuery(): string` (returns stored query, empty string if absent), `async setQuery(q: string): Promise<void>` (writes to `context.workspaceState` under `ConfigKeys.workspaceState.specsFilterQuery`, updates the `speckit.specs.filterActive` context key via `vscode.commands.executeCommand('setContext', ...)`, then calls `onChange()`), `async clear(): Promise<void>` (writes `undefined` to clear the workspace-state entry, updates context key to `false`, calls `onChange()`), and `async initialize(): Promise<void>` (reads the persisted value on activation and sets the context key so the clear button visibility matches reality on first paint). Trim input in `setQuery` and treat a blank result as `clear()`.
  - **Verify**: `npm run compile` passes.
  - **Leverage**: `src/features/spec-editor/specDraftManager.ts` for the workspaceState get/update pattern.

- [x] **T005** [P] Tests for SpecsFilterState — `src/features/specs/__tests__/specsFilterState.test.ts` | R004, R005
  - **Do**: BDD tests against a mock `ExtensionContext` (add `workspaceState: { get, update, keys }` to `tests/__mocks__/vscode.ts` if not already flexible enough). Cover: set/get round-trip; `setQuery('')` triggers `clear`; `clear()` removes the value (update called with `undefined`); `initialize()` reads the persisted value and fires `setContext` with the correct active flag; `onChange` callback fires after every mutation; trimming whitespace.
  - **Verify**: `npm test -- specsFilterState` passes.
  - **Leverage**: Existing mock patterns in `src/features/specs/__tests__/specExplorerProvider.test.ts` (line 50 — `workspaceState: { get, update }`).

- [x] **T006** Filter tree output in SpecExplorerProvider — `src/features/specs/specExplorerProvider.ts` | R002, R003, R007, R008, NFR001
  - **Do**: (a) Add an optional `filterState?: SpecsFilterState` constructor parameter (default undefined so existing tests keep compiling). (b) In the root branch of `getChildren`, after partitioning specs into `activeSpecs` / `completedSpecs` / `archivedSpecs`, if `filterState.getQuery()` is non-empty, filter each list using `fuzzyMatch(query, spec.name, readSpecContextSync(specFullPath)?.specName)` — reuse the `specFullPath` lookup already happening in the partition loop by caching `{spec, status, specName}` tuples during the first pass to avoid double disk reads. (c) Build each group node only if its filtered list is non-empty; group labels use the filtered length (format `Active (N)` is already built from `activeSpecs.length` — keep that source of truth as the filtered array). (d) Ensure per-group sorting runs on filtered lists so ordering is stable.
  - **Verify**: `npm run compile` passes; `npm test -- specExplorerProvider` passes (existing tests should still pass since filter is off by default).
  - **Leverage**: The existing partition loop at lines 100–110 and the group-creation blocks at lines 143–177 of `specExplorerProvider.ts`.

- [x] **T007** Integration test for filter wiring — `src/features/specs/__tests__/specExplorerProvider.test.ts` | R002, R003
  - **Do**: Add a `describe('with filter active')` block. Seed a fake filesystem (via existing test helpers) with three specs whose slug and `.spec-context.json#specName` vary; instantiate `SpecsFilterState` with a mock context, call `setQuery('tree')`, pass into the provider constructor, and assert that the root `getChildren()` returns only the groups whose specs match, that each group label shows the filtered count, and that `setQuery('')` restores the full list.
  - **Verify**: `npm test -- specExplorerProvider` passes (new + existing cases).
  - **Leverage**: Existing test setup in this same file (already mocks `readSpecContextSync`, `resolveSpecDirectories`, etc.).

- [x] **T008** Register filter commands — `src/features/specs/specCommands.ts` | R001, R005
  - **Do**: In `registerSpecKitCommands`, accept a new `filterState: SpecsFilterState` parameter. Register two commands: (1) `Commands.specsFilter` — calls `vscode.window.showInputBox({ value: filterState.getQuery(), prompt: 'Filter specs by slug or name', placeHolder: 'type to filter…' })` and passes the result (if not `undefined`) to `filterState.setQuery`; (2) `Commands.specsFilterClear` — calls `filterState.clear()`. Push both into `context.subscriptions`.
  - **Verify**: `npm run compile` passes.
  - **Leverage**: The `toggleCollapseAllHandler` registration pattern at `specCommands.ts:87-100`.

- [x] **T009** Wire filter into extension activation — `src/extension.ts` | R001, R004
  - **Do**: After `specExplorer` is constructed, instantiate `const filterState = new SpecsFilterState(context, () => specExplorer.refresh())`, await `filterState.initialize()`, pass it to `SpecExplorerProvider` via a setter or via a provider constructor update (choose whichever minimizes the diff; the constructor-parameter approach from T006 is preferred, in which case construct `filterState` **before** `SpecExplorerProvider`). Pass `filterState` into `registerSpecKitCommands`.
  - **Verify**: `npm run compile` passes; launching the Extension Development Host (F5) shows the tree and no startup errors.
  - **Leverage**: The provider construction around `extension.ts:116-120`.

- [x] **T010** Declare commands, title-bar menu entries, and empty-state welcome — `package.json` | R001, R005, R006, R007, NFR003
  - **Do**: (a) Add two `contributes.commands` entries: `speckit.specs.filter` with `title: "Filter Specs…"`, `category: "SpecKit"`, `icon: "$(filter)"`; and `speckit.specs.filter.clear` with `title: "Clear Specs Filter"`, `category: "SpecKit"`, `icon: "$(clear-all)"`. (b) Add two `menus."view/title"` entries gated on `view == speckit.views.explorer`: filter (group `navigation@0`, always visible) and filter.clear (group `navigation@0` with `&& speckit.specs.filterActive`, visible only while filter is active). (c) Add a `viewsWelcome` entry for `speckit.views.explorer` with `when: "speckit.specs.filterActive && speckit.specs.noFilterMatch"` and contents `"No specs match the current filter.\n\n[$(clear-all) Clear filter](command:speckit.specs.filter.clear)"`. (Set `speckit.specs.noFilterMatch` from the provider in T006 after computing the filtered partition.)
  - **Verify**: `npm run compile` + `npm run package` produces a valid `.vsix`; F5 shows the filter icon in the view title bar; clearing/applying filters toggles the clear-filter icon correctly.
  - **Leverage**: Existing `view/title` entries for `speckit.specs.collapseAll` / `expandAll` at `package.json:397-417` — follow the same when-clause gating pattern.

- [x] **T011** Set noFilterMatch context key in provider — `src/features/specs/specExplorerProvider.ts` | R007
  - **Do**: After building the filtered groups in `getChildren` root branch (T006), if a filter is active and all three group lists are empty, call `vscode.commands.executeCommand('setContext', 'speckit.specs.noFilterMatch', true)`; otherwise `false`. Keep this call fire-and-forget (no await inside `getChildren`, but catch rejections).
  - **Verify**: `npm test -- specExplorerProvider` passes; F5: applying a filter that matches nothing shows the welcome message, clearing or matching specs hides it.
  - **Leverage**: Existing `setContext` usage in `specCommands.ts:89-93` (`speckit.specs.allCollapsed`).

- [x] **T012** Update README and architecture docs — `README.md`, `docs/architecture.md` | R001, R006
  - **Do**: (a) In `README.md`, add a short section or bullet under the Specs tree documentation explaining the filter action (icon, what it matches, persistence across reloads, how to clear). (b) In `docs/architecture.md`, add `specsFilterState.ts` and `fuzzyMatch.ts` to the `src/features/specs/` module list and note the new `speckit.specs.filter.query` workspaceState key + `speckit.specs.filterActive` / `speckit.specs.noFilterMatch` context keys.
  - **Verify**: Docs describe the filter accurately; links resolve; no TODOs left in prose.
  - **Leverage**: Existing Specs tree sections in `README.md`; module-list style in `docs/architecture.md`.

- [x] **T013** Fix in-flight step-tab color clash — `webview/styles/spec-viewer/_navigation.css` | drive-by fix requested during review
  - **Do**: In the spec viewer, the in-flight step-status percentage pill used `--accent` (often purple via `--vscode-focusBorder`) while the surrounding `working-pulse` animation glow used `--success` (green). The clashing colors made the tasks step look "strange" while a task was running. Change `.step-tab.in-flight .step-status` and `.step-tab.in-flight .step-label` to use `--success` so the pill and its pulse read as one consistent in-progress state.
  - **Verify**: Compile + full test suite pass. Visual check in F5: the running step shows a green pill inside a green glow, with a green-highlighted label, no more purple/green collision.
