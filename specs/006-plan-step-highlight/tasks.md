# Tasks: Plan Step Highlight and Sub-menu Ordering

**Input**: Design documents from `/specs/006-plan-step-highlight/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Not requested - tests omitted

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- Extension source: `src/features/workflow-editor/`
- Webview source: `webview/src/`
- Webview styles: `webview/styles/`

---

## Phase 1: Setup

**Purpose**: Development environment preparation and initial verification

- [x] T001 Run `npm run compile` to ensure clean build state
- [x] T002 Launch Extension Development Host (F5) to verify current behavior
- [x] T003 Create or open a test spec folder with plan sub-sections for testing

---

## Phase 2: Verification (Before Implementation)

**Purpose**: Determine if implementation is actually needed based on research findings

**⚠️ CRITICAL**: Research suggests the feature may already be working. Must verify before making changes.

- [x] T004 Open research.md in workflow editor and verify Plan step highlighting
- [x] T005 Open data-model.md and verify Plan step remains highlighted
- [x] T006 Open quickstart.md and verify Plan step remains highlighted
- [x] T007 Verify sub-menu shows "Plan" first, then alphabetical order (Data Model, Quickstart, Research)
- [x] T008 Document findings: create list of what works vs. what needs fixing

**Checkpoint**: If all verification passes, skip to Phase 5 (Polish). If issues found, proceed with Phase 3 and/or Phase 4.

---

## Phase 3: User Story 1 - Plan Step Visual Feedback (Priority: P1) 🎯 MVP

**Goal**: Ensure Plan step remains visually highlighted when viewing any plan sub-section

**Independent Test**: Navigate to any plan sub-section (research.md, data-model.md, quickstart.md) and verify the Plan step displays a blue ring/glow indicator

### Implementation for User Story 1

- [x] T009 [US1] Verify `currentPhase = 2` for plan sub-sections in `src/features/workflow-editor/workflow/specInfoParser.ts:49-58`
- [x] T010 [US1] Verify `documentType = 'plan'` is set for all plan sub-sections in `src/features/workflow-editor/workflow/specInfoParser.ts:49-58`
- [x] T011 [P] [US1] Verify `.active` class toggle logic in `webview/src/ui/phaseUI.ts:18` correctly applies when `phaseNum === specInfo.currentPhase`
- [x] T012 [P] [US1] Verify `.step.active .step-indicator` CSS styling provides visible blue ring/glow in `webview/styles/workflow.css:181-206`
- [x] T013 [US1] If phase not highlighted: Debug by adding console.log in `updatePhaseUI()` to trace specInfo.currentPhase value (NOT NEEDED - works correctly)
- [x] T014 [US1] If timing issue: Ensure `updatePhaseUI()` is called after DOM is ready in `webview/src/workflow.ts` (NOT NEEDED - works correctly)
- [x] T015 [US1] Manual test: Open each plan sub-section and confirm Plan step (step 2) has blue ring/glow

**Checkpoint**: Plan step should now highlight correctly for all plan sub-sections (research.md, data-model.md, quickstart.md, plan.md)

---

## Phase 4: User Story 2 - Sub-menu Ordering (Priority: P2)

**Goal**: Display "Plan" as first sub-menu option, remaining items alphabetically ordered

**Independent Test**: Expand Plan step sub-menu and verify order is: Plan, Data Model, Quickstart, Research

### Implementation for User Story 2

- [x] T016 [US2] Verify Plan.md is added first to `docsToShow` array in `src/features/workflow-editor/workflow/specInfoParser.ts:117-124`
- [x] T017 [US2] Verify remaining docs are sorted alphabetically before being added in `src/features/workflow-editor/workflow/specInfoParser.ts:127-134`
- [x] T018 [US2] If ordering incorrect: Fix `getRelatedDocs()` function to ensure Plan is prepended before sorted array (NOT NEEDED - works correctly)
- [x] T019 [US2] Manual test: Verify sub-menu shows tabs in correct order: Plan | Data Model | Quickstart | Research

**Checkpoint**: Sub-menu tabs should display in correct order across all plan views

---

## Phase 5: Polish & Validation

**Purpose**: Final validation and documentation

- [x] T020 Complete full testing checklist from quickstart.md
- [x] T021 [P] Test page refresh preserves correct highlight state
- [x] T022 [P] Test direct navigation (opening plan sub-section from file explorer)
- [x] T023 [P] Test switching between workflow steps (Spec → Plan → Tasks) updates highlighting correctly
- [x] T024 Run `npm run compile` to ensure no TypeScript errors
- [x] T025 Update CLAUDE.md with implementation notes if changes were made (NO CHANGES NEEDED - feature was already working)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Verification (Phase 2)**: Depends on Setup - determines if implementation is needed
- **User Story 1 (Phase 3)**: Only if Verification shows highlighting broken
- **User Story 2 (Phase 4)**: Only if Verification shows ordering broken
- **Polish (Phase 5)**: After any necessary implementation complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - can be completed without User Story 2
- **User Story 2 (P2)**: Independent - can be completed without User Story 1

### Parallel Opportunities

Within Phase 3 (User Story 1):
- T011 and T012 can run in parallel (different files)
- T013, T014 are sequential debugging steps (only if needed)

Within Phase 4 (User Story 2):
- T016 and T017 are in same file - execute sequentially

Within Phase 5 (Polish):
- T021, T022, T023 can run in parallel (independent tests)

---

## Parallel Example: Verification Phase

```bash
# After Setup, launch verification tests in parallel:
Task: "Open research.md in workflow editor and verify Plan step highlighting"
Task: "Open data-model.md and verify Plan step remains highlighted"
Task: "Open quickstart.md and verify Plan step remains highlighted"
Task: "Verify sub-menu shows Plan first, then alphabetical order"
```

---

## Implementation Strategy

### Research-First Approach

Based on the research.md findings, most functionality may already be working:

1. Complete Phase 1: Setup
2. Complete Phase 2: Verification
3. **DECISION POINT**:
   - If verification passes → Skip to Phase 5 (only validation needed)
   - If highlighting fails → Complete Phase 3
   - If ordering fails → Complete Phase 4
4. Complete Phase 5: Polish

### Minimal Change Strategy

This feature is expected to require minimal or no code changes:
- The highlighting logic is already correctly implemented in `specInfoParser.ts` and `phaseUI.ts`
- The sub-menu ordering is already correctly implemented with Plan first
- Main effort is verification that existing code works as designed

### Files Likely Modified (If Changes Needed)

| File | Purpose | User Story |
|------|---------|------------|
| `src/features/workflow-editor/workflow/specInfoParser.ts` | Phase detection | US1, US2 |
| `webview/src/ui/phaseUI.ts` | CSS class application | US1 |
| `webview/styles/workflow.css` | Visual styling | US1 |
| `webview/src/workflow.ts` | Timing fixes if needed | US1 |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Research indicates most functionality already works - verify before implementing
- This is a UI enhancement with no backend/storage requirements
- Performance goal: UI updates within 100ms (per plan.md)
- Avoid: Making changes before verification, over-engineering a fix for a non-existent problem
