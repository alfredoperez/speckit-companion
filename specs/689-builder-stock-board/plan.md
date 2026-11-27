# Plan: Workflow Builder on stock Spec Kit

## Summary

`StockBoard.tsx` is rebuilt from a vertical list into the same lanes and 2B cards the Companion board draws, reusing the board's lane, card, hook-row, edge-add, popover and modal styles. Three small components join it: a stock add/edit hook modal that sends `addStockHook` and `updateStockHook`, a hook popover (a sheet when narrow) that shows a registry entry's fields and offers Edit and Remove for the person's own, and a documents modal that lists each template's layers top first with the one in force marked. The banner's Add Companion button sends one new board message, `installCompanion`, which the host answers by running the existing `speckit.companion.installSpecKitExtension` command and which the stock guard allows.

## Project Structure

```
apps/vscode/src/protocol/pipeline.ts                      ~ installCompanion message
apps/vscode/src/features/pipeline-builder/
  builderPanel.ts                                         ~ installCompanion handler
  stockGuard.ts                                           ~ allow installCompanion
  __tests__/stockGuard.test.ts                            ~ it is allowed
apps/vscode/webview/src/pipeline-builder/
  StockBoard.tsx                                          ~ lanes, cards, banner, docs row, header switcher
  StockHookModal.tsx                                      + add and edit a stock hook
  StockHookPopover.tsx                                    + a hook's fields, Edit, Remove
  StockDocuments.tsx                                      + templates, layers, constitution
  StockSetup.tsx                                          + workflows and presets modal
  index.tsx                                               ~ wire the new actions
  __tests__/StockBoard.test.tsx                           ~ rewritten for the new board
  __stories__/PipelineBuilder.stories.tsx                 ~ stock stories, modals, narrow
apps/vscode/webview/styles/pipeline-builder.css           ~ stock section replaced
```

**Structure Decision**: one file per surface, each reusing the existing `pb-modal`, `pb-popover`, `pb-card` and lane classes, so the stock board looks like the Companion board because it is drawn by the same CSS.

## Call paths

```calls Add a hook of your own on a stock step
~ StockBoard() @ apps/vscode/webview/src/pipeline-builder/StockBoard.tsx:96
+   StockHookModal() **new** @ apps/vscode/webview/src/pipeline-builder/StockHookModal.tsx
    addStockHook @ apps/vscode/src/features/pipeline-builder/builderPanel.ts:590
```

```calls Add Companion from the banner
~ StockBoard() @ apps/vscode/webview/src/pipeline-builder/StockBoard.tsx:96
~   stockRefusal() @ apps/vscode/src/features/pipeline-builder/stockGuard.ts:30
+   installCompanion @ apps/vscode/src/features/pipeline-builder/builderPanel.ts:638
```
note: the handler runs the existing speckit.companion.installSpecKitExtension command.

## Screens

```screen board The stock board
title: Workflow · Drawing Full SDD Cycle · Changes apply at once (changed) (1)
row:
  text: This project runs stock Spec Kit. (new)
  button: Add Companion (new) (2)
row:
  text: 1 specify lane, card with its hooks (changed) (3)
  chip: Review the spec, waits for you (changed)
  text: 2 plan lane (changed)
text: With Companion, dashed (new)
row:
  text: Documents (changed) (4)
  button: Extensions and workflows (new)
```
1: **No Build.** The header names the drawn workflow, a switcher when there are several, and says changes apply at once.
2: **One way to Companion.** It runs the existing install command.
3: **Same card.** Before hooks at the top, the command in the middle, after hooks at the bottom, "+ before" and "+ after" on its edges.
4: **Which layer wins.** Opens the documents modal.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: writes only through the existing stock writers. |
| II. Spec-Driven Workflow | PASS: no change to the workflow. |
| III. Visual and Interactive | PASS: the stock board gains the same visual board. |
| IV. Modular Architecture | PASS: one component per surface, no new dependency. |
