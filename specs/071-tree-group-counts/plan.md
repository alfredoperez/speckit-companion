# Plan: Tree Group Counts

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-21

## Approach

Append ` (N)` to the label passed to each `SpecItem` group header in `specExplorerProvider.ts` using the array lengths already computed (`activeSpecs.length`, `completedSpecs.length`, `archivedSpecs.length`). In the `SpecItem` constructor, strip the count suffix before looking up the group icon and tooltip so the existing `groupIcons` / `groupTooltips` keyed-by-name maps keep working without change.

## Files to Change

### Modify

- `src/features/specs/specExplorerProvider.ts`
  - Change the three `new SpecItem('Active', …)`, `new SpecItem('Completed', …)`, `new SpecItem('Archived', …)` calls (~lines 144, 156, 168) to pass `` `Active (${activeSpecs.length})` ``, `` `Completed (${completedSpecs.length})` ``, and `` `Archived (${archivedSpecs.length})` `` respectively.
  - In the `SpecItem` constructor's `spec-group` branch (~lines 574–586), derive a `baseLabel` by splitting on `' ('` and use it as the key for `groupIcons` and `groupTooltips` lookups.

- `src/features/specs/__tests__/specExplorerProvider.test.ts`
  - Update assertions that compare group labels exactly (e.g., `expect(children[0].label).toBe('Active')`) to match the new `Active (N)` / `Completed (N)` / `Archived (N)` format, using the appropriate count for each test's fixture data.
