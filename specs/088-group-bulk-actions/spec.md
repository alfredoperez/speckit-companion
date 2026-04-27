# Spec: Group Header Bulk Actions

**Slug**: 088-group-bulk-actions | **Date**: 2026-04-27

## Summary

The Active, Completed, and Archived group headers in the Specs sidebar have
no right-click menu, so users can only change spec status one item at a time
— tedious for end-of-sprint cleanup or moving a backlog of completed work to
archived. Surface group-scoped bulk actions (Mark all as Completed, Archive
all, Reactivate all) on each header, gated by a confirmation dialog before
each destructive bulk operation.

## Requirements

- **R001** (MUST): Each lifecycle group header's `contextValue` encodes its group identity: `spec-group-active`, `spec-group-completed`, or `spec-group-archived`. The Active group covers both `active` and `tasks-done` specs (already grouped together today).
- **R002** (MUST): Three new commands are registered: `speckit.group.markAllCompleted`, `speckit.group.archiveAll`, `speckit.group.reactivateAll`.
- **R003** (MUST): Right-clicking the **Active** group header shows: "Mark all as Completed", "Archive all".
- **R004** (MUST): Right-clicking the **Completed** group header shows: "Reactivate all", "Archive all".
- **R005** (MUST): Right-clicking the **Archived** group header shows: "Reactivate all".
- **R006** (MUST): Each group bulk handler iterates `element.groupSpecs` (already populated on `SpecItem` for the spec-group contextValues) and applies the lifecycle transition via the same per-spec helpers used today (`setStatus` from `stepLifecycle.ts` for completed/archived, `reactivate` for reactivation).
- **R007** (MUST): Specs already in the target status are silently skipped (reuse the no-op filter already present in `runBulkStatusChange`).
- **R008** (MUST): Before applying any bulk operation, show a confirmation dialog of the form `"{Action} all {N} {group} specs?"` (e.g., `"Archive all 12 active specs?"`, `"Reactivate all 3 completed specs?"`). The user must confirm before any `.spec-context.json` writes happen.
- **R009** (MUST): On success, show a single auto-dismissing toast with the count actually changed (e.g., `"12 specs archived"`), reusing `NotificationUtils.showAutoDismissNotification` and the same singular/plural format used by the per-item bulk handlers.
- **R010** (MUST): If the filtered post-skip set is empty (every spec was already in the target status, or the group is empty), no confirmation is shown and no toast appears — the command silently completes.
- **R011** (MUST): The sidebar refreshes after the bulk operation completes (groups recompute and counts update).
- **R012** (SHOULD): When a filter query is active and hides some specs from a group, the bulk action operates only on the visible specs (the count the group header shows). `groupSpecs` already reflects the post-filter list, so this falls out of R006.

## Scenarios

### Active group → Archive all

**When** the user right-clicks the "Active (12)" group header and chooses "Archive all"
**Then** a confirmation dialog asks "Archive all 12 active specs?". On confirm, every active/tasks-done spec in the group becomes `archived`, the sidebar refreshes (Active disappears, Archived count grows by 12), and a single toast reads "12 specs archived".

### Completed group → Reactivate all

**When** the user right-clicks the "Completed (3)" group header and chooses "Reactivate all"
**Then** a confirmation dialog asks "Reactivate all 3 completed specs?". On confirm, all 3 specs return to active, the sidebar refreshes, and a toast reads "3 specs moved to active".

### Archived group → only Reactivate all is shown

**When** the user right-clicks the "Archived (5)" group header
**Then** the menu shows only "Reactivate all" — neither "Mark all as Completed" nor "Archive all" appears.

### User cancels the confirmation

**When** the user right-clicks the "Active (12)" group header, chooses "Archive all", but clicks Cancel in the confirmation dialog
**Then** no `.spec-context.json` files are modified and no toast is shown.

### Filter hides some specs

**When** a filter query is active so the "Active (4)" group header shows 4 of 12 specs, and the user chooses "Archive all"
**Then** the confirmation reads "Archive all 4 active specs?" and only those 4 visible specs are archived; the other 8 active specs are untouched because they were not in `groupSpecs`.

### Empty target set is a silent no-op

**When** the user invokes a bulk action and `runBulkStatusChange`'s skip filter removes every spec (every spec was already in the target status)
**Then** no confirmation dialog and no toast is shown — the command completes silently.

## Non-Functional Requirements

- **NFR001** (MUST): No additional `.spec-context.json` reads occur when constructing group headers — the contextValue is derived from the group identity already known at construction time, not from disk.
- **NFR002** (MUST): The bulk handler issues per-spec writes concurrently with `Promise.all`, the same concurrency pattern `runBulkStatusChange` already uses.

## Out of Scope

- Filtering or partial bulk (e.g., "archive only specs older than 30 days").
- Group-level multi-select across more than one group header.
- Changes to the visible labels, icons, or ordering of the per-item right-click menu (covered by spec 087).
- New lifecycle statuses or changes to the existing status flow.
- Keyboard-driven invocation beyond the defaults that come with command registration (no dedicated keybindings).
