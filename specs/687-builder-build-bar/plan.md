# Plan: the build bar

## Summary

Build leaves the header and moves into a new `BuildBar` component that floats at the bottom of the builder when the build is stale or never built, or when a build or preview just reported. The bar reads only data the panel already receives: the build state, the last `BuildReport` (with its `warnings`), the last write `PipelineStatus` (with its undo token) and each `PipelineHook.problem` on the graph. Review opens a list above the bar; it asks for a preview when none is fresh, so it can name the commands that would change. The header keeps the title, the workflow switcher, one overflow menu for its other actions, the existing notices, and a quiet "Built, up to date" line. No host change and no new message.

## Project Structure

```text
apps/vscode/webview/src/pipeline-builder/
  BuildBar.tsx            new: the bar, its review list and its states
  Header.tsx              shrinks: title, switcher, overflow menu, quiet line, notices
  StatusLine.tsx          unchanged; shown only when the bar is not up
  index.tsx               owns open/hidden state, wires bar actions to messages
  __tests__/BuildBar.test.tsx   new
  __tests__/HeaderChip.test.tsx updated for the smaller header
  __stories__/Components.stories.tsx  bar states added, header stories updated
apps/vscode/webview/styles/pipeline-builder.css  bar styles, header trimmed
```

Structure Decision: one new component beside the header; the panel shell keeps the state.

## States

```states The build bar
Hidden: Nothing waits; the header says Built, up to date. (start)
Waiting: The bar says what is not built. (proposed) shows bar
Reviewing: The list of changes is open above the bar. (proposed) shows review
Building: Build was pressed and is running. (proposed)
Built: A short confirmation, then it leaves. (proposed)
Failed: Warning state, nothing was written. (proposed)
Hidden -> Waiting: a write makes the build stale (proposed)
Waiting -> Reviewing: Review (proposed)
Reviewing -> Waiting: Hide (proposed)
Waiting -> Building: Build (proposed)
Reviewing -> Building: Build (proposed)
Building -> Built: report ok (proposed)
Building -> Failed: report not ok (proposed)
Built -> Hidden: after a few seconds (proposed)
Failed -> Building: Build again (proposed)
grid:
Hidden | Waiting | Reviewing | .
Built  | Building | Failed | .
```
note: a modal or bottom sheet hides the bar in any state; it returns when the sheet closes.

## Screens

```screen bar The bar
title: Workflow
row:
  text: Pipeline
  button: This project
  button: More (changed) (1)
text: Built, up to date (new) (2)
list: specify | plan | tasks | implement
row:
  text: 2 changed steps not built (new) (3)
  button: Review (new)
  button: Build (changed)
```
1: **One overflow menu.** Add step, Open companion.yml, Preview build and Spec Kit presets move here.
2: **Quiet line.** Only when nothing waits, so the state is never invisible.
3: **The bar.** Says the assistant still reads the old commands.

```screen review The review open
list: specify | plan | tasks | implement
text: Hook added before draft-spec · Undo (new) (1)
text: house-check: No skill named house-check · Edit hook · Remove hook (new) (2)
text: specify: 1 hook · Show (new)
text: Rewrites specify and implement (new) (3)
row:
  text: 2 changed steps not built (new)
  button: Hide (new)
  button: Build (changed)
```
1: **Last write.** Undo only when the host holds one.
2: **Problem.** The hook's own reason, with the fixes the host supports.
3: **Preview.** Named from a fresh preview, asked for when the review opens.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: no setting added; reads the existing config state. |
| II. Spec-Driven Workflow | PASS: build and preview still run the same commands. |
| III. Visual and Interactive | PASS: the build state is always visible, in the bar or the header line. |
| IV. Modular Architecture | PASS: one component, no host change, messages unchanged. |
