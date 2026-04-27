# Plan: Group Header Bulk Actions

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-27

## Approach

Extend the per-item lifecycle-encoding pattern from spec 087 to the three
group headers: replace the uniform `spec-group` contextValue with
`spec-group-active`, `spec-group-completed`, and `spec-group-archived`. Add
three command handlers that read `element.groupSpecs` (already populated on
the group `SpecItem`), reuse the existing `runBulkStatusChange` helper for
the skip-filter / Promise.all / refresh / toast pipeline, and gate the call
with a `vscode.window.showWarningMessage` confirmation. Wire the menu in
`package.json` `view/item/context` with a `viewItem == spec-group-{name}`
`when` clause per command.

## Technical Context

**Stack**: TypeScript 5.3+ (strict), VS Code Extension API.
**Constraints**: No extra `.spec-context.json` reads when constructing
groups (NFR001) — group identity is already known at construction time.

## Files

### Modify

- `src/features/specs/specExplorerProvider.ts` — In the root branch of `getChildren`, set the three group headers' `contextValue` to `spec-group-active`, `spec-group-completed`, `spec-group-archived` instead of the shared `spec-group`. Update the `getChildren(element)` dispatch and the `SpecItem` constructor's `spec-group` icon/tooltip branch to recognize all three new contextValues (string startsWith check or a small `SPEC_GROUP_CONTEXT_VALUES` set, mirroring `SPEC_LIFECYCLE_CONTEXT_VALUES`).
- `src/features/specs/specCommands.ts` — Add three command handlers: `speckit.group.markAllCompleted`, `speckit.group.archiveAll`, `speckit.group.reactivateAll`. Each reads `(item as SpecItem).groupSpecs`, maps each `SpecInfo` to the per-spec target shape `runBulkStatusChange` expects (label + specPath), pops a confirmation dialog with the action+count+group label, and on confirm delegates to the existing `runBulkStatusChange` so the skip filter, parallel writes, refresh, and toast are reused verbatim.
- `package.json` — Register the three commands under `contributes.commands` (titles: "Mark all as Completed", "Archive all", "Reactivate all" — category "SpecKit"). Add three `view/item/context` entries gated on the new group contextValues. Confirm the existing per-item `when` clauses use anchored regex (`^spec-(active|tasks-done|completed|archived)$`) so the new `spec-group-*` values do not match them — they already do, so no change is needed there.

## Testing Strategy

- **Unit / Mocked Extension Tests**: Add a test file under `tests/features/specs/` that asserts `lifecycleContextValue`-style mapping for groups (or a new `groupContextValue(label)` helper) — pure functions, no VS Code surface needed.
- **Manual smoke (Extension Development Host)**: For each of the three groups, right-click the header, verify the visible menu items match R003–R005, run each action, confirm dialog text matches R008, confirm count in toast matches actual changed specs, and confirm cancellation is a true no-op (no `.spec-context.json` writes).

## Risks

- **Menu leakage from `when`-clause regex collision** — Existing per-item `when` clauses use anchored `^spec-(...)$` regex, so `spec-group-active` will not match. **Mitigation**: leave the existing anchored regex untouched; add new entries using exact-match `viewItem == spec-group-active`.
- **Stale selection passed to bulk handler** — When the user right-clicks a group header, VS Code passes the group `SpecItem` as the first arg (no `items[]` second arg, since selection lives on spec items, not groups). **Mitigation**: the new handlers read `element.groupSpecs` directly rather than going through `resolveTargets`, which is selection-driven.
