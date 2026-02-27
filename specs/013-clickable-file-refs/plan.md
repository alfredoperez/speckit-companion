# Plan: Clickable File References in Spec Viewer

**Spec**: [spec.md](./spec.md) | **Date**: 2026-02-27

## Approach

Filename detection happens inside the existing `parseInline` function in `inline.ts` — when stashing a backtick span, a regex checks whether the content looks like a filename (contains a `.ext` portion) and emits a `<button class="file-ref">` wrapper instead of plain `<code>`. Click events bubble up to a single delegated listener in `actions.ts` that posts an `openFile` message; the extension handler resolves the file with `vscode.workspace.findFiles` using the basename and opens it beside the viewer.

## Files

### Create

_None_

### Modify

| File | Change |
|------|--------|
| `webview/src/spec-viewer/markdown/inline.ts` | In the backtick-stash step, detect filename pattern (`/[^\s/\\]+\.[a-zA-Z][a-zA-Z0-9]+$/`) and emit `<button class="file-ref" data-filename="…"><code>…</code></button>` instead of bare `<code>` |
| `webview/src/spec-viewer/types.ts` | Add `{ type: 'openFile'; filename: string }` to `ViewerToExtensionMessage` union |
| `webview/src/spec-viewer/actions.ts` | Add delegated `click` listener on `document` for `.file-ref` buttons that posts `openFile` with `dataset.filename` |
| `src/features/spec-viewer/messageHandlers.ts` | Add `case 'openFile'`: extract basename, call `vscode.workspace.findFiles`, open first match in `ViewColumn.Beside`, or show warning if none found |
| `webview/styles/spec-viewer/_code.css` | Add `.file-ref` rule: `cursor: pointer; text-decoration: underline; color: var(--vscode-textLink-foreground)` while keeping `font-family: var(--font-mono)` on the inner `<code>` |
