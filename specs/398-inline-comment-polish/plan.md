# Implementation Plan: Inline comments that annotate, not interrupt

**Branch**: `398-inline-comment-polish` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification at `specs/398-inline-comment-polish/spec.md`

## Summary

Saved review comments already persist, restore, and dispatch correctly; only their presentation is wrong. This plan restyles the existing `InlineComment` component into a collapsed, quiet annotation and gives it a disclosure interaction, without changing the data path that stores comments in `.spec-context.json`. The one non-cosmetic addition is an in-place text edit: a new `editComment` message alongside the existing `addComment` / `removeComment`, backed by a pure `editComment(ctx, id, text)` helper next to the ones already in `reviewComments.ts`. Nothing about `addComment`, `removeComment`, `runDocRefinement`, or the restore path changes shape — restore simply stops filtering applied comments out.

The annotation borrows the viewer's existing quiet-surface vocabulary — the one already used for inline code spans and `.file-ref` chips: `color-mix(in srgb, var(--text-muted) 12%, transparent)` background, no border, readable text in `--text-body`, and accent colour only on hover and focus. This is a deliberate reuse rather than a new visual language, because it is the same over-shouting problem the viewer just solved for those two elements.

## Project Structure

```
src/features/spec-viewer/
├── reviewComments.ts          # + editComment(ctx, id, text) pure helper
├── messageHandlers.ts         # + editComment message → persistCommentMutation
└── __tests__/messageHandlers.test.ts

src/core/types/
├── specContext.ts             # (unchanged — ReviewComment shape is already right)
└── spec-context.schema.json   # (unchanged)

webview/src/spec-viewer/
├── types.ts                   # + editComment in ViewerToExtensionMessage; Refinement gains status
├── components/
│   ├── InlineComment.tsx      # collapsed annotation + disclosure + action row
│   ├── InlineComment.stories.tsx
│   ├── InlineEditor.tsx       # + initialValue / submitLabel (edit reuses the composer)
│   ├── InlineEditor.stories.tsx
│   ├── cards/CommentsCard.tsx # status chip vocabulary shared with the annotation
│   └── __tests__/InlineComment.test.tsx   # new: state, disclosure, XSS
├── editor/
│   ├── refinements.ts         # mount applied comments too; edit flow; pending-only Refine count
│   ├── restoreComments.ts     # restore applied as well as pending
│   └── inlineEditor.ts        # showInlineEditorForEdit; keyboard add path
└── styles/spec-viewer/
    ├── _refinements.css       # the annotation
    ├── _line-actions.css      # + :focus-visible reveal of the add button
    └── _activity.css          # Review-comments card chip
```

**Structure Decision**: Every file above already exists and already owns this behavior. The change is confined to those modules; no new module, no new message except `editComment`, no relocation.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS — no provider or configuration surface is touched. |
| II. Spec-Driven Workflow | PASS — the pipeline and lifecycle are untouched; comments remain a viewer affordance gated on non-terminal specs. |
| III. Visual and Interactive | PASS — this is squarely a visual/interactive improvement to a GUI surface. |
| IV. Modular Architecture for Complex Features | PASS — the existing component/editor/CSS split is preserved and reused; no module grows past its remit, and the CSS stays in its partial. |

No violations; no Complexity Tracking needed.

## Phase 0 — Research

See [research.md](./research.md). Four decisions were open: where the comment body lives, how edit persists, whether applied comments show inline, and where Refine surfaces. All four are settled there.

## Phase 1 — Design

- [data-model.md](./data-model.md) — the `ReviewComment` record (unchanged on disk) and the webview-side `Refinement` it projects into (gains `status`).
- [contracts/ui-contract.md](./contracts/ui-contract.md) — the class names, ARIA contract, and message shapes the tests and stories code against, including the identifiers the spec pinned verbatim.
