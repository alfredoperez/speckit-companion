# Data Model: Inline Comment Composer Card

**Feature**: 097-inline-comment-composer
**Date**: 2026-05-21

This feature introduces **no new data entities and no schema changes**. It
is a visual restructure of an existing component. The model below documents
the existing types the composer consumes so the restructure stays
behavior-preserving (FR-007/FR-008/FR-009).

## Existing types (unchanged)

### `EditorMode`
`'line' | 'row'` — selects the line composer vs the acceptance-scenario
row composer. Both must render as a cohesive card (FR-006).

### `InlineEditorProps`
Props of `InlineEditor` (`webview/src/spec-viewer/components/InlineEditor.tsx`).
The restructure keeps every field and callback identical:

| Field | Type | Role | Changed? |
|-------|------|------|----------|
| `mode` | `EditorMode` | line vs row | no |
| `lineNum` | `number` | anchor line / scenario number | no |
| `lineType` | `LineType` | drives secondary action set | no |
| `scenarioContent` | `string?` | row-mode header context text | no (now shown in card header) |
| `onSubmit` | `(comment: string) => void` | add comment | no |
| `onCancel` | `() => void` | close composer | no |
| `onContextAction` | `(action: string) => void` | secondary action | no |

### `LineType`
`'user-story' | 'acceptance' | 'task' | 'section' | 'paragraph'` — detected
by `detectLineType()` in `lineActions.ts`. Unchanged.

### `ContextAction`
`{ action: string; label: string }` — the secondary action(s) per line
type, from `getContextActions(lineType)`:

| LineType | Secondary actions (footer, left-aligned) |
|----------|------------------------------------------|
| `user-story` | Remove Story |
| `acceptance` | Remove Scenario |
| `task` | Toggle, Remove Task |
| `section` | Remove Section |
| `paragraph` | Remove Line |

The data and the `handleContextAction` outcomes (add removal refinement /
toggle checkbox) are unchanged — only where the buttons render moves.

### `Refinement` (persistence — unchanged)
Created by `addRefinement()` and batched by `submitAllRefinements()` into a
`submitRefinements` message; the extension appends to the per-doc scratchpad
(`<docType>-extra.md`). No change to shape or flow.

## View structure (presentation only — not persisted)

The card's regions are layout, not data. For reference:

```text
.inline-editor (single bordered card)
├── header   → line: target label ("line N" / type) ; row: scenario text
├── body     → existing <textarea>
└── footer   → [secondary actions ··· left]  [Cancel] [Add Comment ··· right]
```

## State transitions

None. The composer has no new state. Open/close, submit, cancel, and
context-action flows are identical to today; the lifecycle gate (disabled
when spec is completed/archived) is unchanged.
