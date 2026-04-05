# Tasks: Context-Driven Badges and Dates

**Input**: Design documents from `/specs/044-context-driven-badges/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No project initialization needed — this feature modifies an existing codebase. Skip to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type changes and helper functions that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T001 Add `createdDate?: string | null` and `lastUpdatedDate?: string | null` fields to `NavState` interface in `src/features/spec-viewer/types.ts`
- [x] T002 Add date computation helpers (`computeCreatedDate` and `computeLastUpdatedDate`) in `src/features/spec-viewer/phaseCalculation.ts` — extract "Created" from `stepHistory.specify.startedAt` (fallback: earliest `startedAt`), extract "Last Updated" from `context.updated` or most recent timestamp across all `stepHistory` entries; return `null` when missing/unparseable; format as `"Apr 1, 2026"` using `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`

**Checkpoint**: NavState interface extended, date helpers ready for use

---

## Phase 3: User Story 1 — Badge Reflects Current Step from spec-context.json (Priority: P1) MVP

**Goal**: Badge in the metadata bar displays the current workflow step derived solely from `.spec-context.json`

**Independent Test**: Open a spec with `.spec-context.json` containing `currentStep: "plan"`, verify badge shows "PLANNING". Advance to "tasks", verify badge updates to "IMPLEMENTING".

### Implementation for User Story 1

- [x] T003 [US1] Verify `computeBadgeText()` in `src/features/spec-viewer/phaseCalculation.ts` returns `null` when no context exists and covers all step/status combinations per data-model badge derivation table — add any missing edge case branches (e.g., `status: "archived"` → `"ARCHIVED"`)
- [x] T004 [US1] Verify `generator.ts` at `src/features/spec-viewer/html/generator.ts` omits the `<div class="spec-badge-bar">` entirely when `badgeText` is `null` — no empty container rendered
- [x] T005 [US1] Verify `updateNavState()` in `webview/src/spec-viewer/navigation.ts` removes the badge bar DOM element when `badgeText` is `null` and updates it when non-null

**Checkpoint**: Badge is fully context-driven; hidden when no context. US1 independently testable.

---

## Phase 4: User Story 2 — Date Display Derived from spec-context.json (Priority: P1)

**Goal**: "Created" and "Last Updated" dates in the metadata header are derived from `stepHistory` timestamps in `.spec-context.json`, replacing markdown frontmatter parsing

**Independent Test**: Create a spec with `.spec-context.json` containing `stepHistory.specify.startedAt: "2026-04-01T10:00:00Z"` and `stepHistory.plan.startedAt: "2026-04-03T14:00:00Z"`. Verify "Created: Apr 1, 2026" and "Last Updated: Apr 3, 2026" appear.

### Implementation for User Story 2

- [x] T006 [US2] Populate `navState.createdDate` and `navState.lastUpdatedDate` in `src/features/spec-viewer/specViewerProvider.ts` by calling the date computation helpers from T002, using `featureCtx.stepHistory` and `featureCtx.updated` as inputs
- [x] T007 [US2] Render context-driven dates in initial HTML in `src/features/spec-viewer/html/generator.ts` — add "Created" and "Last Updated" elements to the metadata bar using `navState.createdDate` and `navState.lastUpdatedDate`; omit each element when its value is `null`
- [x] T008 [US2] Remove `'Created'`, `'Last Updated'`, and `'Date'` from `recognizedFields` in `webview/src/spec-viewer/markdown/preprocessors.ts` so the markdown preprocessor no longer parses date items from frontmatter
- [x] T009 [US2] Add dynamic date updates in `updateNavState()` in `webview/src/spec-viewer/navigation.ts` — update or remove "Created" and "Last Updated" DOM elements based on received `createdDate` and `lastUpdatedDate` values

**Checkpoint**: Dates are fully context-driven; markdown date parsing removed. US2 independently testable.

---

## Phase 5: User Story 3 — Graceful Fallback When spec-context.json is Missing or Incomplete (Priority: P1)

**Goal**: Viewer gracefully omits badge and/or dates when `.spec-context.json` is absent, malformed, or missing relevant fields — no errors, no empty placeholders

**Independent Test**: Open a spec directory with only `spec.md` and no `.spec-context.json`. Verify badge area and date fields are hidden (not shown as empty or "undefined").

### Implementation for User Story 3

- [x] T010 [US3] Ensure `specViewerProvider.ts` at `src/features/spec-viewer/specViewerProvider.ts` sets `badgeText`, `createdDate`, and `lastUpdatedDate` to `null` in NavState when `specContextManager.readSpecContext()` returns `undefined` or throws (malformed JSON)
- [x] T011 [US3] Ensure date computation helpers in `src/features/spec-viewer/phaseCalculation.ts` handle partial `stepHistory` (e.g., only `specify` entry exists → `createdDate` shown, `lastUpdatedDate` omitted) and unparseable timestamps (return `null`)
- [x] T012 [US3] Verify HTML generator at `src/features/spec-viewer/html/generator.ts` produces no badge container and no date elements when all NavState badge/date fields are `null`
- [x] T013 [US3] Verify `updateNavState()` in `webview/src/spec-viewer/navigation.ts` removes badge and date DOM elements when receiving `null` values (handles case where `.spec-context.json` is deleted while viewer is open)

**Checkpoint**: Viewer degrades gracefully for all missing/malformed/partial context scenarios. US3 independently testable.

---

## Phase 6: User Story 4 — Extension Actions Update spec-context.json (Priority: P2)

**Goal**: Lifecycle actions (complete, archive, reactivate, step advance) update `.spec-context.json` and the viewer reflects changes without reload

**Independent Test**: Open a spec, click "Complete" in the viewer footer. Verify `.spec-context.json` has `status: "completed"` and badge shows "COMPLETED".

### Implementation for User Story 4

- [x] T014 [US4] Verify `messageHandlers.ts` at `src/features/spec-viewer/messageHandlers.ts` calls `updateContent()` after lifecycle actions (complete, archive, reactivate) so NavState is recomputed with updated badge and dates
- [x] T015 [US4] Verify step advance flow in `messageHandlers.ts` calls `updateStepProgress()` (which sets `stepHistory[step].startedAt`) and then refreshes the viewer — confirm `lastUpdatedDate` updates after advancing
- [x] T016 [US4] End-to-end verification: open spec → complete → verify badge changes to "COMPLETED" and `lastUpdatedDate` updates → reactivate → verify badge reverts to step label

**Checkpoint**: All lifecycle actions propagate through spec-context.json to viewer display. US4 independently testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and validation across all stories

- [x] T017 [P] Update `docs/viewer-states.md` to document context-driven badge and date behavior: badge derivation from `.spec-context.json`, date derivation from `stepHistory`, graceful omission rules
- [x] T018 [P] Update `README.md` to reflect that badge and dates are now derived from `.spec-context.json` rather than markdown frontmatter
- [x] T019 Run quickstart.md validation — execute all manual verification steps from `specs/044-context-driven-badges/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories.
- **US1 Badge (Phase 3)**: Depends on Phase 2 (NavState types)
- **US2 Dates (Phase 4)**: Depends on Phase 2 (NavState types + date helpers)
- **US3 Fallback (Phase 5)**: Depends on Phase 2; best done after US1+US2 so fallback paths can be verified against real implementations
- **US4 Actions (Phase 6)**: Depends on Phase 2; best done after US2 so date propagation can be verified
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2 — badge logic is self-contained
- **US2 (P1)**: Independent after Phase 2 — date logic is self-contained
- **US3 (P1)**: Best after US1+US2 but technically independent (tests missing-context paths)
- **US4 (P2)**: Best after US2 (verifies date update propagation) but lifecycle badge updates work independently

