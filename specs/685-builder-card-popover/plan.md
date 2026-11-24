# Implementation Plan: Builder card with its hooks inside, and a node popover

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md) · **Data model**: [data-model.md](./data-model.md)

## Summary

The board's node card becomes one outlined block: a before slot of hook rows, the node row with its name and at most two marks, and an after slot. Every hook row carries a kind icon, its name and a status read from one pure derivation over the hook's `problem` and the last run record, which the webview now asks the host for on every graph. Phase and step hooks draw as slim rows in the same style at the top of their phase or lane. Clicking a node opens a popover beside it, a bottom sheet when narrow, holding the node's facts, its hooks with outcome and reason, and Edit node, Add hook and a More menu carrying every action the side Inspector had; Edit node opens the existing instructions pane.

## Project Structure

```text
apps/vscode/webview/src/pipeline-builder/
├── Canvas.tsx            # card, slots, hook rows, phase and step hook rows
├── hookStatus.ts         # new: status derivation and short problem words
├── NodePopover.tsx       # new: the popover and the bottom sheet
├── HookIcon.tsx          # new: the four kind icons
├── index.tsx             # popover state, readHookRuns, wiring of every action
├── __tests__/            # Board, HookDrag, HookStatus, NodePopover tests
└── __stories__/          # Components stories for the card and the popover
apps/vscode/webview/styles/pipeline-builder.css   # card, rows, status, popover, sheet
```

**Structure Decision**: Two new components and one pure module beside the existing builder files; the host and protocol are unchanged.

## Call paths

```calls draw a card
  Canvas() @ apps/vscode/webview/src/pipeline-builder/Canvas.tsx:1413
~   Node() @ apps/vscode/webview/src/pipeline-builder/Canvas.tsx:646
+     HookRow() @ apps/vscode/webview/src/pipeline-builder/Canvas.tsx:476
+       hookStatus() **new** @ apps/vscode/webview/src/pipeline-builder/hookStatus.ts
```

```calls open a node
  App() @ apps/vscode/webview/src/pipeline-builder/index.tsx:136
+   NodePopover() **new** @ apps/vscode/webview/src/pipeline-builder/NodePopover.tsx
```
note: Edit node in the popover opens the existing Inspector in the side column.

```calls read the run record
  App() @ apps/vscode/webview/src/pipeline-builder/index.tsx:136
~   onMessage() @ apps/vscode/webview/src/pipeline-builder/index.tsx:159
```
note: a `graph` message posts `readHookRuns`; a `hookRuns` answer is kept in state and passed to the canvas.

## Screens

```screen lane A lane with a popover
title: implement
text: EXECUTE
row:
  text: Ask me before adding a new dependency (new) (1)
  chip: skipped (new)
text: Execute the tasks (changed) (2)
row:
  text: npm run lint (new)
  chip: not seen (new)
list: Edit node | Add hook | More (new) (3)
```
1: **Hooks live in the card.** Before rows sit above the node, after rows below, in one outline.
2: **Two marks at most.** The written file, a gate diamond or "yours".
3: **The popover's footer.** More keeps every action the side pane had.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: no configuration format changes. |
| II. Spec-Driven Workflow | PASS: run through the Companion pipeline. |
| III. Visual and Interactive | PASS: improves the board, theme tokens only. |
| IV. Modular Architecture | PASS: status derivation and popover are their own modules. |
