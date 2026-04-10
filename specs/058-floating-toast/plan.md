# Plan: Floating Toast Notification

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-10

## Approach

Convert the spec viewer's inline `<span>` toast into a floating notification positioned above the footer with slide-up/fade-in animation and auto-dismiss. The toast will be rendered as a portal-style element outside the footer flow, using CSS `position: absolute` relative to the viewer container. Also remove the "Opening terminal…" toast message from `specViewerProvider.ts` since it's redundant.

## Technical Context

**Stack**: TypeScript, Preact (webview), VS Code Extension API
**Key Dependencies**: None new — pure CSS animations + minor Preact component changes

## Files

### Create

_None_

### Modify

| File | Change |
|------|--------|
| `webview/src/shared/components/Toast.tsx` | Rewrite component: render as floating `<div>` with absolute positioning; update `showToast` to handle slide-up animation class and auto-dismiss with animation-out before removal |
| `webview/styles/spec-viewer/_footer.css` | Replace `.action-toast` styles: add absolute positioning above footer, centered horizontally, background/border/shadow using VS Code theme vars, slide-up + fade-in keyframes, fade-out keyframes |
| `webview/src/spec-viewer/components/FooterActions.tsx` | Move `<Toast>` out of `.actions-left` div — render it as a sibling above the footer or in a wrapper that allows absolute positioning relative to the footer |
| `src/features/spec-viewer/specViewerProvider.ts` | Remove the `postMessage({ type: 'actionToast', message: 'Opening terminal…' })` call from `executeInTerminal` |

## Risks

- **Toast positioning in different webview sizes**: Mitigation — use `position: absolute` with `bottom` + `left: 50%` + `transform: translateX(-50%)` relative to a positioned container, which works at any width.
