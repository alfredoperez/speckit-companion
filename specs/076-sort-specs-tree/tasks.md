# Tasks: Sort Options (name / date / status)

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-24

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** Add constants for sort command + state key — `src/core/constants.ts` | R001, R003
  - **Do**: Add `specsSort: 'speckit.specs.sort'` under `Commands`. Add `specsSortMode: 'speckit.specs.sort.mode'` under `ConfigKeys.workspaceState`. Place next to the existing `specsFilter` / `specsFilterQuery` entries so the two surfaces stay adjacent.
  - **Verify**: `npm run compile` passes; no new unused warnings.
  - **Leverage**: `src/core/constants.ts:17-18,84` (existing filter command + state key — match formatting).

- [x] **T002** [P] Create `SortMode` type + comparator map — `src/features/specs/specsSortMode.ts` | R002, R004, R005, R007, NFR001
  - **Do**: New file exporting `SortMode = 'number' | 'name' | 'dateCreated' | 'dateModified' | 'status'`, `DEFAULT_SORT_MODE = 'number'`, and a `comparators` record that maps each mode to a factory `(ctx: { basePath: string, specNameByPath: Map<string, string | undefined>, statusByPath: Map<string, string | undefined> }) => (a: SpecInfo, b: SpecInfo) => number`. Extract and reuse the current `extractNumericPrefix` helper (move from specExplorerProvider). Every comparator must fall back to numeric-prefix (desc) then name (asc) on tie. Status comparator uses workflow order `specify → plan → tasks → implement → done`; missing step sinks to end. Date comparators use `fs.statSync` birthtime/mtime wrapped in try/catch so a stat failure returns a "sink to end" sentinel without throwing.
  - **Verify**: `npm run compile` passes; file has no VS Code API imports (pure logic).
  - **Leverage**: `src/features/specs/specExplorerProvider.ts:149-166` (existing `extractNumericPrefix` + `sortSpecs` — port verbatim for `number` mode).

- [x] **T003** [P] Create `SpecsSortState` — `src/features/specs/specsSortState.ts` | R003, R006, NFR002
  - **Do**: New file exporting `SpecsSortState` class with `constructor(context, onChange)`, `getMode(): SortMode` (returns persisted mode or `DEFAULT_SORT_MODE`), `setMode(mode: SortMode): Promise<void>`, `clear(): Promise<void>` (resets to default), `initialize(): Promise<void>`. Persist via `context.workspaceState.update(ConfigKeys.workspaceState.specsSortMode, …)`. Set context key `'speckit.specs.sortActive'` to `true` when mode is non-default, `false` when default; fire `onChange` on every state change.
  - **Verify**: `npm run compile` passes; API surface mirrors `SpecsFilterState` (same method names where analogous).
  - **Leverage**: `src/features/specs/specsFilterState.ts:1-41` (copy structure; swap query string for SortMode).

- [x] **T004** [P] Unit tests for `SpecsSortState` — `src/features/specs/__tests__/specsSortState.test.ts` | R003, R006
  - **Do**: Mirror `specsFilterState.test.ts`: default fallback to `'number'` when nothing persisted, persistence + context key + `onChange` on `setMode('name')`, `clear()` resets to default and sets context key to `false`, `setMode('number')` (default) sets context key to `false`, `initialize()` syncs context key from persisted state.
  - **Verify**: `npm test -- specsSortState` passes.
  - **Leverage**: `src/features/specs/__tests__/specsFilterState.test.ts` (structure + `makeContext` helper — copy verbatim).

- [x] **T005** [P] Unit tests for comparators — `src/features/specs/__tests__/specsSortMode.test.ts` | R002, R004, R007
  - **Do**: One describe per mode. For each: build a fixture of `SpecInfo[]` plus the `specNameByPath` / `statusByPath` maps, assert sorted order. Cover tie-break (two specs with same status → numeric-prefix wins), missing signal (spec with no numeric prefix + no context → sinks to end under status sort), stat failure stub (mock `fs.statSync` to throw for one path; assert it lands at end under date sort).
  - **Verify**: `npm test -- specsSortMode` passes.
  - **Leverage**: `src/features/specs/__tests__/fuzzyMatch.test.ts` (example of a pure-logic test module — follow its shape).

