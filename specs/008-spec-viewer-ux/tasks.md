# Tasks: Spec Viewer UX Polish

**Input**: Design documents from `/specs/008-spec-viewer-ux/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅, contracts/ ✅

**Tests**: Tests are NOT included (not requested in feature specification). This is a UI polish feature best validated through manual testing.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No setup required - this feature modifies existing files only.

**Note**: This feature enhances the existing spec-viewer implementation. All required infrastructure is already in place.

**Checkpoint**: Ready to proceed directly to Foundational phase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add SpecStatus type and status detection that ALL user stories depend on

**⚠️ CRITICAL**: US5 (State-Appropriate UI) directly needs this, but status detection should be established first as it affects HTML generation used by all stories.

- [X] T001 Add SpecStatus type definition in src/features/spec-viewer/types.ts
- [X] T002 Implement extractSpecStatus() function in src/features/spec-viewer/specViewerProvider.ts
- [X] T003 Pass spec status to HTML body data attribute in src/features/spec-viewer/specViewerProvider.ts

**Checkpoint**: Status detection ready - user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Cleaner Visual Layout (Priority: P1) 🎯 MVP

**Goal**: Remove visual clutter (excessive dividers, padding) so users can focus on content.

**Independent Test**: Open any spec document and verify: no double dividers, consistent spacing, minimal list padding, reduced H2/H3 margins.

### Implementation for User Story 1

- [X] T004 [P] [US1] Reduce H2 margins from 28px/14px to 24px/8px in webview/styles/spec-viewer/_typography.css
- [X] T005 [P] [US1] Reduce H3 font-size to 15px and margins to 20px/6px in webview/styles/spec-viewer/_typography.css
- [X] T006 [P] [US1] Review and remove any double divider CSS rules in webview/styles/spec-viewer/_content.css
- [X] T007 [P] [US1] Ensure Input section has single accent-colored left border in webview/styles/spec-viewer/_callouts.css
- [X] T008 [P] [US1] Verify list item padding is minimal (not 40px) in webview/styles/spec-viewer/_typography.css
- [X] T009 [US1] Ensure empty lines have no hover effects (pointer-events: none) in webview/styles/spec-viewer/_line-actions.css

**Checkpoint**: Visual layout is clean - no excessive dividers, consistent spacing throughout.

---

## Phase 4: User Story 2 - Improved Comment Interaction (Priority: P1)

**Goal**: Make comment interface intuitive and non-disruptive for quick annotation.

**Independent Test**: Add comments to various line types - verify button position, editor panel styling, quick action labels, and remove action behavior.

### Implementation for User Story 2

- [X] T010 [P] [US2] Move add-comment button to top-left position (left: -28px, top: 4px) in webview/styles/spec-viewer/_line-actions.css
- [X] T011 [P] [US2] Add left margin to .line class for gutter space in webview/styles/spec-viewer/_line-actions.css
- [X] T012 [P] [US2] Hide .line-add-btn when .line.editing in webview/styles/spec-viewer/_line-actions.css
- [X] T013 [P] [US2] Remove box-shadow from .inline-editor in webview/styles/spec-viewer/_editor.css
- [X] T014 [P] [US2] Remove .editor-divider CSS rule in webview/styles/spec-viewer/_editor.css
- [X] T015 [US2] Remove editor-divider HTML element from inlineEditor.ts in webview/src/spec-viewer/editor/inlineEditor.ts
- [X] T016 [US2] Update quick action labels (Remove → Remove Line, etc.) in webview/src/spec-viewer/editor/lineActions.ts
- [X] T017 [US2] Change remove actions to add refinement comment instead of deleting in webview/src/spec-viewer/editor/lineActions.ts
- [X] T018 [US2] Update inlineEditor.ts to pass lineElement to handleContextAction in webview/src/spec-viewer/editor/inlineEditor.ts

**Checkpoint**: Comment interactions work smoothly - button at top-left, clean editor panel, remove adds comment.

---

## Phase 5: User Story 3 - Typography Hierarchy Improvements (Priority: P2)

**Goal**: Consistent and appropriately-sized typography for clear document hierarchy.

**Independent Test**: Open spec, plan, and tasks documents - verify H2 sizes are consistent (~18px), code blocks are slightly smaller than body text.

### Implementation for User Story 3

- [X] T019 [P] [US3] Reduce H2 font-size from ~28px to 18px in webview/styles/spec-viewer/_typography.css
- [X] T020 [P] [US3] Ensure code block font-size is at least 1px smaller than body in webview/styles/spec-viewer/_typography.css
- [X] T021 [US3] Verify tasks.md H2 headings are not oversized (same styling as spec.md) in webview/styles/spec-viewer/_typography.css

**Checkpoint**: Typography hierarchy is clear and consistent across all document types.

---

## Phase 6: User Story 4 - Acceptance Criteria Format Change (Priority: P2)

**Goal**: Display acceptance scenarios as lists instead of tables to enable per-item comments.

**Independent Test**: View any user story with acceptance scenarios - verify they render as numbered list with bold keywords and hoverable comment buttons.

### Implementation for User Story 4

- [X] T022 [US4] Rewrite parseAcceptanceScenarios() to output list format in webview/src/spec-viewer/markdown/scenarios.ts
- [X] T023 [US4] Add Given/When/Then keyword emphasis with <strong> tags in webview/src/spec-viewer/markdown/scenarios.ts
- [X] T024 [P] [US4] Add .acceptance-scenarios and .scenario-item list styling in webview/styles/spec-viewer/_tables.css
- [X] T025 [P] [US4] Add keyword color styling (.keyword-given, .keyword-when, .keyword-then) in webview/styles/spec-viewer/_tables.css

**Checkpoint**: Acceptance scenarios display as commentable lists with emphasized keywords.

---

## Phase 7: User Story 5 - State-Appropriate UI Controls (Priority: P2)

**Goal**: Hide editing controls for completed specs to avoid confusion.

**Independent Test**: View a spec with "Status: Spec Completed" - verify DRAFT badge, add-comment buttons, and refinement CTAs are hidden.

### Implementation for User Story 5

- [X] T026 [P] [US5] Add CSS to hide .line-add-btn and .row-add-btn when body[data-spec-status="spec-completed"] in webview/styles/spec-viewer/_line-actions.css
- [X] T027 [P] [US5] Add CSS to hide .meta-status-draft when completed in webview/styles/spec-viewer/_content.css
- [X] T028 [P] [US5] Add CSS to hide refinement CTAs when completed in webview/styles/spec-viewer/_footer.css

**Checkpoint**: Completed specs show read-only interface with no edit controls.

---

## Phase 8: User Story 6 - Clarify Button Tooltip (Priority: P3)

**Goal**: Add tooltip to Clarify button for discoverability.

**Independent Test**: Hover over Clarify button - verify tooltip appears with helpful text.

### Implementation for User Story 6

- [X] T029 [US6] Add title="Refine any requirements further" to Clarify button in src/features/spec-viewer/html/generator.ts

**Checkpoint**: Clarify button has discoverable tooltip.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [X] T030 [P] Run visual regression check on all document types (spec.md, plan.md, tasks.md)
- [X] T031 [P] Test comment workflow end-to-end with new button positions
- [X] T032 [P] Verify high-contrast mode compatibility
- [X] T033 Run quickstart.md validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks - feature modifies existing code
- **Foundational (Phase 2)**: T001→T002→T003 must be sequential (type → function → usage)
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority - can run in parallel
  - US3, US4, US5 are P2 priority - can run in parallel after P1s
  - US6 is P3 priority - lowest priority, can run anytime after Foundational
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Independence

| Story | Can Start After | Dependencies on Other Stories |
|-------|-----------------|-------------------------------|
| US1 (Visual Layout) | Phase 2 | None |
| US2 (Comment Interaction) | Phase 2 | None |
| US3 (Typography) | Phase 2 | Overlaps with US1 on _typography.css - coordinate |
| US4 (Acceptance Format) | Phase 2 | None |
| US5 (State UI) | Phase 2 | Uses status from T001-T003 |
| US6 (Tooltip) | Phase 2 | None |

### Within Each User Story

- CSS tasks marked [P] can run in parallel (different files or non-conflicting changes)
- TypeScript changes should generally be sequential within a story
- Test each story independently after completion

### Parallel Opportunities

**Phase 2**: T001 must complete before T002, T002 before T003 (sequential)

**Phase 3 (US1)**: T004, T005, T006, T007, T008 can all run in parallel (different CSS files/rules)

**Phase 4 (US2)**: T010, T011, T012, T013, T014 can run in parallel (different CSS files); T015→T016→T017→T018 are sequential (same TypeScript files)

**Phase 5 (US3)**: T019, T020 can run in parallel

**Phase 6 (US4)**: T022→T023 sequential, then T024, T025 in parallel

**Phase 7 (US5)**: T026, T027, T028 can all run in parallel (different CSS files)

**Phase 9**: T030, T031, T032 can all run in parallel

---

## Parallel Example: User Story 1 + User Story 2 (both P1)

```bash
# After Phase 2 completes, launch US1 and US2 CSS changes together:

