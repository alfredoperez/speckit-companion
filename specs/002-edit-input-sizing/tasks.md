# Tasks: Edit Input Auto-Sizing with Original Value Display

**Input**: Design documents from `/specs/002-edit-input-sizing/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Not requested in specification - test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Webview UI**: `webview/src/ui/`, `webview/styles/`
- **Extension Host**: `src/features/workflow-editor/`
- **Tests**: `tests/webview/ui/` (if needed)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and verification

- [X] T001 Verify development environment by running `npm run compile` successfully
- [X] T002 Create feature branch `002-edit-input-sizing` if not already on it

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core CSS infrastructure that supports all user stories

**⚠️ CRITICAL**: Input styling foundation must be complete before any user story implementation

- [X] T003 Add CSS custom properties for original value styling in `webview/styles/workflow.css` (--original-value-color, --original-value-font-size)
- [X] T004 Add `.edit-input-container` class for popover layout structure in `webview/styles/workflow.css`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Auto-Sizing Text Input (Priority: P1) 🎯 MVP

**Goal**: Input element automatically resizes to fit current content as user types or deletes text

**Independent Test**: Enter edit mode on any editable text field and observe the input automatically sizes to match the text content. Type more text and verify input grows; delete text and verify input shrinks.

### Implementation for User Story 1

- [X] T005 [US1] Update `.refine-input` class to add `field-sizing: content` property in `webview/styles/workflow.css`
- [X] T006 [US1] Add `min-width: 200px` and `max-width: 100%` constraints to `.refine-input` in `webview/styles/workflow.css`
- [X] T007 [US1] Add hidden span fallback helper function `measureTextWidth()` in `webview/src/ui/refinePopover.ts`
- [X] T008 [US1] Implement feature detection for `field-sizing` support in `webview/src/ui/refinePopover.ts`
- [X] T009 [US1] Add input event listener to trigger fallback resize when `field-sizing` is not supported in `webview/src/ui/refinePopover.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional - input auto-sizes as user types

---

## Phase 4: User Story 2 - Display Original Value During Edit (Priority: P1)

**Goal**: Original value (before any edits) remains visible for reference while user is in edit mode

**Independent Test**: Enter edit mode and verify the original text value is displayed above the input. Modify the input content and verify the original value remains unchanged. Cancel edit and verify field reverts to original value.

### Implementation for User Story 2

- [X] T010 [P] [US2] Add `.original-value-reference` CSS class with muted styling in `webview/styles/workflow.css`
- [X] T011 [P] [US2] Add `.original-value-label` CSS class for "Original" label in `webview/styles/workflow.css`
- [X] T012 [US2] Add `escapeHtml()` helper function for safe HTML rendering in `webview/src/ui/refinePopover.ts`
- [X] T013 [US2] Update popover HTML template to include original value display section in `webview/src/ui/refinePopover.ts`
- [X] T014 [US2] Add `aria-describedby` attribute linking input to original value element in `webview/src/ui/refinePopover.ts`
- [X] T015 [US2] Add conditional rendering to hide original value section when `lineContent` is empty in `webview/src/ui/refinePopover.ts`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - auto-sizing input with original value displayed

---

## Phase 5: User Story 3 - Visual Distinction Between Original and Edit (Priority: P2)

**Goal**: Original value and editable input are visually distinct for easy differentiation

**Independent Test**: Enter edit mode and verify that the original value has different visual styling (muted color, italic, smaller font) than the edit input. Visual hierarchy should be immediately clear.

### Implementation for User Story 3

- [X] T016 [P] [US3] Add italic font-style to `.original-value-reference` in `webview/styles/workflow.css`
- [X] T017 [P] [US3] Add left border accent indicator (2px solid var(--accent)) to `.original-value-reference` in `webview/styles/workflow.css`
- [X] T018 [P] [US3] Add `.original-value-reference` background color (var(--bg-secondary)) in `webview/styles/workflow.css`
- [X] T019 [US3] Add max-height and overflow-y: auto for long original values in `webview/styles/workflow.css`
- [X] T020 [US3] Add word-break: break-word to handle long unbroken text in `.original-value-reference` in `webview/styles/workflow.css`

**Checkpoint**: All user stories should now be independently functional with clear visual hierarchy

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation

- [X] T021 Run `npm run compile` and fix any TypeScript errors
- [ ] T022 Run `npm run watch` and manually test all scenarios from quickstart.md
- [ ] T023 Verify accessibility by checking keyboard navigation and screen reader behavior
- [ ] T024 Test edge cases: very long original text (100+ chars), empty original, special characters
- [ ] T025 Verify performance: input resizing feels instantaneous (<50ms per keystroke)
- [X] T026 Update CLAUDE.md with any new patterns or notes for this feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority but US2 depends on popover structure from US1
  - US3 (P2) can start after US2 as it refines the visual styling
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after T005-T006 of US1 complete (needs popover structure) - CSS tasks T010-T011 can run in parallel with US1
- **User Story 3 (P2)**: Depends on US2 CSS foundation (T010-T011) - Refines the styling further

### Within Each User Story

- CSS changes before TypeScript changes (styles must exist before using them)
- Helper functions before usage in templates
- Core implementation before edge case handling
- Story complete before moving to next priority

### Parallel Opportunities

- T010, T011 (US2 CSS) can run in parallel with T007-T009 (US1 TypeScript)
- T016, T017, T018 (US3 styling) can all run in parallel (different CSS properties)
- All Phase 6 validation tasks can run after all stories complete

---

## Parallel Example: User Story 2

```bash
# Launch CSS tasks in parallel (different style rules):
Task: "Add .original-value-reference CSS class in webview/styles/workflow.css"
Task: "Add .original-value-label CSS class in webview/styles/workflow.css"

# Then sequentially for TypeScript (dependencies):
Task: "Add escapeHtml() helper function in webview/src/ui/refinePopover.ts"
Task: "Update popover HTML template in webview/src/ui/refinePopover.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational CSS
3. Complete Phase 3: User Story 1 (Auto-sizing)
4. **STOP and VALIDATE**: Test auto-sizing independently
5. Deploy/demo if ready - input now auto-sizes!

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test auto-sizing → Demo (MVP!)
3. Add User Story 2 → Test original value display → Demo
4. Add User Story 3 → Test visual distinction → Demo
5. Each story adds value without breaking previous stories

### Single Developer Strategy (Recommended)

1. Complete Setup (Phase 1)
2. Complete Foundational CSS (Phase 2)
3. Complete User Story 1 entirely (Phase 3)
4. Complete User Story 2 (Phase 4) - CSS parallel with US1 TS work
5. Complete User Story 3 (Phase 5)
6. Complete Polish (Phase 6)

---

## Files Modified Summary

| File | Changes | User Stories |
|------|---------|--------------|
| `webview/styles/workflow.css` | field-sizing, CSS custom properties, original value styling | US1, US2, US3 |
| `webview/src/ui/refinePopover.ts` | escapeHtml helper, hidden span fallback, updated HTML template | US1, US2 |

---

## Notes

- [P] tasks = different files or different CSS rules, no dependencies
- [Story] label maps task to specific user story for traceability
- This is a UI-only feature - no backend/extension host changes required
- CSS `field-sizing: content` is the primary approach (VS Code uses Chromium)
- Hidden span fallback ensures compatibility with older VS Code versions
- Verify compilation and manual testing after each phase
- Commit after each task or logical group
