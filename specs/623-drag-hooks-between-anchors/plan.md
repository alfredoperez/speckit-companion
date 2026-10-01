# Implementation Plan: Drag a hook between anchors

**Branch**: `feat/665-drag-actions-between-hooks` | **Date**: 2026-10-01 | **Spec**: [drag-hooks-between-anchors.spec.md](./drag-hooks-between-anchors.spec.md)

## Summary

A project hook moves by dragging its row on the board, or from the keyboard through the hook form, and every move is one atomic write. The config writer gains `move_hook`: it lifts the entry's lines verbatim from their old address and inserts them at a new side, anchor and index, refusing a target the step does not have or one that resolves to another boundary. The extension sends it through one new `moveHook` message, which replaces today's remove-then-add pair behind the form's placement fields. On the board, project hook rows become drag sources; rows, node cards (by half), seams and hook blocks become drop targets; extension and parked rows refuse a drag with their reason; a drop in another lane is refused before any write. The form gains an Order row with Move up and Move down and a live region fed by the same outcome-only announcement the inspector uses.

## Project Structure

```text
apps/speckit-extension/scripts/config_write.py        move_hook + --move-from/--to-index/--boundary
apps/speckit-extension/tests/test_builder_flow.py     move round-trips, refusals, verbatim text
apps/vscode/src/protocol/pipeline.ts                  moveHook message; addHook loses movedFrom
apps/vscode/src/features/specs/pipelineGraph.ts       moveHook() writer helper
apps/vscode/src/features/pipeline-builder/builderPanel.ts   moveHook handler
apps/vscode/webview/src/pipeline-builder/hookMoves.ts  drag payload + index arithmetic (pure)
apps/vscode/webview/src/pipeline-builder/Canvas.tsx    drag sources, drop targets, refusals
apps/vscode/webview/src/pipeline-builder/AttachForm.tsx Order row, live region, moveHook on placement change
apps/vscode/webview/src/pipeline-builder/index.tsx     wiring, sendMove, optimistic index + revert
apps/vscode/webview/styles/pipeline-builder.css       grip, over and refused states
apps/vscode/webview/src/pipeline-builder/__tests__/   HookDrag.test.tsx, AttachForm/wiring updates
apps/vscode/tests/unit/pipeline-builder/              builderPanel + pipelineGraph specs
apps/vscode/webview/src/pipeline-builder/__stories__/ new Guide/Components/Interactions stories
capabilities/pipeline-builder/attach-a-hook.spec.md   requirement for moving a hook
apps/website/src/content/docs/docs/guides/pipeline-builder.mdx, CHANGELOG.md, apps/speckit-extension/CHANGELOG.md
```

**Structure Decision**: the writer owns the move and its refusals; the webview only computes the requested address and refuses what it can see without the file (another lane, a read-only row).

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. The configuration stays the source of truth; the move edits only the entry's lines. |
| II. Spec-Driven Workflow | PASS. Spec, plan and tasks precede the code; the living spec is updated. |
| III. Visual and Interactive | PASS. The feature is a direct-manipulation gesture with a keyboard path. |
| IV. Modular Architecture | PASS. Pure move arithmetic sits in its own module beside `moves.ts`. |

Re-checked after design: no violations.
