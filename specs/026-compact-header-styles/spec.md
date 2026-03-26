# Compact Header & Callout Styles

**Slug:** 026-compact-header-styles
**Date:** 2026-03-26
**Status:** Draft

## Problem

The spec-viewer webview has oversized headers with excessive vertical spacing between sections. Empty space between elements creates a sparse, disconnected layout. Headers lack color differentiation, and callouts have too much top/bottom margin.

## Requirements

1. **Reduce header font sizes** — h1 from `2.074rem` to ~`1.6rem`, h2 from `1.35rem` to ~`1.15rem`, h3 proportionally
2. **Tighten vertical spacing** — reduce margins on h1, h2, h3 (especially `margin-top` on h2 from `32px` to ~`20px`)
3. **Add color to headers** — use existing `--header-title`, `--header-section`, `--header-subsection` CSS variables (already defined in `_variables.css` but unused in `_typography.css`)
4. **Reduce callout margins** — tighten top/bottom margin on `.callout` and `details.template-instructions`

## Files Affected

- `webview/styles/spec-viewer/_typography.css` — header sizes, margins, colors
- `webview/styles/spec-viewer/_callouts.css` — callout margin adjustments
