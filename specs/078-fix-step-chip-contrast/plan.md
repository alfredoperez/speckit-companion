# Plan: Fix Step Chip Contrast

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-24

## Approach

Modify the `.step-tab.current` rule in `webview/styles/spec-viewer/_navigation.css`: bump the `color-mix` fill from 15% to ~22% accent and add an outer `box-shadow` glow at ~25% accent for depth. Pure CSS change to one rule — no JS, no template, no theme detection.

## Files to Change

### Modify

- `webview/styles/spec-viewer/_navigation.css` — update `.step-tab.current` rule (lines 97–101): increase the `color-mix` percentage and add an outer `box-shadow` glow alongside the existing inset ring.
