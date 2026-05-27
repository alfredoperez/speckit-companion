# Research: Fix Comment Line Height

**Feature**: 110-fix-comment-line-height
**Date**: 2026-05-27

This is a CSS layout fix for existing webview components. No new technology is
introduced. Research focuses on (a) locating the exact box-model mutations that
cause layout breakage, (b) confirming the minimal CSS/markup changes needed,
and (c) the Storybook coverage strategy.

---

## Decision 1: Root cause — `.line-comment-slot` is a block child inside `.line`, making the containing element grow when filled

- **Decision**: The layout breakage originates from the fact that
  `.line-comment-slot` is rendered as a **child div** of the `.line` wrapper
  (and of `li.task-item`). In a block-formatting context (regular `.line` div),
  the slot stacks below `.line-content`, making `.line` taller when a comment is
  present. In a flex-wrap context (`li.task-item`), the slot wraps to its own
  100%-wide flex row and adds `margin-top: var(--space-1)` plus the `gap`
  between flex rows — this applies _even when the slot is empty_, contributing a
  non-zero visual gap at the bottom of every task item.
- **Rationale**: Confirmed by reading:
  - `renderer.ts` `wrapWithLineActions`: places `.line-comment-slot` as the
    third child inside `<div class="line">`, after `.line-content`.
  - `renderer.ts` task-item branch: places `.line-comment-slot` as last child of
    `<li class="task-item line">`, a `display: flex; flex-wrap: wrap` element.
  - `_tasks.css`: `li.task-item .line-comment-slot` has `flex-basis: 100%;
    margin-top: var(--space-1)` — the margin applies regardless of whether the
    slot holds content.
  - `_line-actions.css`: regular `.line-comment-slot { margin-top: 0 }` — no
    extra margin on non-task lines, but the block-stacking still makes the
    `.line` div grow.
  - `_refinements.css`: `.inline-comment { margin: 8px 0 0 0 }` — adds an
    additional 8px top margin inside the slot, compounding with the slot's own
    `margin-top`.
- **Alternatives considered**:
  - *Move slot to a sibling outside `.line`*: would fully decouple comment
    height from line height, but requires a two-element wrapping group per line
    (a container div for `.line` + sibling `.line-comment-slot`), making the
    renderer much more complex and potentially breaking the `querySelector`
    anchoring in `inlineEditor.ts` and `refinements.ts`.
  - *Absolute-position the slot*: impossible without knowing the comment card
    height ahead of time; would cause comment cards to overlap content below.
  - *CSS `:empty` to suppress empty-slot contribution*: hides the empty slot's
    margin/gap impact via `.line-comment-slot:empty { display: none; }` — clean
    and minimal. Chosen approach for task items.

---

## Decision 2: Fix strategy — `:empty` suppression + comment-slot isolation

- **Decision**: Apply two targeted CSS changes:
  1. **Suppress empty slot contribution**:
     ```css
     .line-comment-slot:empty { display: none; }
     ```
     This eliminates the empty-slot margin-top and gap contribution on task
     items (and any other flex context). When a comment is rendered the slot
     becomes non-empty and `display` reverts to its default.
  2. **Separate the margin from the slot to the comment card inside it**:
     For task items, remove `margin-top: var(--space-1)` from
     `li.task-item .line-comment-slot` and instead ensure the visual breathing
     room comes from the comment card's own top margin (already set via
     `.inline-comment { margin: 8px 0 0 0 }`). This collapses the double-margin
     (slot `margin-top` + card `margin-top`) to a single card margin.
- **Rationale**: The fix is entirely CSS; no TypeScript or JSX changes needed.
  `:empty` is well-supported in all Chromium versions VS Code webviews use. The
  change is backward-compatible: lines without comments are visually identical
  before and after; lines with comments retain the comment card below the text
  with appropriate spacing.
- **Alternatives considered**:
  - *Remove `flex-wrap: wrap` and `gap` from task items*: would require
    redesigning how the slot rows are laid out — too broad, risks breaking the
    checkbox + text alignment.
  - *Change `gap` to `row-gap: 0` on task items*: removes all inter-row spacing
    even for the checkbox–to–text transition (no gap there, but safe), but still
    leaves `margin-top` on the slot. Partial fix only.

---

## Decision 3: Storybook stories — use a document-context decorator

- **Decision**: Add stories to the existing `InlineComment.stories.tsx` file
  rather than creating a new story file. Use a decorator that injects minimal
  VS Code theme CSS variables and a surrounding `#markdown-content` context so
  styles resolve correctly. Render a "before" (no comment) and "after" (with
  comment) side by side for task-line and paragraph-line variants.
- **Rationale**: `InlineComment.stories.tsx` already has `LineMode` and
  `RowMode` stories. Adding `TaskLineWithComment`, `TaskLineWithoutComment`,
  `ParagraphLineWithComment`, and `ParagraphLineWithoutComment` extends the
  existing file naturally and leverages the existing Storybook setup
  (`@storybook/preact`). A side-by-side layout in the story makes the height
  delta immediately visible during dev without needing to diffing screenshots.
- **Alternatives considered**:
  - *New `CommentLineHeight.stories.tsx` file*: more overhead, same result.
  - *Automated screenshot diffing*: outside scope per spec; Storybook visual
    review is sufficient per FR-006/FR-007.

---

## Decision 4: No markup changes to `renderer.ts` or component files

- **Decision**: The fix is CSS-only. `renderer.ts`, `refinements.ts`,
  `inlineEditor.ts`, `InlineComment.tsx`, and `InlineEditor.tsx` are unchanged.
- **Rationale**: The DOM structure (slot as child of line) is correct for the
  comment anchoring logic in `restoreComments.ts` / `refinements.ts` and for
  the inline editor's `lineElement.querySelector('.line-comment-slot')`. Keeping
  it avoids regression risk in the persistence / anchor flows covered by spec 107.

---

## Open questions (none)

All clarifications are resolved by codebase inspection.
