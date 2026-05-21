---
description: "Task list for Inline Comment Composer Card"
---

# Tasks: Inline Comment Composer Card

**Input**: Design documents from `/specs/097-inline-comment-composer/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: No automated test tasks. Per research Decision 6, verification is via
Storybook (visual review) and a manual viewer pass — automated DOM/snapshot
tests are explicitly out of scope for this layout change.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single-project VS Code extension with a bundled Preact webview. All changes
live under `webview/src/spec-viewer/` and `webview/styles/spec-viewer/`. No
extension-side (`src/`) changes (plan: Structure Decision).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the build/preview toolchain works before touching the composer.

- [X] T001 Run `npm install` (if needed) then `npm run watch` from repo root to confirm the webview + extension compile cleanly before changes (per quickstart.md "Build / run")
- [ ] T002 Launch `npm run storybook` and open `Viewer/InlineEditor` (LineMode, RowMode) to capture the current "floating button above textarea" baseline in `webview/src/spec-viewer/components/InlineEditor.stories.tsx` *(manual visual baseline — not run by AI)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The single structural change that every user story builds on — the card must become one bordered container before actions/header can be placed inside it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 In `webview/styles/spec-viewer/_editor.css`, move the card border/radius/padding/background from `.editor-comment-area` onto the outer `.inline-editor` wrapper (border, `var(--radius-md)`, padding, `var(--bg-*)`); collapse the inner `.editor-comment-area` border so exactly one card boundary remains (research Decision 3; FR-001, SC-001). Keep the `.editor-textarea` input border intact.

**Checkpoint**: The composer renders as a single bordered card (textarea inside one border). User story implementation can now begin.

---

## Phase 3: User Story 1 - Comment composer reads as one cohesive card (Priority: P1) 🎯 MVP

**Goal**: The composer is a single bordered card containing the input and actions — no control rendered outside the card border.

**Independent Test**: Open the composer on a plain paragraph line; confirm it is one bordered card with no detached button stacked above it (quickstart "Visual acceptance").

### Implementation for User Story 1

- [X] T004 [US1] In `webview/src/spec-viewer/components/InlineEditor.tsx`, restructure the `editorBody` JSX into a single `.inline-editor` card with three stacked regions — header, body (existing `<textarea>`), footer — so all markup is nested inside one wrapper (research Decision 2; FR-001, FR-006). Keep `mode`/`onSubmit`/`onCancel`/`onContextAction` wiring identical (data-model: props unchanged).
- [X] T005 [US1] In `webview/styles/spec-viewer/_editor.css`, style the new `.inline-editor` header / body / footer regions so the header, textarea, and footer sit flush within the single card boundary with no internal separator lines (FR-001; existing "no visual separators" rule preserved).
- [X] T006 [P] [US1] In `webview/src/spec-viewer/components/InlineEditor.stories.tsx`, update the `LineMode` story (paragraph) so it renders the single-card layout; visually confirm in Storybook that no control floats outside the border (SC-001).

**Checkpoint**: Paragraph-line composer is a single cohesive card — US1 independently testable.

---

## Phase 4: User Story 2 - Secondary line action lives inside the card (Priority: P2)

**Goal**: Each line type's secondary action(s) (Remove Line / Remove Story / Remove Section / Remove Scenario / Toggle + Remove Task) render inside the card footer, left-aligned, never above the textarea — and behave exactly as before.

**Independent Test**: Open the composer on each line type (paragraph, user story, section, acceptance scenario, task) and confirm each line type's action(s) render inside the card footer aligned with other controls; activate each and confirm the same outcome as before (quickstart "Secondary action placement").

### Implementation for User Story 2

- [X] T007 [US2] In `webview/src/spec-viewer/components/InlineEditor.tsx`, remove the standalone `.editor-actions` block rendered before the textarea and render the `getContextActions(lineType)` buttons inside the footer, left-aligned, keeping each button's `data-action`, `key`, and `onClick={() => onContextAction(action)}` exactly as today (FR-002, FR-003, FR-008; data-model: action data/handlers unchanged).
- [X] T008 [US2] In `webview/styles/spec-viewer/_editor.css`, make the footer a single flex row with secondary actions left-aligned and primary actions right-aligned (`justify-content: space-between` or a left/right group split); ensure the task case (Toggle + Remove Task) fits on one row without breaking the card (FR-003; edge case "multi-action task"). Preserve existing `.context-action` ghost/hover styling.
- [X] T009 [P] [US2] In `webview/src/spec-viewer/components/InlineEditor.stories.tsx`, add stories for the distinct action sets — `TaskMode` (Toggle + Remove Task), `SectionMode` (Remove Section), and `UserStoryMode` (Remove Story) — and verify in Storybook each renders its action(s) inside the footer (US2 independent test; research Decision 6).

**Checkpoint**: All line types show their secondary action(s) inside the card footer with unchanged behavior — US1 + US2 work independently.

---

## Phase 5: User Story 3 - Familiar GitHub-style header and footer layout (Priority: P3)

**Goal**: The card shows a header indicating the comment target, and the primary actions (Cancel, Add Comment) are right-aligned in the footer — for both line mode and acceptance-scenario row mode.

**Independent Test**: Open the composer on a line and on an acceptance-scenario row; confirm both show a context header and right-aligned primary actions (quickstart "GitHub-style header + footer").

### Implementation for User Story 3

- [X] T010 [US3] In `webview/src/spec-viewer/components/InlineEditor.tsx`, render the card header: line mode shows a short target label (e.g. "Commenting on line {lineNum}" / line type); row mode shows the existing scenario context (`Scenario {lineNum}:` + `scenarioContent`) folded into the header region instead of the separate `.editor-context` block (FR-005, FR-006; data-model: `scenarioContent` now shown in header).
- [X] T011 [US3] In `webview/styles/spec-viewer/_editor.css`, style the header (target/scenario label + text) so long context text wraps or truncates gracefully without pushing controls outside the card, and keep the footer primary actions (`.editor-buttons`) right-aligned (FR-004, FR-005; edge cases "long context text", "narrow viewer width").
- [X] T012 [US3] In `webview/src/spec-viewer/components/InlineEditor.tsx`, ensure row mode still returns `<tr class="inline-editor-row"><td colSpan={4} class="editor-cell">{card}</td></tr>` with the new header/body/footer card inside the cell and no secondary action (research Decision 4; FR-006).
- [X] T013 [P] [US3] In `webview/src/spec-viewer/components/InlineEditor.stories.tsx`, update the `RowMode` story so the scenario shows in the card header with right-aligned primary actions; confirm in Storybook (SC-005).

**Checkpoint**: Both line and row composers present a context header with right-aligned primary actions — all three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Behavior-regression verification and cleanup across all stories.

- [X] T014 Remove any now-dead CSS in `webview/styles/spec-viewer/_editor.css` left behind by the relocation (e.g. obsolete `.editor-actions` margin/`margin-bottom` rules, redundant `.editor-comment-area` border rules) without changing `.context-action`, `.editor-textarea`, `.editor-cancel`, `.editor-add` appearance.
- [ ] T015 Run the full behavior-regression checklist from quickstart.md in the Extension Development Host (F5): Cmd/Ctrl+Enter submits & persists to `<docType>-extra.md`, Escape cancels, "+" auto-focuses the textarea, empty submit just closes, and the composer stays disabled on a completed/archived spec (FR-007, SC-003). *(manual live-viewer pass — not run by AI)*
- [ ] T016 Verify each relocated secondary action in the live viewer produces its prior outcome: Remove Line/Story/Section/Scenario/Task each add the removal refinement comment, and Toggle flips the task checkbox (FR-008, SC-003). *(manual live-viewer pass — not run by AI)*
- [X] T017 Run `npm run compile` (and lint if configured) from repo root to confirm the webview builds with no TypeScript errors after the restructure.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup. T003 (single border on `.inline-editor`) BLOCKS all user stories — every story renders content inside this card.
- **User Stories (Phase 3–5)**: All depend on Phase 2. Because US1, US2, US3 all edit the same two files (`InlineEditor.tsx`, `_editor.css`), run them sequentially in priority order (P1 → P2 → P3) to avoid same-file conflicts; the `.stories.tsx` tasks (T006, T009, T013) are the parallel-safe exceptions.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 — no dependency on other stories. MVP.
- **US2 (P2)**: Builds on the US1 card structure (footer must exist) — implement after US1.
- **US3 (P3)**: Builds on the US1 card structure (header region) and shares the footer with US2 — implement after US2.

### Within Each User Story

- `.tsx` markup change before `_editor.css` styling that targets it.
- Storybook story update last (verifies the result) — and is `[P]` because it touches only `.stories.tsx`.

### Parallel Opportunities

- T001 and T002 (Setup) are sequential (watch then storybook), but independent of everything else.
- Within a story, the `[P]` Storybook task (T006 / T009 / T013) can be written in parallel with the next story's planning since it only touches `InlineEditor.stories.tsx`.
- T015 and T016 (Polish, live-viewer checks) can be done together in one Extension Development Host session.
- Cross-story parallelism is NOT available: US1/US2/US3 all edit `InlineEditor.tsx` and `_editor.css`.

---

## Parallel Example: Storybook stories (after their story's markup lands)

```bash
# These only touch InlineEditor.stories.tsx and can be batched once the
# corresponding markup (T004 / T007 / T010-T012) is in place:
Task: "T006 Update LineMode story for single-card layout"
Task: "T009 Add TaskMode / SectionMode / UserStoryMode stories"
Task: "T013 Update RowMode story for header + right-aligned actions"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (confirm build + capture baseline).
2. Phase 2: Foundational (T003 — single card border). CRITICAL, blocks all stories.
3. Phase 3: User Story 1 (one cohesive card on a paragraph line).
4. **STOP and VALIDATE**: Open the composer on a paragraph line — one bordered card, nothing floating (SC-001).
5. Demo if ready.

### Incremental Delivery

1. Setup + Foundational → single-card boundary exists.
2. US1 → cohesive card → validate → demo (MVP!).
3. US2 → secondary actions inside footer → validate per line type → demo.
4. US3 → header + right-aligned primary actions, row mode → validate → demo.
5. Polish → run full regression + behavior checks (SC-003) → compile.

### Notes

- [P] tasks = different file (`.stories.tsx`), no dependency on incomplete tasks.
- This is a visual restructure only (FR-009): keep all props, callbacks, action
  data (`lineActions.ts`), mounting (`inlineEditor.ts`), and persistence
  (`refinements.ts`) untouched — buttons only change location.
- Do NOT commit a version bump into the feature PR (quickstart project note).
- Commit after each story or logical group; stop at any checkpoint to validate.
