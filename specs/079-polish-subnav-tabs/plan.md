# Plan: Polish Subnav Tabs

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-24

## Approach

Update the "Related Documents Tabs" rules in `webview/styles/spec-viewer/_navigation.css` so the active state uses an accent-tinted pill fill (mirroring `.step-tab.current`'s `color-mix` recipe) plus an accent underline flush to the pill bottom, and the inactive state uses `--text-secondary` with `--bg-hover` on hover. Pure CSS — no markup or component changes.

## Files to Change

### Modify

- `webview/styles/spec-viewer/_navigation.css` — replace the `.related-tab`, `.related-tab:hover`, and `.related-tab.active` rule blocks (lines ~183–205) to:
  - `.related-tab`: change color from `--text-muted` to `--text-secondary`, keep transparent background and 2px transparent bottom border for layout stability, add `border-radius: var(--radius-sm)` so hover/active fill renders as a pill.
  - `.related-tab:hover`: keep current behavior (`--text-primary` + `--bg-hover`).
  - `.related-tab.active`: add `background: color-mix(in srgb, var(--accent, #4a9eff) 18%, transparent)` for the pill tint, set `color: var(--text-primary)`, set `font-weight: 600` (bold), and keep `border-bottom: 2px solid var(--accent)` flush to the pill bottom.
