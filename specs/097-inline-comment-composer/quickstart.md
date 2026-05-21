# Quickstart: Inline Comment Composer Card

**Feature**: 097-inline-comment-composer
**Date**: 2026-05-21

How to build, view, and verify the restructured composer.

## Build / run

```bash
npm install            # if needed
npm run watch          # auto-compile webview + extension on change
# Press F5 in VS Code to launch the Extension Development Host
```

For isolated component review:

```bash
npm run storybook      # open the Viewer/InlineEditor stories
```

> Project note: VS Code won't pick up changes without a version bump for a
> packaged install. For dev, use the Extension Development Host (F5) /
> `/install-local`. Do **not** commit a version bump into the feature PR.

## Visual acceptance (US1 — single cohesive card)

1. Open a spec in the viewer (editable spec — not completed/archived).
2. Hover a plain paragraph line; click the "+".
3. Confirm: the composer is **one bordered card**. No button floats above
   or outside the border. Header, textarea, and footer are all inside the
   same boundary. *(SC-001: zero detached controls.)*

## Secondary action placement (US2 — actions inside the card)

For each line type, open the composer and confirm the secondary action(s)
render **inside the card footer**, left-aligned, never above the textarea:

| Line type | Expected footer secondary action(s) |
|-----------|-------------------------------------|
| Paragraph | Remove Line |
| Section heading | Remove Section |
| User story header | Remove Story |
| Task item | Toggle, Remove Task (both fit on one row) |
| Acceptance scenario (row) | none — header shows scenario only |

Then verify behavior is unchanged (SC-003 / FR-008):

- Click **Remove Line** → adds a "🗑️ Remove this line" refinement comment
  and closes the composer (same as before).
- On a task, click **Toggle** → the task checkbox flips; click
  **Remove Task** → adds a removal refinement.

## GitHub-style header + footer (US3)

1. On a line composer: confirm a **header** indicates the comment target,
   and **Cancel / Add Comment** are **right-aligned** in the footer.
2. On an acceptance-scenario row composer: confirm the **scenario context**
   shows in the header and primary actions are right-aligned. *(SC-005.)*

## Behavior regression checks (FR-007 / SC-003)

- Type a comment, press **Cmd/Ctrl+Enter** → submits and persists.
- Press **Escape** → composer closes (cancel).
- Click "+" → textarea is **auto-focused**.
- Submit with **empty** text → composer just closes (no comment added).
- Submit a real comment → it persists to the per-doc scratchpad
  (`<docType>-extra.md`) as before.
- Open on a **completed/archived** spec → composer remains
  disabled/unavailable.

## Edge cases (from spec)

- **Task (multi-action)**: Toggle + Remove Task both fit without breaking
  the single-card layout.
- **Long scenario text**: header wraps/truncates gracefully; footer
  controls stay inside the card.
- **Narrow viewer width**: card and right-aligned footer remain readable
  and contained.

## Done when

All three user stories pass their independent tests, every behavior in the
regression list works unchanged, and Storybook shows a single-card layout
for each line type and the row mode.
