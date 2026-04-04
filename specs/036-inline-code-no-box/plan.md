# Plan: Inline Code Without Boxes

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-04

## Approach

Remove `background`, `border`, and `border-radius` properties from inline code CSS rules across four stylesheets. Keep `font-family`, `font-size`, `color`, and minimal `padding` so inline code remains visually distinct as monospace colored text.

## Files to Change

- `webview/styles/spec-viewer/_typography.css` — remove background, border, border-radius from `#markdown-content code:not(pre code)`
- `webview/styles/spec-markdown.css` — remove background-color, border-radius from `p code, li code`
- `webview/styles/spec-editor.css` — remove background-color, border-radius from `.preview-container code`
- `webview/styles/workflow.css` — remove background, border, border-radius from `.line-content code`
