# Research: Task-Line Rendering Polish

**Feature**: 112-task-line-rendering-polish  
**Phase**: 0 — Root-cause analysis  
**Date**: 2026-05-27

## Issue A — Trailing Break After Wrapping Task Descriptions

### Root Cause

**Decision**: The trailing gap is caused by an always-present empty `<div class="line-comment-slot">` inside the `li.task-item` flex container.

**Rationale**: `li.task-item` is styled with `display: flex; flex-wrap: wrap; align-items: flex-start`. The `.line-comment-slot` carries `flex-basis: 100%`, which forces it onto its own flex row:

```
Row 1: [checkbox] [task-text — first line…]
Row 2:            […continuation of task text]   ← only on wrapping tasks
Row 3: [line-comment-slot (empty)]               ← always present, full-width
```

On **single-line** tasks, the flex container is tall enough for one row of text. Row 3 (the slot) folds under row 1 at zero visual height because there is no wrapping to create additional height. On **wrapping** tasks, the container is taller, and the empty slot row 3 adds a visible extra line at the bottom because the flex algorithm allocates it a line-height-worth of space.

**Evidence**: `_tasks.css` confirms the structure:
```css
#markdown-content li.task-item {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

#markdown-content li.task-item .line-comment-slot {
  flex-basis: 100%;
  margin-left: calc(16px + var(--space-2));
}
```

And `renderer.ts` always emits the slot, even when empty:
```typescript
html += `<li ...>` +
    `<button class="line-add-btn" ...>...</button>` +
    `<input type="checkbox" ...>` +
    `<span class="task-text line-content">${innerText}</span>` +
    `<div class="line-comment-slot"></div>` +   // ← always present
    `</li>\n`;
```

**Alternatives Considered**:
- **Emit slot only when a comment exists** — requires runtime JS to insert/remove the slot node when a comment is added/removed. More complex and could cause layout jank on comment creation. Rejected in favor of CSS-only fix.
- **Set `height: 0; overflow: hidden` unconditionally** — would require JS to set `height: auto` when comment is present. Same complexity issue.
- **CSS `:empty` selector** — `div.line-comment-slot:empty { display: none; }` collapses the slot to zero size when it has no children. Pure CSS, no JS changes, no impact on populated slots. **Chosen approach.**

### Fix

Add to `_tasks.css`:
```css
#markdown-content li.task-item .line-comment-slot:empty {
  display: none;
}
```

Caution: CSS `:empty` matches elements with no children AND no whitespace text nodes. The renderer emits `<div class="line-comment-slot"></div>` (no whitespace), so `:empty` matches correctly. If the JS that populates the slot appends a child element (not a text node), the slot will no longer match `:empty` and will display — correct behavior.

---

## Issue B — Hover Content Shift

### Root Cause

**Decision**: The hover rule overwrites `padding-right: 24px` with the shorthand `padding: var(--space-1) var(--space-2)`, collapsing right padding from 24 px to 8 px and causing text reflow.

**Rationale**: `li.task-item` idle state uses split padding declarations:
```css
padding: var(--space-1) 0;     /* top/bottom */
padding-right: 24px;           /* right: reserved for absolute + button */
```

The hover rule uses a four-side shorthand:
```css
#markdown-content li.task-item:hover {
  background: var(--bg-hover);
  margin: 0 calc(-1 * var(--space-2));
  padding: var(--space-1) var(--space-2);  /* ← shorthand: sets ALL four sides */
  border-radius: var(--radius-sm);
}
```

CSS specificity and cascade order: the shorthand `padding: var(--space-1) var(--space-2)` sets `padding-right` to `var(--space-2)` (8 px), which overrides the idle `padding-right: 24px`. The 16 px reduction in right padding narrows the task text's flex column and reflowing any multi-line task text.

The negative-margin / positive-padding pattern (`margin: 0 -8px; padding: 4px 8px`) is a standard trick to extend the hover background to the container edges without affecting content width. It works correctly for top/bottom/left but fails because it clobbers the custom right padding.

**Evidence from `_tasks.css`**:
```css
/* idle */
#markdown-content li.task-item {
  padding: var(--space-1) 0;
  padding-right: 24px;
}

/* hover — overwrites padding-right */
#markdown-content li.task-item:hover {
  margin: 0 calc(-1 * var(--space-2));
  padding: var(--space-1) var(--space-2);   /* clobbers 24px */
}
```

**Alternatives Considered**:
- **Absolutely position button with `left: auto; right: -8px`** — offsets the button outside the padding box so no reserved space is needed. Complex; the button would clip outside the list container. Rejected.
- **Use `padding-left` only in hover rule and keep `padding-right` separate** — verbose but correct. Chosen as the simplest targeted fix.
- **Inline `padding-right` inside the hover rule** — same as above; add explicit `padding-right: 24px` to the hover rule so the shorthand doesn't win.

### Fix

Update the `:hover` rule in `_tasks.css` to preserve right padding:
```css
#markdown-content li.task-item:hover {
  background: var(--bg-hover);
  margin: 0 calc(-1 * var(--space-2));
  padding: var(--space-1) var(--space-2);
  padding-right: 24px;           /* ← preserve button slot */
  border-radius: var(--radius-sm);
}
```

The `padding-right: 24px` declaration after the shorthand overrides only the right side.

---

## Issue C — Storybook Coverage

### Decision

Add a new `TaskLine.stories.tsx` file in `webview/src/spec-viewer/components/`. The existing `InlineComment.stories.tsx` demonstrates the exact decorator pattern needed: `DocumentContextDecorator` injects CSS variable overrides, and stories render raw HTML structures with inline styles matching the CSS class rules.

### Story Set

| Story name | What it exercises |
|------------|-------------------|
| `TaskLineSingleLineIdle` | Single-line task, no comment, idle state |
| `TaskLineSingleLineHover` | Single-line task, hover state (via CSS class `.hovered` or `:hover` story) |
| `TaskLineWrappingIdle` | Long multi-code-span task that wraps, idle state — verifies no trailing gap |
| `TaskLineWrappingHover` | Wrapping task in hover — verifies no content shift |
| `ParagraphLineBaseline` | Uncommented paragraph as baseline for gap comparison |

The hover stories will use a wrapper class or a Storybook `play` function to trigger hover state so visual comparison is possible without mouse interaction.

### Pattern

Following `InlineComment.stories.tsx` exactly:
- `DocumentContextDecorator` for CSS variables
- Raw JSX rendering the `li.task-item.line` structure
- Import and use existing CSS partials (they're bundled via Storybook's webpack config)

---

## Spec 110 Regression Check

Spec 110 fixed height-parity between commented and uncommented lines. That fix is in:
- `_tasks.css`: `.line-comment-slot { flex-basis: 100%; margin-left: ... }` — ensures comment card is indented
- `InlineComment.stories.tsx`: `TaskLineWithComment` / `TaskLineWithoutComment` parity stories

The Issue A fix (`:empty { display: none }`) collapses the slot only when no comment exists — when a comment is present, the slot is populated and `:empty` does not match, preserving all spec 110 behavior. No regression risk.

The Issue B fix (explicit `padding-right: 24px` in hover) does not touch comment rendering at all. No regression risk.
