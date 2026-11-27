# Implementation Plan: Your own hook on stock Spec Kit, and the template layer in force

**Spec**: [spec.md](./spec.md)

## Summary

The stock board gains three messages, `addStockHook`, `updateStockHook` and `removeStockHook`, carried out by a text writer beside the existing `setHookEnabled` in `stockHooks.ts`. The writer parses the registry only to check it and to find which entries are the user's own, then edits lines, so comments and every untouched entry survive byte for byte. The stock reader in `stockWorkflow.ts` marks each hook `own` and carries its `prompt`, and gives each template its layer stack, resolved in Spec Kit's own order (override, presets by priority, extensions by priority, core). Everything is TypeScript on the host: a stock project has no Companion scripts, so nothing here can live in `pipeline-graph.py`.

## Project Structure

```
apps/vscode/src/protocol/pipeline.ts                      new fields and three messages
apps/vscode/src/features/pipeline-builder/
  stockHooks.ts                                           add, update, remove user hooks
  stockWorkflow.ts                                        own/prompt on hooks, template layers
  stockGuard.ts                                           allow the three messages
  builderPanel.ts                                         handlers
  __tests__/stockHooks.test.ts, stockWorkflow.test.ts, stockGuard.test.ts
CHANGELOG.md                                              one [Unreleased] line
```

**Structure Decision**: extend the existing stock modules; no new file.

## Call paths

```calls add, edit or remove a user hook
  dispatch() @ apps/vscode/src/features/pipeline-builder/builderPanel.ts:937
~   stockRefusal() @ apps/vscode/src/features/pipeline-builder/stockGuard.ts:30
+   handlers.addStockHook / updateStockHook / removeStockHook @ apps/vscode/src/features/pipeline-builder/builderPanel.ts:576
      readStockWorkflow() @ apps/vscode/src/features/pipeline-builder/stockWorkflow.ts:271
+     addUserHook() / updateUserHook() / removeUserHook() @ apps/vscode/src/features/pipeline-builder/stockHooks.ts:77
```
note: the panel checks the step against the board's own steps before the writer runs.

```calls read the stock board
  sendBoard() @ apps/vscode/src/features/pipeline-builder/builderPanel.ts:1016
~   readStockWorkflow() @ apps/vscode/src/features/pipeline-builder/stockWorkflow.ts:271
~     registryHooks() @ apps/vscode/src/features/pipeline-builder/stockWorkflow.ts:112
~     templates() @ apps/vscode/src/features/pipeline-builder/stockWorkflow.ts:245
+       templateLayers() @ apps/vscode/src/features/pipeline-builder/stockWorkflow.ts:245
```

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: writes stock Spec Kit's own registry in the shape the CLI reads. |
| II. Spec-Driven Workflow | PASS: no change to the pipeline. |
| III. Visual and Interactive | PASS: data for the board; the webview is another team's change. |
| IV. Modular Architecture | PASS: stays inside the stock modules. |