# US1 tasks (all parallel):
Task: "Reduce H2 margins in _typography.css"
Task: "Reduce H3 margins in _typography.css"
Task: "Remove double dividers in _content.css"
Task: "Input section border in _callouts.css"

# US2 tasks (CSS in parallel):
Task: "Move button to top-left in _line-actions.css"
Task: "Add gutter margin in _line-actions.css"
Task: "Hide button when editing in _line-actions.css"
Task: "Remove box-shadow in _editor.css"
Task: "Remove divider CSS in _editor.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 2: Foundational (T001-T003)
2. Complete Phase 3: User Story 1 - Visual Layout
3. Complete Phase 4: User Story 2 - Comment Interaction
4. **STOP and VALIDATE**: Test visual improvements and comment workflow
5. The most impactful UX improvements are now live

### Incremental Delivery

1. Phase 2 → Status detection ready
2. US1 + US2 → Core UX improvements (MVP!)
3. US3 → Typography polish
4. US4 → Acceptance scenario format
5. US5 → State-aware controls
6. US6 → Tooltip enhancement
7. Each addition improves UX without breaking previous changes

### Suggested Order for Solo Developer

1. T001-T003 (Foundational - required)
2. T004-T009 (US1 - visual layout - highest impact)
3. T010-T018 (US2 - comment interaction - critical workflow)
4. T019-T021 (US3 - typography - quick wins)
5. T026-T028 (US5 - state UI - depends on T001-T003)
6. T022-T025 (US4 - acceptance format - larger change)
7. T029 (US6 - tooltip - trivial)
8. T030-T033 (Polish - validation)

---

## Notes

- All changes are CSS-first approach (lowest risk)
- TypeScript changes are minimal (labels, behavior modifications)
- No new files created - all modifications to existing files
- Visual changes can be validated immediately in Extension Development Host (F5)
- Rollback: `git checkout -- webview/styles/spec-viewer/*.css webview/src/spec-viewer/**/*.ts src/features/spec-viewer/*.ts`
