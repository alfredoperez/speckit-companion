# Plan: Group-aware Context Menu

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-27

## Approach

Encode each spec tree item's lifecycle group directly into its `contextValue` (becoming the VS Code `viewItem` token) — `spec-active`, `spec-tasks-done`, `spec-completed`, or `spec-archived` — so right-click menu `when` clauses become a pure per-item decision and no longer race with VS Code's selection update. Replace the three deprecated selection-state context keys in `package.json` with per-`viewItem` matches, and filter the right-clicked selection inside the bulk handlers to silently skip specs whose current status would make the operation a no-op.

## Technical Context

**Stack**: TypeScript 5.3+ (ES2022, strict), VS Code Extension API (`@types/vscode ^1.84.0`)
**Constraints**: Status must be derived from the `specContext` already loaded by `specExplorerProvider.getChildren` — no extra `.spec-context.json` reads (NFR001).

## Files

### Create

(none)

### Modify

- `src/features/specs/specExplorerProvider.ts` — In `getChildren` (group-expansion branch ~line 215) compute the contextValue from `specContext?.status` via a new helper `lifecycleContextValue(specContext)` that returns one of `spec-active | spec-tasks-done | spec-completed | spec-archived`, falling back to `spec-active` when status is missing/unknown (R001). Update the `getChildren` `=== 'spec'` branches (lines 204, 244) and the `SpecItem` constructor's icon-selection branch (line 612) to recognize all four lifecycle viewItems via a shared helper (e.g. `isSpecLifecycleItem(cv)`).
- `package.json` — Replace the three selection-based `when` clauses (lines 489, 494, 499) with per-`viewItem` matches: `markCompleted` shown when `viewItem == spec-active || viewItem == spec-tasks-done` (R002); `archive` shown when `viewItem != spec-archived` and item is one of the four lifecycle values (R003); `reactivate` shown when `viewItem == spec-completed || viewItem == spec-archived` (R004). Update the always-visible entries (`speckit.delete` line 484, `speckit.specs.reveal` line 504, `speckit.specs.revealInExplorer` line 509) to match the four viewItems via `viewItem =~ /^spec-(active|tasks-done|completed|archived)$/` (R005, R006).
- `src/features/specs/specCommands.ts` — In `resolveTargets` (line 55) replace the strict `=== 'spec'` selection filter on line 59 with the new `isSpecLifecycleItem` helper. Inside `runBulkStatusChange` (line 255), filter targets whose current status would make the operation a no-op before calling `apply` — read each target's status via the existing `readSpecContextSync(specDirFor(...))` and skip already-completed for `markCompleted`, already-archived for `archive`, already-active (i.e. `active` or `tasks-done`) for `reactivate` (R007). If all targets are filtered out, skip the refresh and the success notification.
- `src/features/specs/selectionContextKeys.ts` — Drop the three deprecated `setContext` calls (`allActive`, `allCompleted`, `allArchived`) per R008; keep `selection.count` and `selection.mixed` writes. Add a header comment noting that menu visibility now flows through per-item `viewItem`.
- `src/features/specs/specCommands.test.ts` — Update the `makeItem` factory (line 170) to accept a lifecycle-aware contextValue (default `spec-active`) and add Jest cases covering the no-op filter in `runBulkStatusChange` (markCompleted on a `completed` spec → no `apply` call; reactivate on a mixed selection of `active`+`completed` → only the completed target passes through).

## Testing Strategy

- **Unit**: Extend `specCommands.test.ts` to cover the no-op filter branch in `runBulkStatusChange` and verify the new `isSpecLifecycleItem` selection filter accepts all four lifecycle values.
- **Manual**: In the Extension Development Host, right-click each lifecycle group's spec without a prior selection and confirm the menu matches the five spec scenarios — including the multi-select-with-mixed-statuses case.

## Risks

- Many `=== 'spec'` strict comparisons in `specExplorerProvider.ts` and `specCommands.ts` could be missed. Mitigation: introduce a single `isSpecLifecycleItem(contextValue)` helper, replace every site, and grep for any remaining `'spec'` literal comparisons before merging.
- Stale `when` clause referencing one of the three deprecated context keys could escape the package.json sweep. Mitigation: after editing, grep `package.json` for `speckit.specs.selection.allActive|allCompleted|allArchived` and confirm zero matches.
