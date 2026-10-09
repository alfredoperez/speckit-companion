# Plan: Calls card

## Summary

A new module `markdown/callsCard.ts` parses a `calls` fence body by the call-paths grammar and renders the card. It registers itself through the step-1 block registry. The renderer loop passes the block a context (the source line of each body row, and the `note:` line that follows the fence) and skips the note line it consumed. Rows reuse `wrapComponentLine`. The `strike` button posts `addComment` through the same path as the `+` button, and the host's `extractBlock` anchors a line inside a `calls` fence to that one line.

## Project Structure

```
apps/vscode/webview/src/spec-viewer/markdown/
  callsCard.ts            new: parseCalls, renderCallsCard, register
  blockFences.ts          context argument on BlockRenderer
  renderer.ts             pass row lines + note, skip consumed note, export row wrapper
  inline.ts               extract the file chip markup into one helper
  PlanComponents.stories.tsx   three stories
  __tests__/callsCard.test.ts  new
apps/vscode/webview/src/spec-viewer/editor/   strike click handler + struck state
apps/vscode/webview/styles/spec-viewer/_calls.css   new, imported after _code.css
apps/vscode/src/features/spec-viewer/extractBlock.ts   fence-aware single line
apps/copilot-canvas/vendor/   rebuilt by npm run canvas:build
```

**Structure Decision**: one new module owns grammar and markup; the renderer only supplies line numbers and consumes the note.

## Constitution Check

| Principle | Assessment |
|---|---|
| Extension isolation | PASS: viewer code only, nothing under `.claude/**`, `.specify/**` or `apps/speckit-extension` |
| Escaping | PASS: element text only; the one attribute path is the validated file chip |
| Docs | PASS: no user can meet a `calls` block yet, so no changelog or site doc |
