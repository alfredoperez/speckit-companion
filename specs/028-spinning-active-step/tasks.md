# Tasks: Active Spec Grouping & Step Indicator

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-31

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add mtime helper and group nodes to specExplorerProvider — `src/features/specs/specExplorerProvider.ts` | R001, R002, R003
  - **Do**: Add a `getSpecMaxMtime(specFullPath: string): Date` method that reads all files in a spec directory and returns the most recent `mtime` via `fs.statSync`. In `getChildren(undefined)` (root level), after fetching specs, compute mtime for each, partition into "active" (mtime is today) and "earlier" groups, sort active newest-first. Return two group `SpecItem` nodes: "Active" (`TreeItemCollapsibleState.Expanded`) and "Earlier" (`TreeItemCollapsibleState.Collapsed`). Add a new `contextValue` `'spec-group'` with a folder-like icon. Update `getChildren` to handle `spec-group` elements by returning their child specs.
  - **Verify**: `npm run compile` passes; extension shows two groups in the spec explorer tree
  - **Leverage**: Existing `getChildren` root-level logic (lines 66–108) for spec item creation pattern

- [x] **T002** Remove static circle indicators from step descriptions — `src/features/specs/specExplorerProvider.ts` | R004
  - **Do**: Remove the `STATUS_INDICATORS` constant and all references to it. In the `SpecItem` constructor for `spec-document` context (line 470–474), remove the `this.description = statusIndicator` line. For `spec-related-doc` context (line 489–490), same removal. Keep the tooltip status text (R006). Remove the `DocumentStatus` type and `status` parameter from `SpecItem` constructor if no longer used elsewhere. Clean up `getDocumentStatus` calls in `getSpecDocuments` if status is only used for the circles.
  - **Verify**: `npm run compile` passes; step items show no circle symbols in the tree
  - **Leverage**: Existing `SpecItem` constructor (lines 441–494)

- [x] **T003** Add activeSpecName tracking and spinning icon — `src/features/specs/specExplorerProvider.ts` | R005, R006
  - **Do**: Add a public `activeSpecName: string | null = null` property to `SpecExplorerProvider`. Add a `setActiveSpec(specName: string)` method that sets `activeSpecName` and calls `this._onDidChangeTreeData.fire()`. In the `SpecItem` constructor for `contextValue === 'spec'`, check if `specName === activeSpecName` (pass it as a new constructor param `isActive`). If active, set `this.iconPath = new vscode.ThemeIcon('sync~spin')` instead of `beaker`.
  - **Verify**: `npm run compile` passes; calling `setActiveSpec('some-spec')` programmatically shows spinner on that spec node
  - **Leverage**: Existing `spec-loading` pattern (line 460–461) that already uses `sync~spin`

- [x] **T004** Wire up step commands to set activeSpecName — `src/features/specs/specCommands.ts` | R005
  - **Do**: In `registerPhaseCommands`, after `executeWorkflowStep` and `executeInTerminal` calls, extract the spec name from `targetDir` (last path segment) and call `specExplorer.setActiveSpec(specName)`. The `specExplorer` reference is already available in the parent `registerSpecKitCommands` — pass it into `registerPhaseCommands` as a parameter.
  - **Verify**: Clicking a step button in the tree shows `sync~spin` on that spec's parent node

---

## Phase 2: Quality (Parallel — launch agents in single message)

- [x] **T005** [P][A] Unit tests — `test-expert` | R001, R002, R003, R004, R005
  - **Files**: `src/features/specs/__tests__/specExplorerProvider.test.ts`
  - **Pattern**: Jest with `describe`/`it` blocks, VS Code mock from `tests/__mocks__/vscode.ts`
  - **Reference**: Existing test patterns in `src/` test files

- [x] **T006** [P][A] Update README — `docs-expert`
  - **Files**: `README.md`
  - **Do**: Update the spec explorer section to describe Active/Earlier grouping and spinning indicator behavior
  - **Verify**: README accurately reflects the new tree structure

---

## Progress

- Phase 1: T001–T004 [ ]
- Phase 2: T005–T006 [ ]
