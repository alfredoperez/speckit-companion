# Spec: Polish Subnav Tabs

**Slug**: 079-polish-subnav-tabs | **Date**: 2026-04-24

## Summary

The right-aligned related-document subnav tabs in the spec viewer (Data Model / Quickstart / Research / Requirements) currently use muted text and a thin underline for the active state, which reads as visual noise rather than clear navigation. This polishes the active and inactive states so they share visual language with the primary step-tab chip — making the two navigation levels feel like one coherent system.

## Requirements

- **R001** (MUST): The active `.related-tab` must be clearly distinguishable from inactive tabs at arm's length. It uses a subtle accent-tinted pill fill, `--text-primary` text in bold weight, and an accent-colored underline flush to the pill's bottom edge.
- **R002** (MUST): Inactive `.related-tab` text uses `--text-secondary` (not `--text-muted`), and the hover state applies `--bg-hover` background while shifting text to `--text-primary`.
- **R003** (MUST): Active and inactive subnav styling reads as visually coherent with the primary `.step-tab.current` chip — same accent-tint family, same border-radius scale, same hover-feedback pattern — so the two navigation levels feel like one system.
- **R004** (SHOULD): No layout shift between active and inactive tabs (the underline/pill must not cause the tab to jump in height or width when toggled).

## Scenarios

### Viewing Plan with related sub-docs

**When** the user opens a Plan that has Data Model, Quickstart, and Research sub-docs and selects "Quickstart"
**Then** the Quickstart tab shows an accent-tinted pill background with bold `--text-primary` text and an accent underline at its bottom; Data Model and Research show `--text-secondary` text with no fill.

### Hovering an inactive subnav tab

**When** the user hovers an inactive `.related-tab`
**Then** the tab's background becomes `--bg-hover` and text shifts to `--text-primary`, mirroring the inactive `.step-tab` hover behavior.

### Switching active subnav tab

**When** the user clicks a different related-tab
**Then** the previously active tab returns to the inactive style and the newly clicked tab gains the accent-tinted pill + bold + underline — with no vertical or horizontal layout shift in the row.

## Out of Scope

- Changes to `.step-tab` styling (the primary nav chips already have the target visual language).
- Changes to tab order, labels, or visibility logic in `NavigationBar.tsx`.
- Theme-token changes; this uses existing `--accent`, `--text-primary`, `--text-secondary`, `--bg-hover` variables.
