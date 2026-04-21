# Spec: Tree Group Counts

**Slug**: 071-tree-group-counts | **Date**: 2026-04-21

## Summary

Show the spec count next to each group header in the Specs tree view — `Active (3)`, `Completed (12)`, `Archived (5)` — so users get an immediate sense of scale without expanding groups. Counts are derived from data the provider already computes, so this is a display-only change.

> Note: The feature description referenced `Active (3) / In Progress (2) / Completed (12)`. The current codebase groups specs into **Active / Completed / Archived** (see `SpecStatuses` in `src/core/constants.ts` and `getChildren` in `src/features/specs/specExplorerProvider.ts`). This spec applies counts to those three actual groups and does not introduce a new "In Progress" group.

## Requirements

- **R001** (MUST): Each visible group header label in the Specs tree view includes the count of specs in that group in the format `{GroupName} ({N})` — e.g., `Active (3)`, `Completed (12)`, `Archived (5)`.
- **R002** (MUST): Group headers continue to be shown only when the group is non-empty (current behavior preserved — no `Active (0)` rendered).
- **R003** (MUST): Group icons (`pulse` for Active, `check` for Completed, `archive` for Archived) and tooltips (`Specs in progress`, `Completed specs`, …) continue to resolve correctly despite the new label suffix.
- **R004** (MUST): Counts update reactively when specs are added, removed, or transition between groups — i.e., whenever the tree refreshes, counts reflect the current state.
- **R005** (SHOULD): Count format uses a single space before the parenthesis (`Active (3)`, not `Active(3)` or `Active  (3)`).

## Scenarios

### Default workspace with mixed specs

**When** the Specs tree is rendered with 3 active, 12 completed, and 5 archived specs
**Then** the tree shows three group headers labeled exactly `Active (3)`, `Completed (12)`, `Archived (5)` (in that order), with the correct icons and tooltips unchanged

### Empty group is hidden

**When** no specs have status `archived`
**Then** no "Archived" group header is rendered (no `Archived (0)`)

### Count updates after refresh

**When** a spec transitions from active to completed and the tree refreshes
**Then** the Active header's count decreases by 1 and the Completed header's count increases by 1

## Out of Scope

- Introducing a separate "In Progress" group or changing the current 3-group model
- Changing the sort order, icons, or colors of groups
- Adding counts to nested items (spec documents, steps) — counts apply to top-level group headers only
- Localization / i18n of the count format
