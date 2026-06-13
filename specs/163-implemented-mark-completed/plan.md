# Plan: Implemented Mark-Completed + distinct Completed-group icon

## Summary

Surface a **Mark as Completed** right-click action for `implemented` specs and give them a distinct (yellow) icon tint inside the Completed group. Two source touches: broaden the `speckit.markCompleted` menu `when`-clause in `package.json` to admit `spec-implemented`, and add a dedicated `implemented` icon branch in the sidebar tree item. The command handler already completes any non-completed spec, so no handler change is needed.

## Technical Context

- **Language**: TypeScript 5.3+ (ES2022, strict), VS Code Extension API (`@types/vscode ^1.84.0`).
- **Storage**: file-based — `.spec-context.json` per spec dir (status is the discriminator already read by `lifecycleContextValue`).
- **Testing**: Jest + `ts-jest`; existing `src/features/specs/__tests__/specExplorerProvider.test.ts` already covers the icon branches and `lifecycleContextValue`.
- **Constraints**: must not regress active/completed/archived menus, icons, or grouping. No version bump. No `.specify/` artifacts committed.

## Approach & Structure

1. **`package.json`** (`contributes.menus` → `view/item/context`): change the `speckit.markCompleted` `when` from `(viewItem == spec-active || viewItem == spec-tasks-done)` to also include `spec-implemented`. The handler (`completeApply` → `setStatus(specDir, 'completed')`, skip-predicate `s === COMPLETED`) already acts on `implemented`, so this is a pure gating change.
2. **`src/features/specs/specExplorerProvider.ts`** (icon branch in the `SpecItem` constructor, ~l.668): insert an `implemented` branch — `beaker` + `charts.yellow` — *before* the generic `specContext?.currentStep` (blue) fall-through, after the `COMPLETED` (green) branch. Use `SpecStatuses.IMPLEMENTED` for the check.
3. **`src/features/specs/__tests__/specExplorerProvider.test.ts`**: add a test asserting an `implemented` spec → `beaker` + `charts.yellow` (distinct from green completed / blue in-progress), and that `markCompleted` is eligible for `spec-implemented` (covered via `lifecycleContextValue('implemented') === 'spec-implemented'`, already asserted; extend with the menu-eligibility note).
4. **Docs**: `docs/sidebar.md` (spec groups, icon legend, context-menu section), README "Sidebar at a Glance", root `CHANGELOG.md` `[Unreleased]`.

## Out of Scope

- The viewer footer completion affordance (already correct).
- Any change to active/archived menus, icons, or grouping.
- Version bump, `.specify/` registry artifacts.
