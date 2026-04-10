# Plan: Remove Terminal Toast

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-10

## Approach

Remove the single `postMessage` call that sends the `actionToast` with "Opening terminal…" in `specViewerProvider.ts`. No other files need changing — the webview toast handler and types can remain as they serve other toasts.

## Files

### Modify

| File | Change |
|------|--------|
| `src/features/spec-viewer/specViewerProvider.ts` | Remove line 313: the `postMessage` call sending "Opening terminal…" toast |
