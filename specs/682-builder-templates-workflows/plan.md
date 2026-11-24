# Implementation Plan: Templates and saved workflows in the Workflow Builder

**Spec**: [spec.md](./spec.md)

## Summary

The template editor moves from a side pane opened by a step-header chip to a modal opened from the node that writes the document. The node popover gains one "Document" row; the new `DocumentModal` lists the template's sections, opens one to pick a fragment or restore the shipped section, stages picks until Done and draws an outline of the resulting document from headings and fragment summaries, since the host renders no text. The header's workflow menu gains Shipped / This project / Saved groups and a "Selected, not built" line, and "New workflow…" opens a small `NewWorkflowModal` instead of a side pane. No protocol or host change: every write is the existing `setTemplateSection`, `selectWorkflow` and `newWorkflow` message.

## Project Structure

```text
apps/vscode/webview/src/pipeline-builder/
  DocumentModal.tsx        new: sections list, fragment picker, outline, tabs when narrow
  NewWorkflowModal.tsx     new: replaces NewWorkflowForm (AttachForm.tsx keeps Attachment, boundaryOf)
  WorkflowMenu.tsx         new: the header's grouped workflow dropdown
  useModal.ts              new: focus trap, Escape, focus return shared by the two modals
  documentNode.ts          new: which node writes a step's template file
  NodePopover.tsx          Document row
  Header.tsx               WorkflowMenu, Selected-not-built line
  Canvas.tsx               Document shape chip removed
  index.tsx                wiring; template and new-workflow side panes removed
  TemplateForm.tsx         deleted
  __stories__/, __tests__/ updated
apps/vscode/webview/styles/pipeline-builder.css
```

**Structure Decision**: new pieces are small sibling components in the builder folder, matching `HookModal` and `BuildBar`.

## Screens

```screen document Document: plan.md
title: Document: plan.md (new) (1)
row:
  list: Summary | Technical Context | Constitution Check (2)
  text: Preview outline (new) (3)
text: Write a section as a placeholder
row:
  button: Cancel (new)
  button: Done (new) (4)
```
1: **Opened from the node.** The popover row of the node that writes plan.md opens it.
2: **A section opens in place.** It lists fragments and Restore shipped.
3: **Outline, not text.** Headings with what each will hold, built from fragment summaries.
4: **Done writes.** One section write per changed pick; Cancel writes nothing.

```screen header Workflow header
row:
  button: skill-only (changed) (1)
  chip: Selected, not built (new) (2)
list: Shipped | This project | Saved | New workflow… (changed)
```
1: **Grouped menu.** Shipped, This project, a Saved group, then New workflow.
2: **Honest state.** Shown after a switch from this panel until the build is current.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: writes go through the existing configuration messages. |
| II. Spec-Driven Workflow | PASS: no change to the spec pipeline. |
| III. Visual and Interactive | PASS: the template moves next to the node it shapes; both modals are keyboard-complete. |
| IV. Modular Architecture | PASS: each new piece is its own small module; no host import in the webview. |
