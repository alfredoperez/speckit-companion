# Tasks: Delete Spec from Sidebar on Hover

**Input**: Design documents from `/specs/016-delete-spec-sidebar/`
**Prerequisites**: plan.md ✅, spec.md ✅

**Organization**: Single user story — 2 `package.json` changes, no TypeScript needed.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: User Story 1 - Inline Delete Button on Hover (Priority: P1) 🎯 MVP

**Goal**: Hovering over a spec name in the sidebar shows a trash icon button that triggers delete with confirmation.

**Independent Test**: Launch extension (F5), hover over any spec row → trash icon appears inline; click it → confirmation dialog shows → confirm → spec deleted and tree refreshes. Right-click spec → "Delete Spec" still appears in context menu.

- [x] T001 [US1] Add `"icon": "$(trash)"` to the `speckit.delete` command entry in `package.json` `contributes.commands`
- [x] T002 [US1] Add inline `view/item/context` menu entry for `speckit.delete` with `"group": "inline"` and `when: "view == speckit.views.explorer && viewItem == spec"` in `package.json`
- [x] T003 [US1] Run `npm run compile` to confirm zero TypeScript errors

**Checkpoint**: Hover over a spec row → trash icon visible inline; right-click → Delete Spec still in context menu.

---

## Dependencies & Execution Order

- **T001** and **T002**: Independent `package.json` edits — can be done in sequence (same file, so sequential is safest)
- **T003**: Depends on T001 and T002 being complete

---

## Implementation Strategy

### MVP (all tasks — ~5 minutes total)

1. T001 — Add icon to command definition
2. T002 — Add inline menu entry
3. T003 — Compile to verify

---

## Notes

- No TypeScript changes needed — `speckit.delete` handler at `src/features/specs/specCommands.ts:57` already handles the full flow
- Both menu entries (`"group": "inline"` and `"group": "7_modification"`) must coexist so the button appears on hover AND in the right-click menu
