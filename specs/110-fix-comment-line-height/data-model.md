# Data Model: Fix Comment Line Height

**Feature**: 110-fix-comment-line-height
**Date**: 2026-05-27

This is a CSS layout fix and Storybook coverage addition. There are no new data
types, no new VS Code state, and no new TypeScript entities. This document
records the existing types and DOM structures that the fix touches, and how they
are unchanged.

---

## Existing DOM structures (unchanged)

### Regular paragraph / heading line

```html
<div class="line" data-line="N">
  <button class="line-add-btn" data-line="N" title="Add comment">…svg…</button>
  <div class="line-content">…rendered text…</div>
  <div class="line-comment-slot"></div>
  <!-- ← empty until a comment is added -->
</div>
```

- `line-add-btn` — `position: absolute; right: 0; top: 2px`. Not a layout participant.
- `line-content` — block child; determines the visual line height.
- `line-comment-slot` — block child; **currently contributes to `.line` height** even
  when empty due to block-formatting context. After fix: `:empty { display: none }`
  prevents any height contribution.

### Task item line

```html
<li class="task-item line [checked] [in-progress]" data-line="N">
  <button class="line-add-btn" …>…svg…</button>
  <!-- position: absolute -->
  <input type="checkbox" [checked] data-line="N" />
  <span class="task-text line-content">…task text…</span>
  <div class="line-comment-slot"></div>
  <!-- flex child, flex-basis: 100% -->
</li>
```

- Parent `li` — `display: flex; flex-wrap: wrap; gap: var(--space-2)`.
- `line-comment-slot` — flex child with `flex-basis: 100%` that wraps to its own
  row; has `margin-top: var(--space-1)` in current CSS. After fix: the
  `margin-top` is removed (margin comes from the comment card itself) and
  `:empty { display: none }` suppresses the empty-row contribution.

### Acceptance-scenario row (table) — unchanged, no issue

```html
<tr class="comment-row" data-ref-id="…">
  <td colspan="4" class="comment-cell">
    <div class="inline-comment">…</div>
  </td>
</tr>
```

Rendered as a sibling `<tr>` — already uses the "outside the line" pattern.
No change needed.

---

## Existing component types (unchanged)

### `InlineComment`

`webview/src/spec-viewer/components/InlineComment.tsx`

| Prop         | Type                      | Role                       |
| ------------ | ------------------------- | -------------------------- |
| `refinement` | `Refinement`              | Comment data to display    |
| `mode`       | `'line' \| 'row'`         | Determines wrapper element |
| `onDelete`   | `(refId: string) => void` | Delete handler             |

No change to props or rendering logic.

### `Refinement`

`webview/src/spec-viewer/types.ts`

| Field         | Type       | Role                            |
| ------------- | ---------- | ------------------------------- |
| `id`          | `string`   | Unique comment id               |
| `lineNum`     | `number`   | Source line number              |
| `lineContent` | `string`   | Text of the commented line      |
| `comment`     | `string`   | The comment body                |
| `lineType`    | `LineType` | Drives Storybook story variants |

No change.

---

## CSS changes (summary of deltas)

### `webview/styles/spec-viewer/_line-actions.css`

Add at the bottom of the `.line-comment-slot` rule block:

```css
/* Suppress empty slot so it contributes no height to the line container */
.line-comment-slot:empty {
  display: none;
}
```

### `webview/styles/spec-viewer/_tasks.css`

Remove `margin-top: var(--space-1)` from the task-item slot rule:

```css
/* BEFORE */
#markdown-content li.task-item .line-comment-slot {
    flex-basis: 100%;
    margin-left: calc(16px + var(--space-2));
    margin-top: var(--space-1);   ← REMOVE
}

/* AFTER */
#markdown-content li.task-item .line-comment-slot {
    flex-basis: 100%;
    margin-left: calc(16px + var(--space-2));
}
```

The `margin-top` breathing room between the task text and the comment card is
provided by `.inline-comment { margin: 8px 0 0 0 }` (already in `_refinements.css`).

---

## Storybook story additions

### File: `webview/src/spec-viewer/components/InlineComment.stories.tsx`

New stories added alongside existing `LineMode` and `RowMode`:

| Story name                    | What it renders                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `TaskLineWithComment`         | A simulated `li.task-item.line` with a rendered `InlineComment` inside its slot. Verifies no extra height on the task text row. |
| `TaskLineWithoutComment`      | A simulated `li.task-item.line` with an empty slot. Verifies the slot contributes no height when empty.                         |
| `ParagraphLineWithComment`    | A `.line` div with `line-content` (paragraph text) + `InlineComment` in the slot.                                               |
| `ParagraphLineWithoutComment` | A `.line` div with `line-content` and empty slot.                                                                               |

Each story uses a `DocumentContextDecorator` that:

- Wraps content in `#markdown-content` for CSS scoping
- Injects minimal VS Code CSS variable overrides so theme vars resolve in the browser
- Renders two instances side by side (with/without comment) to make height deltas immediately visible
