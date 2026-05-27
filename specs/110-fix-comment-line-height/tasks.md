# Tasks: Fix Comment Line Height

**Input**: Design documents from `/specs/110-fix-comment-line-height/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: No automated test tasks. Per research Decision 4, verification is via
Storybook (visual review) and a manual viewer pass — no TypeScript/JSX changes
are made, so snapshot or unit tests are not needed for this layout fix.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

All changed files are under `webview/`:

- CSS partials: `webview/styles/spec-viewer/`
- Storybook stories: `webview/src/spec-viewer/components/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the build and Storybook are green before touching anything.

- [x] T001 Run `npm run compile` from the repo root and confirm zero TypeScript errors; then run `npm run storybook` and confirm the existing **Viewer/InlineComment** stories (`LineMode`, `RowMode`) render without errors — this is the visual baseline

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The two CSS changes that fix the root-cause layout bug. Both US1 and
US2 depend on these tasks; US3 (Storybook) can be developed in parallel once the
CSS changes are in place to show the corrected state.

- [x] T002 In `webview/styles/spec-viewer/_line-actions.css`, append a new rule to the `.line-comment-slot` block: `.line-comment-slot:empty { display: none; }` — this suppresses the empty slot's height and gap contribution in all layout contexts (flex task items and block paragraph lines), fixing the phantom bottom-gap on every task line (research Decision 2; FR-001, FR-002)
- [x] T003 In `webview/styles/spec-viewer/_tasks.css`, remove the `margin-top: var(--space-1)` property from the `#markdown-content li.task-item .line-comment-slot` rule — the breathing room between the task text and a comment card is already provided by `.inline-comment { margin: 8px 0 0 0 }` in `_refinements.css`; removing the duplicate margin eliminates the double-stacking when a comment IS present (research Decision 2; FR-001, FR-004)

---

## Phase 3: User Story 1 — Attach Comment Without Layout Disruption (Priority: P1) 🎯 MVP

**Story goal**: After attaching a fresh inline comment to a line in the spec
viewer, the task-text row (or paragraph line) has the same visual height as
an uncommented line.

**Independent test criteria**: Open any `tasks.md` in the Extension Development
Host, attach a comment to a task line, and confirm the checkbox + text row height
is visually unchanged compared to adjacent uncommented task lines.

### Implementation for User Story 1

- [ ] T004 [US1] Rebuild the extension (`npm run compile`) after T002 and T003; open the Extension Development Host (F5), navigate to a spec's **Tasks** tab, hover a task line, click the comment button, submit a comment, and confirm: (1) the task-text row is the same height as adjacent uncommented task lines, (2) no extra vertical gap appears above the comment card, (3) the fix holds on all three document types (spec, plan, tasks) across task-checkbox, heading, and paragraph line types (FR-001, FR-004, FR-005)

---

## Phase 4: User Story 2 — Comment Chrome Does Not Affect Line Rhythm (Priority: P2)

**Story goal**: A document that already has saved inline comments (restored from
`.spec-context.json`) renders all commented lines at the same height as
uncommented lines when the spec viewer opens.

**Independent test criteria**: Load a spec with at least three pre-existing
comments on different line types (task, heading, paragraph). Confirm each
commented line matches the height of equivalent uncommented lines and the
comment card appears cleanly below without disrupting the text row.

### Implementation for User Story 2

- [ ] T005 [US2] Using a spec that has saved `reviewComments` in its `.spec-context.json` (or add a few comments via US1 testing and reload the document), open each of its document tabs (spec, plan, tasks) and verify that `restoreComments()` path produces the same neutral line heights as the freshly-attached case confirmed in T004 — the CSS fix in T002/T003 is global and applies to both paths, but this task explicitly validates the restore scenario (FR-005; data-model: `restoreComments` / `addRestoredRefinement`)

---

## Phase 5: User Story 3 — Visual Regression Coverage via Storybook (Priority: P3)

**Story goal**: Storybook has stories showing commented and uncommented task-line
and paragraph-line variants side by side so height parity is visually verifiable
without running the full extension.

**Independent test criteria**: Run `npm run storybook`, navigate to
**Viewer/InlineComment**, and confirm four new stories exist
(`TaskLineWithComment`, `TaskLineWithoutComment`, `ParagraphLineWithComment`,
`ParagraphLineWithoutComment`) and all four render without layout overflow or
visible height discrepancy between the commented and uncommented variants.

### Implementation for User Story 3

- [x] T006 [US3] In `webview/src/spec-viewer/components/InlineComment.stories.tsx`, add a `DocumentContextDecorator` that wraps story content in a `<div id="markdown-content">` and injects minimal VS Code CSS variable overrides (background, border, accent colours) so theme vars resolve in the browser Storybook environment; then add four stories using this decorator: `TaskLineWithComment` (a simulated `<ul><li class="task-item line">` with checkbox, task-text span, `line-comment-slot` containing an `<InlineComment>`), `TaskLineWithoutComment` (same structure, empty slot), `ParagraphLineWithComment` (a `<div class="line">` with `line-content` div and `<InlineComment>` in the slot), and `ParagraphLineWithoutComment` (same, empty slot) — render the commented and uncommented variants adjacently in each story so height delta is immediately visible (FR-006, FR-007; SC-002)

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T007 Run `npm run compile` and confirm zero TypeScript errors (no `.tsx` changes, but confirms the CSS is bundled correctly via webpack); open Storybook and do a full visual pass of all six `Viewer/InlineComment` stories (two existing + four new) confirming no layout overflow, no visible height difference between commented and uncommented variants, and the fix holds at narrow viewport widths (SC-001, SC-002, SC-003, SC-004)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. T002 and T003 are **[P]** with
  each other (different files). Both MUST complete before US1 and US2 can be
  verified.
- **US1 (Phase 3)**: Depends on T002 + T003.
- **US2 (Phase 4)**: Depends on T002 + T003; can run after or in parallel with US1
  (different verification scenario, same CSS).
- **US3 (Phase 5)**: Depends on T002 + T003 (stories should show the fixed state);
  T006 can be written in parallel with US1/US2 verification.
- **Polish (Phase 6)**: Depends on all user story phases complete.

### Within Each Phase

- T002 and T003 touch different files — safe to apply simultaneously.
- T006 is the only US3 task; no intra-phase sequencing needed.

---

## Parallel Example: CSS fixes (Phase 2)

```bash
# T002 and T003 touch different files — safe to apply in one commit:
Task: "T002 Add :empty rule to _line-actions.css"
Task: "T003 Remove margin-top from _tasks.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Confirm build + Storybook baseline (T001).
2. Phase 2: Apply both CSS fixes in parallel (T002 + T003). Minimal and reversible.
3. Phase 3: Rebuild and manually verify fix on task lines (T004).
4. **STOP and VALIDATE**: Open tasks.md in the Extension Development Host, attach
   a comment, confirm no height disruption — MVP delivered (SC-001, SC-004).
5. Demo if ready.

### Incremental Delivery

1. Setup → CSS fixes → US1 validation (MVP complete after T004).
2. US2 → restore-path validation (T005) — confirms existing comment data is also
   clean.
3. US3 → Storybook stories (T006) — regression safety net in place.
4. Polish → full compile + Storybook pass (T007).
