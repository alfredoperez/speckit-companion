# Research: Inline Comment Composer Card

**Feature**: 097-inline-comment-composer
**Date**: 2026-05-21

This is a visual restructure of an existing webview component. No new
technology is introduced, so research focuses on (a) the current
implementation's shape, (b) the GitHub layout we're matching, and (c)
how to relocate controls without breaking any behavior.

## Decision 1: Restructure in-place in `InlineEditor.tsx`, do not rebuild

- **Decision**: Modify the existing `InlineEditor` Preact component
  (`webview/src/spec-viewer/components/InlineEditor.tsx`) and its styles
  (`webview/styles/spec-viewer/_editor.css`). Keep the same props,
  callbacks, mounting code (`editor/inlineEditor.ts`), action data
  (`editor/lineActions.ts`), and persistence path.
- **Rationale**: The request is purely a layout fix ("the top button
  looks weird"). The component already unifies line-mode and row-mode
  and already wires submit/cancel/context-action callbacks. A rebuild
  would risk regressing the keyboard shortcuts, auto-focus, anchoring,
  and scratchpad persistence that FR-007/FR-008 require to stay intact.
  Project memory also says: keep the existing line-hover "+" /
  comment-card / dialog system — layer onto it, don't delete it.
- **Alternatives considered**:
  - *New `CommentCard` component*: more code, more surface for
    regression, no user-visible benefit over editing in place.
  - *CSS-only fix*: rejected. The floating button is a separate DOM
    block (`.editor-actions`) rendered before the textarea card; making
    it read as "inside" the card requires moving it in the markup, not
    just restyling.

## Decision 2: Card anatomy — header / body / footer

- **Decision**: The composer becomes one bordered card with three
  stacked regions:
  1. **Header**: context of what's being commented on. Row mode shows
     the scenario text (today's `.editor-context`). Line mode shows a
     short target label (e.g. "Commenting on line N" / the line type).
  2. **Body**: the existing textarea.
  3. **Footer**: a single row. Secondary line action(s) (Remove*/Toggle)
     left-aligned; primary actions (Cancel, Add Comment) right-aligned.
- **Rationale**: This matches the GitHub review-comment card mental model
  (SC-002) and satisfies FR-001 (single bordered card), FR-003/FR-004
  (secondary actions inside, primary right-aligned), and FR-005 (header
  shows target). A left/right split in one flex footer keeps everything
  on one line and contained (edge case: task has Toggle + Remove Task —
  both fit on the left).
- **Alternatives considered**:
  - *Actions in the header row*: spec allows header OR footer. Footer
    keeps secondary and primary actions visually grouped as "controls,"
    which reads more like GitHub and avoids a crowded header when the
    context text is long.
  - *Keep `.editor-actions` block but move it below the textarea*: still
    a separate block; cleaner to fold into the footer.

## Decision 3: The card border moves to the outer `.inline-editor`

- **Decision**: Apply the card border/radius/padding to the outer
  `.inline-editor` wrapper. Remove the inner `.editor-comment-area`
  border (or collapse it) so there is exactly one border. The textarea
  keeps its own input border (it's an input field, not a detached
  control — consistent with GitHub).
- **Rationale**: Today `.inline-editor` is transparent/borderless and the
  border lives on the inner `.editor-comment-area`, which is why the
  `.editor-actions` button sits visually *outside* the bordered area.
  Moving the border out makes the header, textarea, and footer all live
  inside one boundary (FR-001, SC-001).
- **Alternatives considered**: keeping the border on the inner area and
  pulling the actions inside it — works too, but moving the border to the
  wrapper is the cleaner expression of "everything is one card,"
  especially for row mode where the card lives inside a `<td>`.

## Decision 4: Row mode keeps the `<tr>/<td>` wrapper; card lives in the cell

- **Decision**: Row mode (`mode === 'row'`) still returns
  `<tr class="inline-editor-row"><td colSpan={4}>…</td></tr>`; the card
  markup inside the cell uses the same header/body/footer structure, with
  no secondary action (acceptance-scenario row has none) and the scenario
  text as the header.
- **Rationale**: FR-006 requires both modes to be cohesive cards. The
  table structure must be preserved so the editor row aligns under the
  scenario row. Only the inner card layout changes.
- **Alternatives considered**: unifying line/row into one return shape —
  out of scope and risks table layout regressions.

## Decision 5: Behavior is untouched; only markup + CSS change

- **Decision**: Do not change `lineActions.ts` action data/handlers,
  `inlineEditor.ts` mounting/anchoring, `refinements.ts`
  add/submit/persist logic, the keyboard handlers, auto-focus, or
  empty-submit-cancels. The `onContextAction`, `onSubmit`, `onCancel`
  props and their wiring stay identical; the buttons just render in a new
  location.
- **Rationale**: FR-007, FR-008, FR-009, SC-003 — visual restructure
  only, zero behavior change. Keeping the callbacks and data layer
  constant is the safest way to guarantee no regression.
- **Alternatives considered**: none — changing behavior is explicitly out
  of scope.

## Decision 6: Verification via Storybook + manual viewer check

- **Decision**: Update the two existing stories
  (`InlineEditor.stories.tsx` LineMode/RowMode) so the card renders in
  isolation, and add stories for the line types that have distinct
  action sets (task = Toggle + Remove Task; section; user-story). Verify
  the live composer in the spec viewer for each line type and the
  acceptance-scenario row.
- **Rationale**: Storybook is the established visual-review surface for
  these components (existing stories prove the convention). It lets us
  confirm the single-card layout and footer alignment per line type
  (US2 independent test) without spinning up a full spec. Manual viewer
  check covers anchoring + real behavior (SC-003).
- **Alternatives considered**: automated DOM/snapshot tests — overkill
  for a layout change; the value is visual and is better judged in
  Storybook and the live viewer.

## Open questions

None. All FRs map to concrete edits in `InlineEditor.tsx` and
`_editor.css`; no NEEDS CLARIFICATION remain.
