# Quickstart: Fix Comment Line Height

**Feature**: 110-fix-comment-line-height
**Date**: 2026-05-27

---

## Prerequisites

```bash
cd /path/to/speckit-companion
npm install          # if not already done
npm run watch        # or: npm run compile for a one-time build
```

To run Storybook:
```bash
npm run storybook    # starts the Storybook dev server
```

---

## Verify the bug (before fix)

1. Press **F5** in VS Code to launch the Extension Development Host.
2. Open a workspace that has a spec with a `tasks.md`.
3. Open the SpecKit sidebar and click on a spec → **Tasks** tab.
4. Hover over a task line and click the comment (`+`) button.
5. Type a comment and submit.

**Observed** (bug): The task line visibly grows taller. Adjacent task lines may
also appear shifted. The comment card appears, but the *text row* (checkbox +
task text) has excess vertical space around it.

---

## Apply the fix

### 1. `webview/styles/spec-viewer/_line-actions.css`

At the end of the `.line-comment-slot` rule block, add:

```css
/* Suppress empty slot so it contributes no height to the line container */
.line-comment-slot:empty {
    display: none;
}
```

### 2. `webview/styles/spec-viewer/_tasks.css`

Remove `margin-top: var(--space-1)` from the task-item comment slot override:

```diff
 #markdown-content li.task-item .line-comment-slot {
     flex-basis: 100%;
     margin-left: calc(16px + var(--space-2));
-    margin-top: var(--space-1);
 }
```

---

## Verify the fix

1. Rebuild (`npm run compile`) and reload the Extension Development Host.
2. Repeat the steps above.

**Expected after fix**:
- Task lines with NO comment: visually identical height to before the fix.
- Task lines WITH a comment: the checkbox + task-text row is the same height as
  an uncommented task line. The comment card appears below the row with 8px of
  breathing room (from `.inline-comment { margin: 8px 0 0 0 }`).
- Same result on spec and plan paragraph/heading lines.

---

## Add Storybook coverage

All four new stories live in:
```
webview/src/spec-viewer/components/InlineComment.stories.tsx
```

After running `npm run storybook`, navigate to **Viewer/InlineComment** and
confirm:
- **TaskLineWithComment** — task text row is same height as **TaskLineWithoutComment**.
- **ParagraphLineWithComment** — paragraph text row is same height as
  **ParagraphLineWithoutComment**.

---

## Files changed

| File | Change |
|------|--------|
| `webview/styles/spec-viewer/_line-actions.css` | Add `.line-comment-slot:empty { display: none }` |
| `webview/styles/spec-viewer/_tasks.css` | Remove `margin-top: var(--space-1)` from task-item slot |
| `webview/src/spec-viewer/components/InlineComment.stories.tsx` | Add 4 new stories |
