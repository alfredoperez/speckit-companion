# Spec: Tasks checkbox alignment in the rendered Tasks list

## Overview

In the spec viewer's rendered tasks, each task's round checkbox sits visibly higher than the optical center of its label, so checkboxes do not line up with their text. This change centers the checkbox on the first line of its label so the box and text read as one row across every task, including labels that wrap to multiple lines.

## Functional Requirements

- **FR-001** The task checkbox MUST appear vertically centered on the first line of its label text across all task rows.
- **FR-002** The alignment MUST hold across editor font sizes (the checkbox offset MUST track the label's line box, not a fixed pixel value).
- **FR-003** For a label that wraps onto multiple lines, the checkbox MUST stay anchored to the first line (top-aligned to the first line box), not the vertical center of the whole block.
- **FR-004** The existing inline-comment hover affordance (the per-line "+" button and comment slot) MUST continue to work unchanged, and the wrapped comment slot MUST stay aligned under the label.
- **FR-005** Completed (checked) and in-progress task rows MUST keep the same checkbox-to-label alignment as idle rows.

## Success Criteria

- **SC-001** In all task rows, the checkbox's vertical center is within ~1px of the first text line's optical center at the default editor font size (pass/fail by visual inspection / story baseline).
- **SC-002** Increasing the editor font size keeps the checkbox centered on the first line — no fixed-pixel drift.
- **SC-003** A wrapping multi-line task keeps its checkbox on the first line, and its comment slot aligned under the label.
- **SC-004** No regression to the inline-comment hover UX (the "+" button and comment card still appear and function).

## Assumptions

- The fix lives in the task-item CSS for the rendered markdown (`webview/styles/spec-viewer/_tasks.css`); the rendered HTML structure (flex row: checkbox + `.task-text`) stays the same.
- The label line-height used for centering is the `.task-text` line-height (`1.4`), so the centering offset is derived from `1.4em` and the 16px checkbox.
- Sibling Storybook files that mirror this markup are updated to reflect the corrected alignment.

## Approach

- Edit `webview/styles/spec-viewer/_tasks.css`, rule `#markdown-content li.task-item input[type="checkbox"]`: replace the fixed `margin: 2px 0 0 0` with a line-height-relative top offset `margin: calc((1.4em - 16px) / 2) 0 0 0` so the 16px checkbox centers on the first `1.4em` text line regardless of font size. Keep `align-items: flex-start` on the row so wrapping labels stay first-line-anchored (FR-003).
- Update `webview/src/spec-viewer/components/TaskLine.stories.tsx` — the inline checkbox style mirroring the CSS — to use the same line-height-relative margin so the story baseline matches the shipped alignment.
- Check `webview/src/spec-viewer/components/InlineComment.stories.tsx`; update its task-row checkbox style only if it carries a hardcoded margin that would now mis-mirror the CSS.
- Verify `npm run compile && npm test` pass.
