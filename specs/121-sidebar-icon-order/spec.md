# Spec: Sidebar Icon Order

**Slug**: 121-sidebar-icon-order | **Date**: 2026-05-28

## Summary

Tighten the Specs sidebar title-bar actions so the "create spec" icon is the leftmost action (first when reading the title bar from left to right) and the refresh icon is gone. The intent is a leaner title bar where the most common action — starting a new spec — is the first thing the eye hits, with no redundant refresh control competing for attention.

## Requirements

- **R001** (MUST): The "Create Spec" icon (`speckit.create`) renders as the first action in the Specs view title bar (`view == speckit.views.explorer`), ahead of Filter, Sort, and Collapse/Expand.
- **R002** (MUST): No "Refresh" icon appears in the Specs view title bar. If `speckit.refresh` (or any equivalent refresh contribution) is contributed there today, remove it.
- **R003** (MUST): Filter, Clear Filter (conditional), Sort, and Collapse/Expand remain available in the Specs title bar with their current visibility rules — only Create's position and Refresh's removal change.
- **R004** (SHOULD): The Steering view title bar is left unchanged by this spec (it has its own create/refresh pair under a different `when` clause).

## Scenarios

### Default state — populated sidebar

**When** the user opens the Specs sidebar with at least one spec present
**Then** the title-bar actions read, left-to-right: Create Spec, Filter, Sort, Collapse All (or Expand All if all collapsed) — and no Refresh icon is shown.

### Filter active

**When** a filter is applied (`speckit.specs.filterActive` is true)
**Then** the title bar reads: Create Spec, Filter, Clear Filter, Sort, Collapse/Expand — Create remains first.

### Empty workspace

**When** the workspace has no specs yet
**Then** Create Spec is still the first action in the title bar so the user can start one with a single click.

## Out of Scope

- The Steering view's title-bar actions.
- Right-click / context-menu actions on individual spec items.
- The status bar, footer, or any non-sidebar surface.
- Renaming, re-icon'ing, or restyling the existing actions — this is order + removal only.
