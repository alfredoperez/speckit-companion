# Tasks: Fix Bullet Point Rendering

**Input**: Design documents from `/specs/055-fix-bullet-rendering/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story. US1 and US2 share the same root cause (list fragmentation in renderer.ts) so US2 is naturally resolved alongside US1, but verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: No setup needed — this is a bug fix in an existing codebase. All infrastructure is already in place.

*(No tasks — skip to Foundational)*

---

## Phase 2: Foundational (List State Tracking)

**Purpose**: Add the state variables needed to track list context across code block interruptions. This unblocks both US1 and US2.

- [x] T001 Add `listItemCount`, `lastClosedListType`, and `lastClosedListCount` state variables to the render loop in `webview/src/spec-viewer/markdown/renderer.ts`
- [x] T002 Increment `listItemCount` each time an `<li>` is emitted inside an ordered list in `webview/src/spec-viewer/markdown/renderer.ts`
- [x] T003 Save `listItemCount` and `listType` into `lastClosedListType`/`lastClosedListCount` when a list is closed (code block fence, empty line, or non-list line) in `webview/src/spec-viewer/markdown/renderer.ts`
- [x] T004 Reset `lastClosedListType`/`lastClosedListCount` when a block-level element (heading, horizontal rule, blockquote) is encountered in `webview/src/spec-viewer/markdown/renderer.ts`

**Checkpoint**: State tracking is in place — list open/close now remembers context.

---

## Phase 3: User Story 1 - Ordered List Counter Continuity (Priority: P1) 🎯 MVP

**Goal**: Ordered lists display continuous numbering (1, 2, 3) even when code blocks appear between items.

**Independent Test**: Open a spec with a numbered list of 3+ items separated by fenced code blocks. Verify numbers increment continuously without resetting.

### Implementation for User Story 1

- [x] T005 [US1] When opening a new `<ol>`, check if `lastClosedListType === 'ol'` and use `<ol start="${lastClosedListCount + 1}">` to continue numbering in `webview/src/spec-viewer/markdown/renderer.ts`
- [x] T006 [US1] Handle the edge case where an empty line between ordered list items triggers list close — ensure the list reopens with the correct `start` attribute in `webview/src/spec-viewer/markdown/renderer.ts`
- [x] T007 [US1] Verify that `listItemCount` resets to 0 when a genuinely new list starts (after a heading, HR, or different block content) in `webview/src/spec-viewer/markdown/renderer.ts`

**Checkpoint**: Ordered lists maintain continuous numbering across code block interruptions.

---

## Phase 4: User Story 2 - Code Blocks Render Inside List Items (Priority: P1)

**Goal**: Fenced code blocks appearing between list items render with proper code formatting (monospace font, background, syntax highlighting).

**Independent Test**: Open a spec with a numbered list item followed by a fenced code block. Verify the code block renders with code styling, not as plain text.

### Implementation for User Story 2

- [x] T008 [US2] Ensure code blocks emitted while `inList` was recently true (between list close and next list open) render with the standard `<pre class="code-block">` markup in `webview/src/spec-viewer/markdown/renderer.ts`
- [x] T009 [US2] Verify that the code block rendering path (lines 138-162) is not being short-circuited or producing different HTML when preceded by a list item in `webview/src/spec-viewer/markdown/renderer.ts`

**Checkpoint**: Code blocks between list items render with full syntax highlighting and code formatting.

---

## Phase 5: User Story 3 - List Item Spacing Is Compact (Priority: P2)

**Goal**: List items have compact, consistent vertical spacing without excessive gaps.

**Independent Test**: Open a spec with a bullet list of 5+ items. Verify spacing is compact and consistent.

### Implementation for User Story 3

- [x] T010 [US3] Reduce bottom margin on consecutive `ol`/`ul` elements that are continuations (same list type, using `start` attribute) via CSS adjacent sibling selector in `webview/styles/spec-viewer/_typography.css`
- [x] T011 [US3] Verify that the reduced list fragmentation from US1/US2 fixes naturally eliminates most excessive spacing — adjust remaining margin/padding if needed in `webview/styles/spec-viewer/_typography.css`

**Checkpoint**: List spacing is compact and consistent across all list types.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T012 Manually test with existing specs that have complex lists (nested, mixed types, 10+ items) to verify no regressions in `webview/src/spec-viewer/markdown/renderer.ts`
- [x] T013 Update `docs/viewer-states.md` if any rendering behavior changes affect documented state
- [x] T014 Run `npm run compile && npm test` to verify no test regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately
- **US1 (Phase 3)**: Depends on Foundational (T001-T004)
- **US2 (Phase 4)**: Depends on Foundational (T001-T004), can run in parallel with US1
- **US3 (Phase 5)**: Depends on US1 completion (spacing improves naturally with less fragmentation)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — core fix
- **US2 (P1)**: Depends on Foundational only — largely resolved by same code changes as US1
- **US3 (P2)**: Depends on US1/US2 — CSS-only adjustments after renderer fix

### Parallel Opportunities

- T001-T004 are sequential (same file, same state variables)
- T005-T007 (US1) and T008-T009 (US2) operate on different sections of the same file but are logically independent
- T010-T011 (US3) are in a different file (`_typography.css`) and can be drafted in parallel once the renderer changes are known

---

## Parallel Example: After Foundational

```bash
# US1 and US2 can be worked on in parallel (different logic sections):
Task: "T005 [US1] Add start attribute logic for ol reopening"
Task: "T008 [US2] Verify code block rendering in list context"

# US3 CSS can be drafted once renderer changes are clear:
Task: "T010 [US3] Adjust CSS for list continuation spacing"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001-T004)
2. Complete Phase 3: User Story 1 (T005-T007)
3. **STOP and VALIDATE**: Open a spec with numbered list + code blocks, verify counter continuity
4. US2 likely already works — verify

### Incremental Delivery

1. Foundational → State tracking ready
2. US1 → Counter continuity fixed → Validate
3. US2 → Code blocks render correctly → Validate
4. US3 → Spacing compact → Validate
5. Polish → Regression check → Done

---

## Notes

- All renderer changes are in a single file (`renderer.ts`) — coordinate sequential edits carefully
- US1 and US2 share the same root cause (list fragmentation) so fixing US1 may automatically fix US2
- US3 is primarily CSS and benefits from reduced list fragments
- Commit after each phase checkpoint
