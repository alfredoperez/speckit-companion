# Tasks: Clickable File References in Spec Viewer

**Plan**: [plan.md](./plan.md) | **Date**: 2026-02-27

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add `openFile` to message type union — `webview/src/spec-viewer/types.ts`
  - **Do**: Add `{ type: 'openFile'; filename: string }` to the `ViewerToExtensionMessage` union type
  - **Verify**: TypeScript compiles without errors

- [x] **T002** Detect filename pattern and emit `<button class="file-ref">` *(depends on T001)* — `webview/src/spec-viewer/markdown/inline.ts`
  - **Do**: In the backtick-stash step inside `parseInline`, test the span content against `/[^\s/\\]+\.[a-zA-Z][a-zA-Z0-9]+$/`; if it matches, emit `<button class="file-ref" data-filename="…"><code>…</code></button>` instead of bare `<code>`
  - **Verify**: Plain code spans (`` `npm install` ``, `` `const x = 1` ``) still render as `<code>`; `` `card.component.ts` `` renders as a `<button class="file-ref">` wrapping a `<code>`

- [x] **T003** Add delegated click listener for `.file-ref` buttons *(depends on T002)* — `webview/src/spec-viewer/actions.ts`
  - **Do**: Add a delegated `click` listener on `document` that checks `event.target.closest('.file-ref')`; on match, post `{ type: 'openFile', filename: el.dataset.filename }` to the extension via `vscode.postMessage`
  - **Verify**: Clicking a rendered file-ref button posts the correct message (verify with console.log or DevTools)

- [x] **T004** Handle `openFile` message in extension *(depends on T003)* — `src/features/spec-viewer/messageHandlers.ts`
  - **Do**: Add `case 'openFile'`: extract `path.basename(message.filename)`, call `vscode.workspace.findFiles(`**/${basename}`, null, 1)`, open the first result with `vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Beside })`, or call `vscode.window.showWarningMessage(`File not found in workspace: ${basename}`)` if the array is empty
  - **Verify**: Clicking a file-ref for an existing file opens it beside the viewer; clicking one for a nonexistent file shows the warning notification and does not throw

- [x] **T005** Style `.file-ref` buttons *(depends on T002)* — `webview/styles/spec-viewer/_code.css`
  - **Do**: Add `.file-ref` rule: `background: none; border: none; padding: 0; cursor: pointer; text-decoration: underline; color: var(--vscode-textLink-foreground);` and ensure the inner `code` retains `font-family: var(--font-mono)`
  - **Verify**: File-ref spans display as underlined link-colored monospace text; non-filename code spans are visually unchanged

---

## Phase 2: Quality (Parallel — launch agents in single message)

- [x] **T006** [P][A] Unit tests — `test-expert`
  - **Files**: `webview/src/spec-viewer/markdown/inline.test.ts`
  - **Pattern**: Jest / Vitest unit tests (match existing test patterns in the project)
  - **Reference**: any existing `.test.ts` or `.spec.ts` under `webview/src/`
  - **Cases**: filename pattern detected → button emitted; non-filename code → plain `<code>`; path with directory prefix uses basename for `data-filename`

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T005 | [ ] |
| Phase 2 | T006 | [ ] |
