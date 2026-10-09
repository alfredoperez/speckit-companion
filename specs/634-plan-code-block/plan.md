# Plan: Plan code block

**Scale note**: about 20 files in three areas: the viewer's markdown renderer, the spec-kit extension's plan check and part, and docs. The viewer change must not move one byte of an ordinary code fence, so read the renderer loop change first.

## Summary

A new module `markdown/codeCard.ts` parses the fence's info line and its pins and draws the card, the way `callsCard.ts` does for calls. It registers under a new block name, `code`, and the render loop sends a fence there when its language is not a block name and the text after the language starts with `sketch` or looks like `<file>:<from>-<to>`. The loop hands every block the `pin` lines that follow the fence and skips the ones a card consumed. `check_plan.py` learns the same grammar and reads each cited file. A new part, `code-pins.md`, asks the plan step for the block and records the check.

## Project Structure

```
apps/vscode/webview/src/spec-viewer/markdown/
  codeCard.ts                  new: parseCodeInfo, parseCode, renderCodeCard
  blockFences.ts               'code' block name, pins on the context
  renderer.ts                  route a code card, collect pins, skip consumed lines
  PlanComponents.stories.tsx   code block stories, light and dark
  __tests__/codeCard.test.ts   new
apps/vscode/webview/styles/spec-viewer/
  _code-card.css               new, imported after _calls.css
  index.css
apps/vscode/src/features/spec-viewer/extractBlock.ts   a code-card line or pin anchors alone
apps/copilot-canvas/vendor/    rebuilt by npm run canvas:build
apps/speckit-extension/
  presets/_parts/code-pins.md  new part
  scripts/check_plan.py        code block grammar and checks
  tests/test_check_plan.py
  docs/code-pins.md            new
  docs/node-model.md, README.md, CHANGELOG.md
.specify/companion/nodes/code-pins.md   mirror
CHANGELOG.md, apps/website/.../customize/hooks.mdx
```

**Structure Decision**: one viewer module owns the grammar and the markup, one script owns the check, and the two agree on what breaks the grammar.

## Call paths

```calls A code fence that names a file becomes a card
  renderMarkdown() @ apps/vscode/webview/src/spec-viewer/markdown/renderer.ts:237
~   renderBlockFence() @ apps/vscode/webview/src/spec-viewer/markdown/blockFences.ts:30
+     renderCodeCard() **new** @ apps/vscode/webview/src/spec-viewer/markdown/codeCard.ts
        fileRefHtml() @ apps/vscode/webview/src/spec-viewer/markdown/inline.ts:58
        wrapComponentLine() @ apps/vscode/webview/src/spec-viewer/markdown/renderer.ts:178
```
note: the loop only routes to the card when the info line carries a sketch or a citation.

```calls The check reads a cited range
  main() @ apps/speckit-extension/scripts/check_plan.py:243
~   check_text() @ apps/speckit-extension/scripts/check_plan.py:124
+     check_code() @ apps/speckit-extension/scripts/check_plan.py:124
~   render_human() @ apps/speckit-extension/scripts/check_plan.py:232
```

```calls A comment on a code line anchors to that line
  extractBlock() @ apps/vscode/src/features/spec-viewer/extractBlock.ts:29
~   openCallsFence() @ apps/vscode/src/features/spec-viewer/extractBlock.ts:13
```

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility | PASS: the part is attachable and off by default |
| II. Spec-driven workflow | PASS: nothing is added to a shipped command |
| III. Visual and interactive | PASS: a card with line comments, in both themes |
| IV. Modular architecture | PASS: one module for the card, registered through the block seam |
