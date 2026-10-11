# Implementation Plan: Plan cards that respond on the Copilot app board

**Feature**: [board-states-card.spec.md](./board-states-card.spec.md)

## Summary

The board draws plan cards with the viewer's renderer but ships none of the viewer's click code, so it switches the states card off in CSS and shows a plain list instead. The fix bundles the viewer's own `statesSelect.ts` as one more vendor file, serves it to the page, calls `setupStatesSelect()` once, and removes the CSS that switched the card off. The file is not moved: it has no imports, so the board build reads it where it is.

A file name is a `<button>` in the rendered markup. The board disables each one after it draws a document and turns off its pointer and hover in CSS.

## Project Structure

```text
apps/copilot-canvas/
├── build.mjs                 # fifth bundle: vendor/states-select.mjs
├── server.mjs                # ASSETS route for it
├── vendor/states-select.mjs  # generated, committed, CI diffs it
├── public/
│   ├── app.js                # import and call setupStatesSelect(); disable file names after each draw
│   └── styles.css            # drop the states overrides; file names inert
├── tests/page.test.mjs       # a plan with a states fence and a file name
└── README.md                 # vendor table row (the changelog entry goes in the root CHANGELOG.md, where board entries live)
```

**Structure Decision**: one more generated vendor file, the pattern the board already uses for the renderer and the styles.

## Call paths

```calls picking a state on the board
  app.js module load @ apps/copilot-canvas/public/app.js
+   setupStatesSelect() @ apps/vscode/webview/src/spec-viewer/editor/statesSelect.ts:40
      selectState() @ apps/vscode/webview/src/spec-viewer/editor/statesSelect.ts:2
```
note: the listener is on the document and added once, so it outlives every redraw of the panel.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. No setting is touched. |
| II. Spec-Driven Workflow | PASS. Run through the Companion pipeline. |
| III. Visual and Interactive | PASS. A drawn card becomes a working one. |
| IV. Modular Architecture for Complex Features | PASS. One picking module, read by both builds. |

Re-checked after design: unchanged.
