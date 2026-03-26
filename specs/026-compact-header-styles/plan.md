# Plan: Compact Header & Callout Styles

**Date:** 2026-03-26

## Approach

Apply the already-defined semantic header color variables (`--header-title`, `--header-section`, `--header-subsection`) to h1/h2/h3. Reduce font sizes and vertical margins for a more compact, visually cohesive layout. Tighten callout margins.

## Files to Change

| File | Change |
|------|--------|
| `webview/styles/spec-viewer/_typography.css` | Reduce h1/h2/h3 font sizes, reduce margins, apply `--header-*` color variables |
| `webview/styles/spec-viewer/_callouts.css` | Reduce `.callout` margin-bottom, tighten `details.template-instructions` margins |