### Parallel Opportunities

- T001 and T002 are sequential (T002 uses types from T001)
- T003, T004, T005 (US1) can run in parallel (different files)
- T006, T007, T008, T009 (US2) are sequential (T006 → T007 → T008 → T009)
- T010, T011 (US3) can run in parallel with T012, T013 (different files)
- T017, T018 (Polish) can run in parallel (different files)
- US1 and US2 can run in parallel after Phase 2

---

## Parallel Example: After Phase 2

```
# US1 and US2 can start simultaneously:
Stream A (US1): T003 → T004 → T005
Stream B (US2): T006 → T007 → T008 → T009

# After both complete, US3 and US4:
Stream C (US3): T010 + T011 in parallel, then T012 + T013 in parallel
Stream D (US4): T014 → T015 → T016
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 2: Foundational (types + helpers)
2. Complete Phase 3: US1 — Badge verification
3. Complete Phase 4: US2 — Date implementation
4. **STOP and VALIDATE**: Badge and dates work from context, markdown dates removed
5. This covers FR-001 through FR-004, FR-008

### Incremental Delivery

1. Phase 2 → Foundation ready
2. US1 → Badge fully context-driven (likely minimal changes needed per research)
3. US2 → Dates fully context-driven (main implementation effort)
4. US3 → Graceful degradation verified
5. US4 → Lifecycle action propagation verified
6. Polish → Docs updated, quickstart validated

---

## Notes

- Research confirms badge logic (`computeBadgeText`) is already context-driven — US1 is primarily verification
- Main implementation effort is US2 (date computation + rendering + preprocessor changes)
- US3 is primarily verification/hardening of null paths in US1 and US2 implementations
- US4 is primarily verification that existing write paths propagate to viewer display
- No new modules needed — all changes within existing file structure
