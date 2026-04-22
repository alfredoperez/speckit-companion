# Plan: Viewer Header Layout

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-22

## Approach

Restructure `SpecHeader.tsx` to render two explicit rows (badges row + title row) by wrapping the badge cluster and the title in their own containers, and switch `.spec-header` from a single `flex-wrap` row to `flex-direction: column` with a nested inline row for badges. Suppress the file-name pill by removing the `Plan`/`Spec` capture branch in `preprocessors.ts` so `fileLinks` is never populated — the `.spec-file-link` / `.spec-file-ref` CSS is left in place but goes unused (no callers remain in shipped code).

## Files to Change

- `webview/src/spec-viewer/components/SpecHeader.tsx` — wrap `spec-badge` + `spec-header-branch` in a `.spec-header-badges` row; move `spec-header-title` (and optional `spec-date`) into a `.spec-header-main` row.
- `webview/styles/spec-viewer/_content.css` — change `.spec-header` to `flex-direction: column` with `align-items: stretch`; add `.spec-header-badges { display: flex; gap: var(--space-3); align-items: center; }` and `.spec-header-main { display: flex; gap: var(--space-3); align-items: baseline; }`.
- `webview/src/spec-viewer/markdown/preprocessors.ts` — stop emitting the `.spec-file-link` block (drop the `Plan`/`Spec` push into `fileLinks`, and the `fileLinkHtml` construction/concatenation).
- `webview/src/spec-viewer/components/StepTab.tsx` — reorder canonical-state precedence so `done` wins over `current`; always apply `current` as an **additional** class when `isViewing`, so a completed-and-viewed tab gets both `.done` and `.current` classes.
- `webview/styles/spec-viewer/_navigation.css` — restore the outline rule on `.step-tab.current` (removed in PR #118) so the currently viewed tab has a clearly visible frame.
