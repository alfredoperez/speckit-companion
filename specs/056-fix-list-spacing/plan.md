# Plan: Fix List Item Spacing

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-10

## Approach

Tighten list item vertical spacing in the spec viewer by reducing line-height on `li` elements and removing inherited `.line` padding for list items. This is a CSS-only change targeting `_typography.css` and `_line-actions.css`.

## Files to Change

| File | Change |
|------|--------|
| `webview/styles/spec-viewer/_typography.css` | Reduce `line-height` on `#markdown-content li` from `--leading-relaxed` (1.625) to `--leading-normal` (1.5) |
| `webview/styles/spec-viewer/_line-actions.css` | Zero out vertical padding on `li.line` to prevent double-spacing |
