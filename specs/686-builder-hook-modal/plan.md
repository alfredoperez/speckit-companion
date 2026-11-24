# Plan: add a hook from a focused modal

## Summary

The side-pane hook form becomes a centred modal, `HookModal`, opened from "+ before" and "+ after" buttons on each node's edges and from every existing "Add hook" route. It keeps the old form's writes and callbacks (`Attachment`, `onAttach`, `onRemove`, `onMove`) so the host sees exactly the same messages, and adds a searchable result list fed by `choices.skillCatalog` when present. The modal traps focus, returns it to its opener, and turns into a full-height sheet under the builder's narrow width through the existing `@container builder` query. No host or protocol change.

## Project Structure

```
apps/vscode/webview/src/pipeline-builder/
  HookModal.tsx           new: the modal (add and edit)
  AttachForm.tsx          changed: hook form removed; Attachment, boundaryOf, NewStepForm, NewWorkflowForm stay
  Canvas.tsx              changed: edge "+" buttons replace the seams
  index.tsx               changed: renders HookModal for side.kind 'attach'; keep-open
  __tests__/HookModal.test.tsx   new
  __tests__/*.test.tsx    changed where they used the side form or seams
  __stories__/*.stories.tsx      changed where they render the form or seams
apps/vscode/webview/styles/pipeline-builder.css   changed: modal, sheet, edge buttons
```

**Structure Decision**: one new component beside the old form; the old form's file keeps the shared types so imports elsewhere stay put.

## Call paths

```calls open from a node edge
  Node() @ apps/vscode/webview/src/pipeline-builder/Canvas.tsx:726
-   Seam() @ apps/vscode/webview/src/pipeline-builder/Canvas.tsx:679
+   EdgeAdd() @ apps/vscode/webview/src/pipeline-builder/Canvas.tsx:726
    actions.onAdd(node.id, when) @ apps/vscode/webview/src/pipeline-builder/Canvas.tsx:263
      openAttach() @ apps/vscode/webview/src/pipeline-builder/index.tsx:305
~       AttachForm usage @ apps/vscode/webview/src/pipeline-builder/index.tsx:459
+         HookModal() **new** @ apps/vscode/webview/src/pipeline-builder/HookModal.tsx
```
note: the phase menu, popover and node pane already call openAttach, so they reach the modal unchanged.

```calls add with keep open
+ HookModal submit @ apps/vscode/webview/src/pipeline-builder/HookModal.tsx
~   onAttach(attachment, keepOpen) @ apps/vscode/webview/src/pipeline-builder/index.tsx:468
      send addHook @ apps/vscode/webview/src/pipeline-builder/index.tsx:486
```

## Screens

```screen modal Add before a node
title: Add before Execute the tasks (new) (1)
text: in implement (new)
field: Search skills (new) (2)
row:
  button: Skill (changed)
  button: Instruction (changed)
  button: Shell command (changed)
  button: Node file (changed)
list: test-driven-development | testing-library-patterns | test-fixtures (new) (3)
text: Runs before Execute the tasks (changed) (4)
row:
  field: Keep open to add another (new) (5)
  button: Cancel
  button: Add (changed)
```
1: **Named by the place.** The title says where the hook lands, so nothing above it repeats the place.
2: **Focused on open.** Typing filters; arrows move; Enter adds.
3: **Source under each.** From the catalog, with a quiet note on a skill that cannot be called; an unknown typed name reads "not installed".
4: **Still changeable.** The two menus that chose the side and the anchor stay, as a quiet sentence.
5: **Stay for another.** Add keeps the modal open and says "Added <name>".

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: no provider code touched. |
| II. Spec-Driven Workflow | PASS: run through the Companion pipeline. |
| III. Visual and Interactive | PASS: the change is the visual interaction itself. |
| IV. Modular Architecture | PASS: one new component, shared types stay in one place. |
