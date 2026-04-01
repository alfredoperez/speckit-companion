# Plan: Fix Step Highlight for Completed Steps

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-01

## Approach

Add a `viewing-complete` CSS class for steps that are both completed and currently being viewed. Apply green-tinted highlight styling (using `--success` variable) instead of the purple accent. The class is assigned in the HTML generator and the webview navigation updater.

## Files to Change

### Modify

- `webview/styles/spec-viewer/_navigation.css` — Add `.step-tab.viewing.exists` CSS rules with green-tinted highlight border and glow, overriding the default purple `.viewing` style
- `src/features/spec-viewer/html/navigation.ts` — No code change needed; the existing class logic already applies both `exists` and `viewing` simultaneously, so a CSS compound selector `.step-tab.viewing.exists` will handle it
- `webview/src/spec-viewer/navigation.ts` — Verify the runtime class updater preserves both `exists` and `viewing` classes simultaneously (it already does)
