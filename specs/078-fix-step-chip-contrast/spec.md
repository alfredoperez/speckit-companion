# Spec: Fix Step Chip Contrast

**Slug**: 078-fix-step-chip-contrast | **Date**: 2026-04-24

## Summary

The current-step chip in the spec viewer's step tabs reads faded on VS Code themes where `--vscode-focusBorder` resolves to purple (Dracula, Monokai Pro). Bump the accent-tinted fill and add an outer accent glow so the chip reads as clearly elevated across all themes.

## Requirements

- **R001** (MUST): The `.step-tab.current` chip's label appears visibly contrasted against the accent-tinted fill on Dracula and Monokai Pro themes.
- **R002** (MUST): The chip reads as clearly elevated (distinct from neighboring step tabs) on all five reference themes.
- **R003** (MUST): No visual regression on Default Dark Modern, Default Light Modern, or Default High Contrast.
- **R004** (SHOULD): The fix uses only `var(--accent, …)` and CSS color functions — no theme-specific overrides.

## Scenarios

### Viewing on a purple-accent theme

**When** a user opens the spec viewer using Dracula or Monokai Pro
**Then** the current-step chip's accent-tinted fill and outer glow make the chip and its label visibly stand out from neighboring tabs

### Viewing on a blue-accent theme

**When** a user opens the spec viewer using Default Dark Modern
**Then** the current-step chip renders with at least parity to the v0.13.0 appearance (no regression)

### Viewing on a high-contrast theme

**When** a user opens the spec viewer using Default High Contrast
**Then** the chip's inset ring and label remain readable; the new outer glow does not muddy the existing high-contrast outline

## Out of Scope

- Changes to `.step-tab.in-flight`, `.step-tab.done`, or `.step-tab.locked` styles.
- Theme-specific CSS overrides or detection logic.
