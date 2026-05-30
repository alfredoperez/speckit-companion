---
description: "Task list for feature 120-reorder-sidebar-icons"
---

# Tasks: Sidebar Icon Adjustments

**Input**: Design documents from `/specs/120-reorder-sidebar-icons/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/sidebar-titlebar.md

**Tests**: No new automated test tasks are required by the specification. Validation uses repo compile/test plus manual Extension Development Host verification from quickstart.md.

**Organization**: Tasks are grouped by user story so each sidebar behavior change can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. `US1`, `US2`, `US3`)
- Each task includes the concrete file path to change or validate

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new setup work. The change stays inside the existing VS Code extension, explorer commands, and docs surfaces already present in the repo.

No setup tasks required.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No blocking foundational work. The existing explorer command registration and watcher-driven refresh path are already in place and can be reused directly.

No foundational tasks required.

**Checkpoint**: Existing infrastructure is sufficient; user story work can begin immediately.

---

## Phase 3: User Story 1 - Start a spec faster (Priority: P1) 🎯 MVP

**Goal**: Keep the create-spec action as the leading right-side action in the SpecKit explorer title bar so users can start a spec without scanning past other controls.

**Independent Test**: Open the SpecKit explorer and confirm the first visible right-side title-bar action launches the existing create-spec flow.

### Implementation for User Story 1

- [X] T001 [US1] Update the `contributes.menus.view/title` entries for `speckit.views.explorer` in `package.json` so `speckit.create` remains the first visible right-side action ahead of filter, sort, and collapse/expand controls.
- [X] T002 [US1] Verify the create-spec action still routes to the existing spec creation flow by checking adjacent command wiring in `src/features/specs/specCommands.ts` and `src/speckit/detector.ts`, updating code only if the new title-bar arrangement exposes a mismatch.

**Checkpoint**: User Story 1 is complete when the explorer title bar still leads with create-spec and clicking it starts the same create flow as before.

---

## Phase 4: User Story 2 - Reduce visual clutter (Priority: P2)

**Goal**: Remove the manual refresh icon from the SpecKit explorer title bar without reducing normal explorer update behavior.

**Independent Test**: Open the SpecKit explorer and confirm no manual refresh icon is shown while normal spec changes still refresh the explorer through existing command and watcher behavior.

### Implementation for User Story 2

- [X] T003 [US2] Remove the explorer title-bar contribution for `speckit.refresh` from `package.json` while leaving non-explorer toolbar contributions untouched.
- [X] T004 [US2] Audit the refresh safety path in `src/features/specs/specCommands.ts` and `src/core/fileWatchers.ts`, updating any explorer-toolbar-specific comments or code assumptions that are no longer accurate after removing the visible refresh action.

**Checkpoint**: User Story 2 is complete when the explorer no longer shows refresh and routine spec changes still update through the existing automatic refresh path.

---

## Phase 5: User Story 3 - Keep the toolbar predictable across states (Priority: P3)

**Goal**: Keep the remaining explorer title-bar actions aligned and predictable across populated, filtered, and empty-result sidebar states.

**Independent Test**: Exercise the explorer in normal, filtered, and no-match states and confirm the remaining actions stay in a stable order with no overlap or unexpected visibility changes.

### Implementation for User Story 3

- [X] T005 [US3] Review and adjust the `group` and `when` clauses for the remaining `speckit.views.explorer` title-bar actions in `package.json` so filter, clear-filter, sort, and collapse/expand remain stable after refresh removal.
- [ ] T006 [US3] Manually verify the explorer title bar in the Extension Development Host across populated, filtered, and no-match states using the flows described in `specs/120-reorder-sidebar-icons/quickstart.md`, confirming the remaining actions stay visible, ordered, and clickable without overlap.

**Checkpoint**: User Story 3 is complete when the title bar behaves consistently across the targeted explorer states and widths.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Sync documentation and run repository validation for the completed sidebar change.

- [X] T007 [P] Update the Specs view title-bar description in `docs/sidebar.md` to remove the refresh button reference and describe the shipped action set accurately.
- [X] T008 [P] Update the sidebar summary in `README.md` if it still mentions the removed explorer refresh button or outdated title-bar ordering.
- [X] T009 Run `npm run compile` from the repository root to confirm the extension still builds after the explorer toolbar changes.
- [X] T010 Run `npm test` from the repository root to confirm the existing Jest suite still passes after the sidebar changes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: No dependencies; effectively empty.
- **Phase 3 (US1)**: Starts immediately.
- **Phase 4 (US2)**: Depends on US1 because refresh removal should preserve the final intended toolbar ordering.
- **Phase 5 (US3)**: Depends on US1 and US2 so the final action set can be validated as shipped.
- **Phase 6 (Polish)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Independent MVP slice.
- **User Story 2 (P2)**: Depends on the final US1 ordering because it removes one action from that same toolbar.
- **User Story 3 (P3)**: Depends on the final US1/US2 toolbar composition so state-specific behavior can be validated accurately.

### Within Each User Story

- Complete the `package.json` toolbar contribution change before any supporting audit or manual verification for that story.
- Run manual explorer verification after the relevant title-bar contribution changes are in place.
- Finish doc and build/test validation only after the shipped toolbar behavior is settled.

### Parallel Opportunities

- T007 and T008 can run in parallel because they touch different documentation files.
- T009 and T010 can run in parallel only if separate terminals are available and the working tree is otherwise stable.

---

## Parallel Example: Polish

```bash
# Documentation updates can be done together:
Task: "Update the Specs view title-bar description in docs/sidebar.md"
Task: "Update the sidebar summary in README.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Skip Phase 1 and Phase 2; no setup or foundational work is required.
2. Complete Phase 3 (US1).
3. **STOP and VALIDATE**: Confirm create-spec remains the first visible right-side action and still launches the create flow.

### Incremental Delivery

1. Land US1 to preserve the primary action.
2. Land US2 to remove the redundant refresh icon while preserving automatic refresh behavior.
3. Land US3 to confirm the remaining action set stays stable across explorer states.
4. Finish with docs plus compile/test validation.

### Parallel Team Strategy

1. One developer handles `package.json` toolbar changes for US1 and US2.
2. Another developer can prepare `docs/sidebar.md` and `README.md` once the final toolbar shape is known.
3. Validation tasks run after the code and docs converge.

---

## Notes

- No new data model or contract implementation files are required; the feature is a contribution-order and documentation change.
- Manual Extension Development Host verification remains necessary for the title-bar visibility and spacing checks that static tests cannot prove.
- Keep the change scoped to `speckit.views.explorer`; steering and viewer toolbars are explicitly out of scope.