- [x] **T006** Wire sort state into provider + replace inline sort — `src/features/specs/specExplorerProvider.ts` *(depends on T001, T002, T003)* | R004, R005, R007, NFR001
  - **Do**: Add optional `sortState?: SpecsSortState` to the constructor alongside `filterState`. Inside `getChildren` after the filter block, build `statusByPath: Map<string, string | undefined>` from the same cached `readSpecContextSync` pass (populate it in the same loop that already builds `specNameByPath` — no extra I/O). Replace the inline `extractNumericPrefix` + `sortSpecs` block (lines 149-169) with: `const mode = this.sortState?.getMode() ?? DEFAULT_SORT_MODE; const cmp = comparators[mode]({ basePath, specNameByPath, statusByPath }); filteredActive.sort(cmp); filteredCompleted.sort(cmp); filteredArchived.sort(cmp);`. Remove the now-unused inline helpers.
  - **Verify**: `npm run compile` passes; `npm test -- specExplorerProvider` passes; manually the tree still defaults to numeric-prefix desc order.
  - **Leverage**: `src/features/specs/specExplorerProvider.ts:109-121` (reuse the existing for-loop that reads spec context once per spec — extend it to also collect `currentStep`).

- [x] **T007** Register `speckit.specs.sort` command — `src/features/specs/specCommands.ts` *(depends on T001, T003)* | R001, R002, R006, R008
  - **Do**: Add optional `sortState?: SpecsSortState` parameter to `registerSpecKitCommands`. If `sortState` provided, register `Commands.specsSort` — opens `vscode.window.showQuickPick` with items `[{ label: 'Number', description: 'Numeric prefix (default)', mode: 'number' }, { label: 'Name', description: 'A–Z by slug', mode: 'name' }, { label: 'Date Created', description: 'Newest first', mode: 'dateCreated' }, { label: 'Date Modified', description: 'Most recently edited', mode: 'dateModified' }, { label: 'Status', description: 'By workflow step', mode: 'status' }]`. Prepend a `✓` to the label of the current mode (use `sortState.getMode()`). When current mode is non-default, append a final `{ label: 'Reset to default', mode: 'number', description: 'Number (default)' }` entry (R008). On selection, call `sortState.setMode(picked.mode)`. Cancel (undefined) is a no-op.
  - **Verify**: `npm run compile` passes; `npm test -- specCommands` passes.
  - **Leverage**: `src/features/specs/specCommands.ts:107-123` (the `speckit.specs.filter` command registration — same gating pattern `if (sortState) { … }`).

- [x] **T008** Wire state + provider + command registration — `src/extension.ts` *(depends on T003, T006, T007)* | R003
  - **Do**: Instantiate `const specsSortState = new SpecsSortState(context, () => specExplorer.refresh());` next to the existing `specsFilterState`. Pass it as a third argument to `new SpecExplorerProvider(...)` and pass it into `registerSpecKitCommands(...)`. Call `specsSortState.initialize().then(undefined, () => {});` alongside the existing filter-state initialization.
  - **Verify**: `npm run compile` passes; `npm run watch` picks up changes; Extension Development Host launches without errors.
  - **Leverage**: `src/extension.ts:112-161` (existing wiring for `SpecsFilterState`).

- [x] **T009** Add command + title-bar menu entry — `package.json` *(depends on T001)* | R001, R006
  - **Do**: Add a new command entry under `contributes.commands`: `{ "command": "speckit.specs.sort", "title": "Sort Specs…", "category": "SpecKit", "icon": "$(sort-precedence)" }`. Add to `contributes.menus['view/title']` as `{ "command": "speckit.specs.sort", "when": "view == speckit.views.explorer", "group": "navigation@0" }` — placed right after the `speckit.specs.filter.clear` entry so it sits in the same priority band as filter. No change to `group` on neighbors (filter already uses `navigation@0`; sort joins that group).
  - **Verify**: `npm run compile` passes; launch extension — sort icon appears in specs tree title bar.

- [x] **T010** Document the sort picker in README — `README.md` *(depends on T009)* | R001, R002
  - **Do**: Find the specs tree / Explorer section that documents filter (added in PR #121). Add a sentence or short bullet list adjacent to it covering the new sort picker: where the icon lives, the available modes (Number default, Name, Date Created, Date Modified, Status), and that the choice persists per workspace.
  - **Verify**: `npm run compile` unaffected; README renders correctly on GitHub preview.
