# Spec: Sort Options (name / date / status)

**Slug**: 076-sort-specs-tree | **Date**: 2026-04-24

## Summary

Add a title-bar sort picker to the specs tree so users can switch between sort modes (numeric prefix, name, date, status) within each group. Helps power users navigate large spec lists once they accumulate dozens of entries. Complements the existing fuzzy filter.

## Requirements

- **R001** (MUST): A `Sort Specs…` command is available from the specs tree title bar with a sort icon, alongside the existing filter/collapse icons.
- **R002** (MUST): Invoking the command opens a QuickPick with options: `Number (default)`, `Name (A–Z)`, `Date Created (newest)`, `Date Modified (newest)`, `Status (current step)`.
- **R003** (MUST): The selected sort mode persists in workspace state and survives VS Code reloads.
- **R004** (MUST): The selected sort mode applies to specs within each group (Active, Completed, Archived); group order stays Active → Completed → Archived.
- **R005** (MUST): The default sort mode is `Number` — the current numeric-prefix-descending behavior, so nothing changes visually for users who never open the picker.
- **R006** (SHOULD): An active non-default sort is reflected in the picker (checkmark on the current option) and the title-bar icon indicates a non-default sort is in effect.
- **R007** (SHOULD): Specs without the signal needed for the active sort mode (e.g. no numeric prefix, missing `.spec-context.json`) fall back to a stable tie-breaker (numeric prefix, then name) so ordering is deterministic.
- **R008** (MAY): A `Reset Sort` entry appears in the QuickPick when a non-default sort is active.

## Scenarios

### Default sort (unchanged behavior)

**When** a user first opens the specs tree after installing this version
**Then** specs are sorted by numeric prefix descending within each group — identical to today's behavior — and the sort icon appears in the title bar with no "modified" indicator.

### Switching sort mode

**When** a user clicks the sort icon and selects `Name (A–Z)`
**Then** specs in every group re-sort alphabetically by slug, the QuickPick shows a checkmark next to `Name (A–Z)` on next open, and the choice persists across reloads.

### Sorting by status

**When** a user selects `Status (current step)`
**Then** specs within each group are ordered by their `.spec-context.json` `currentStep` in workflow order (specify → plan → tasks → implement → done), with specs missing a context falling back to numeric-prefix tie-break.

### Date sort with missing signal

**When** a spec folder cannot be stat'd (fs error) under `Date Modified` sort
**Then** the affected spec is placed at the end of its group rather than breaking the sort, and no uncaught error is thrown.

### Interaction with filter

**When** a user has both an active fuzzy filter and a non-default sort
**Then** filter-matching specs are displayed in the chosen sort order — sort applies after filter.

## Non-Functional Requirements

- **NFR001** (SHOULD): Sort computation runs synchronously during tree `getChildren()` and does not add perceptible latency for up to 200 specs (no new async I/O beyond reads already cached for filter).
- **NFR002** (SHOULD): Sort state uses the same workspace-state pattern as `SpecsFilterState` so the two surfaces evolve together.

## Out of Scope

- Cross-group sorting (mixing Active/Completed/Archived into one list).
- Custom/manual ordering (drag-and-drop).
- Ascending/descending toggles per field — each mode has one canonical direction matching user expectation (name A–Z, date newest-first, status earliest-step-first).
- Per-workspace vs global sort preference — workspace state only.
