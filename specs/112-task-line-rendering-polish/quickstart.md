# Quickstart: Task-Line Rendering Polish

**Feature**: 112-task-line-rendering-polish  
**Phase**: 1 — Developer setup & test steps  
**Date**: 2026-05-27

## Prerequisites

- Node.js v22+
- VS Code with the extension's dev dependencies installed (`npm install`)
- Storybook available via `npm run storybook` (check `package.json` for exact script)

## Verify the Bugs (Before Fixing)

### Issue A — Trailing break on wrapping tasks

1. Open VS Code in this repo.
2. Press `F5` to launch the Extension Development Host.
3. Open any spec with a task whose description is long enough to wrap (e.g. `specs/_02_demo-tasked/tasks.md` or `specs/111-history-entry-kind/tasks.md`).
4. Look at the gap below a wrapping task vs. a single-line task — the wrapping one has a visibly larger bottom gap.

### Issue B — Hover content shift

1. In the Extension Development Host spec viewer, hover over any task line.
2. Observe the text shifting slightly left/right as the row background appears.

## Fix Implementation

### Step 1 — Collapse empty `.line-comment-slot` (Issue A)

In `webview/styles/spec-viewer/_tasks.css`, add after the existing `.line-comment-slot` rule:

```css
#markdown-content li.task-item .line-comment-slot:empty {
  display: none;
}
```

### Step 2 — Preserve right padding on hover (Issue B)

In `webview/styles/spec-viewer/_tasks.css`, update the `:hover` rule:

```css
/* Before */
#markdown-content li.task-item:hover {
  background: var(--bg-hover);
  margin: 0 calc(-1 * var(--space-2));
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

/* After */
#markdown-content li.task-item:hover {
  background: var(--bg-hover);
  margin: 0 calc(-1 * var(--space-2));
  padding: var(--space-1) var(--space-2);
  padding-right: 24px;    /* preserve + button slot */
  border-radius: var(--radius-sm);
}
```

### Step 3 — Add Storybook stories (Issue C)

Create `webview/src/spec-viewer/components/TaskLine.stories.tsx` with stories:
- `TaskLineSingleLineIdle`
- `TaskLineSingleLineHover` (use `class="hovered"` + CSS override or Storybook `play`)
- `TaskLineWrappingIdle`
- `TaskLineWrappingHover`
- `ParagraphLineBaseline`

See `InlineComment.stories.tsx` for the `DocumentContextDecorator` pattern.

## Verify the Fixes

### Manual — Extension Development Host

1. Run `npm run compile` (or `npm run watch` for live recompile).
2. Press `F5` to reload the Extension Development Host.
3. Open a spec with wrapping task descriptions.
4. **Issue A check**: The gap below a wrapping task should equal the gap below a single-line task.
5. **Issue B check**: Hover over any task row — no content shift or text reflow visible.
6. **Regression check (spec 110)**: A task row with an inline comment should still show the comment card indented under the task text with correct height parity.

### Storybook

```bash
npm run storybook
```

Open the `Viewer/TaskLine` story group. All five stories should render without visible trailing gaps or content shift. The `Hover` variants should show the hover background without the text shifting.

## Key Files

| File | Change |
|------|--------|
| `webview/styles/spec-viewer/_tasks.css` | Add `:empty` rule; add `padding-right` to `:hover` |
| `webview/src/spec-viewer/components/TaskLine.stories.tsx` | New file — 5 stories |
| `webview/styles/spec-viewer/_line-actions.css` | No change (`.line-add-btn` is already `position: absolute`) |
