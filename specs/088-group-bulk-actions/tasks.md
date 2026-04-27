# Tasks: Group Header Bulk Actions

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-27

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** Encode lifecycle into group header contextValues — `src/features/specs/specExplorerProvider.ts` | R001, NFR001
  - **Do**: Replace the three `'spec-group'` `contextValue` assignments at the active/completed/archived group construction sites with `'spec-group-active'`, `'spec-group-completed'`, `'spec-group-archived'`. Add a `SPEC_GROUP_CONTEXT_VALUES` set (mirroring `SPEC_LIFECYCLE_CONTEXT_VALUES`) and update both the `getChildren(element)` dispatch (line ~240) and the `SpecItem` constructor's icon/tooltip branch (line ~634) to recognize any of the three values via set membership instead of exact `=== 'spec-group'`.
  - **Verify**: `npm run compile` passes; in the Extension Development Host the three group headers still render their icon/tooltip and expand/collapse correctly; `groupSpecs` is still populated on each group `SpecItem`.
  - **Leverage**: `SPEC_LIFECYCLE_CONTEXT_VALUES` pattern from spec 087.

- [x] **T002** [P] Add three group bulk command handlers — `src/features/specs/specCommands.ts` | R002, R006, R007, R008, R009, R010, R011, NFR002
  - **Do**: Register `speckit.group.markAllCompleted`, `speckit.group.archiveAll`, `speckit.group.reactivateAll`. Each handler reads `(item as SpecItem).groupSpecs`, applies the existing skip-filter (specs already in the target status), short-circuits silently on empty (R010), shows `vscode.window.showWarningMessage` of the form `"{Action} all {N} {group} specs?"` (R008), and on confirm delegates to `runBulkStatusChange` so the Promise.all writes, refresh, and singular/plural toast (R009, R011, NFR002) are reused verbatim.
  - **Verify**: `npm run compile` passes; manual smoke in Extension Development Host — for each group, run the action, confirm dialog text matches R008, toast count matches changed specs, Cancel is a true no-op.
  - **Leverage**: existing `runBulkStatusChange` helper (skip filter + Promise.all + refresh + `NotificationUtils.showAutoDismissNotification`).

- [x] **T003** [P] Register commands and `view/item/context` menus — `package.json` | R002, R003, R004, R005
  - **Do**: Under `contributes.commands`, add the three commands with category "SpecKit" and titles "Mark all as Completed", "Archive all", "Reactivate all". Under `contributes.menus["view/item/context"]`, add: `markAllCompleted` gated `viewItem == spec-group-active`; `archiveAll` gated `viewItem == spec-group-active || viewItem == spec-group-completed`; `reactivateAll` gated `viewItem == spec-group-completed || viewItem == spec-group-archived`. Confirm existing per-item `when` clauses use anchored `^spec-(active|tasks-done|completed|archived)$` so `spec-group-*` cannot leak into them.
  - **Verify**: Right-click each group header in Extension Development Host — Active shows "Mark all as Completed" + "Archive all"; Completed shows "Reactivate all" + "Archive all"; Archived shows only "Reactivate all". No group menu items leak onto per-spec items.

- [x] **T004** [P] Unit test for group contextValue helper — `tests/features/specs/groupContextValue.test.ts` | R001
  - **Do**: Add a BDD-style test file asserting the group-label → contextValue mapping (`active` → `spec-group-active`, `completed` → `spec-group-completed`, `archived` → `spec-group-archived`). Pure function — no VS Code surface needed.
  - **Verify**: `npm test` passes the new file.
  - **Leverage**: existing `lifecycleContextValue`-style tests under `tests/features/specs/` for structure and ts-jest config.

- [x] **T005** Update README sidebar reference — `docs/sidebar.md`, `README.md` | R003, R004, R005
  - **Do**: In `docs/sidebar.md`, add a "Group Header Actions" subsection listing the three bulk actions and which group exposes which. In README's lean "Sidebar at a Glance" summary, add one bullet noting that group headers now support bulk lifecycle actions with confirmation.
  - **Verify**: Diff is coherent; behavior described matches what was implemented in T001–T003.
  - **Leverage**: existing sidebar action documentation pattern.
