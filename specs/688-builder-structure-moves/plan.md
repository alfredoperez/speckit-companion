# Implementation Plan: Builder structure — add, move and remove

**Spec**: [spec.md](./spec.md)

## Summary

The lane header gains a "+ Add to <step>" button and the lanes end in a "+ step" control; both open the existing hook modal, which grows a Hook · Node · Step choice row. Node lists `step.dropped` and sends the same `addNode` write the phase menu sent; Step carries the new-step fields and sends `newStep`, with a warning taken from which shipped steps take a turn in the run. The node popover's footer becomes Move…, Edit node and Remove from the run; Move… swaps the body for a list of places checked against the node's `reads`, its readers and held nodes, using the writer's wording. A removed node leaves a struck row with Undo in its lane while the host's status carries the matching `remove:<step>:<node>` undo token. The phase name becomes a menu trigger with Rename…, Split and Merge in both directions. No host or protocol change.

## Project Structure

```
apps/vscode/webview/src/pipeline-builder/
  Canvas.tsx        lane add button, + step tail, phase label menu, struck row
  HookModal.tsx     choice row, Node and Step panels
  NodePopover.tsx   Move… list, new footer, More keeps the rest
  moves.ts          movePlaces(): legal and refused places with reasons
  index.tsx         wiring: modal modes, remove/undo row, new-step from modal
  __tests__/        new StructureModal.test.tsx, MovePlaces.test.tsx; updated Board, NodePopover
  __stories__/      Components and Interactions stories for the new states
apps/vscode/webview/styles/pipeline-builder.css
```

**Structure Decision**: extend the components that already own each surface; one pure helper in `moves.ts` holds the move rules so they are unit tested without the DOM.

## Call paths

```calls Add from the lane
  Step() @ apps/vscode/webview/src/pipeline-builder/Canvas.tsx:1135
~   openAttach() @ apps/vscode/webview/src/pipeline-builder/index.tsx:308
~     HookModal() @ apps/vscode/webview/src/pipeline-builder/HookModal.tsx:113
+       NodeChoice() @ apps/vscode/webview/src/pipeline-builder/HookModal.tsx:454
+       StepChoice() @ apps/vscode/webview/src/pipeline-builder/HookModal.tsx:454
```

```calls Move and remove from the popover
  NodePopover() @ apps/vscode/webview/src/pipeline-builder/NodePopover.tsx:125
+   movePlaces() @ apps/vscode/webview/src/pipeline-builder/moves.ts:33
~   act() @ apps/vscode/webview/src/pipeline-builder/index.tsx:330
```
note: the writer still decides; a removed node's struck row shows while the status carries its undo token.

## Screens

```screen modal Add to implement
title: Add to implement (new) (1)
list: Hook | Node | Step (new) (2)
field: Search nodes on offer (new)
list: Review the gaps | Verify by hand | Record what was verified (new)
row:
  text: Goes at the end of Execute (new) (3)
  button: Add node (new)
```
1: **One modal.** Hook, Node and Step share it, opened from any lane.
2: **Choice row.** Hidden when a hook is being edited.
3: **Phase pick.** Defaults to the last phase not ending on a held node.

```screen popover Pick the plan's blocks
title: Pick the plan's blocks
text: Move to (new)
list: Up, above Write the plan | To phase Check, first | To phase Wrap-up, first (new) (1)
row:
  button: Move… (new)
  button: Edit node
  button: Remove from the run (changed) (2)
```
1: **Refused rows.** Greyed with the writer's own reason; held nodes get a lock row.
2: **Undo.** The lane shows a struck row with Undo while the host offers it.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: writes go through the existing messages and the writer. |
| II. Spec-Driven Workflow | PASS: run through the Companion pipeline. |
| III. Visual and Interactive | PASS: the change is the builder's own UI. |
| IV. Modular Architecture | PASS: rules in `moves.ts`, UI in the components that own each surface. |
| User Interface | PASS: host tokens, light and dark, keyboard and focus rules kept. |
