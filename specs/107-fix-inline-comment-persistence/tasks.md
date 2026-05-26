# Tasks: Fix Inline Comment Persistence

**Input**: Design documents from `specs/107-fix-inline-comment-persistence/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Scale**: 2 files changed, ≤ 10 lines total — no setup or foundational phase required.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: User Story 1 — Comments on spec.md Persist and Restore (Priority: P1) 🎯 MVP

**Goal**: Inline comments added on `spec.md` are immediately persisted to `.spec-context.json` and correctly restored on reopen, matching the behavior already working for `plan.md` and `tasks.md`.

**Independent Test**: Open spec viewer on `spec.md`, add a comment, close the panel, reopen — comment appears at the same location.

### Implementation for User Story 1

- [x] T001 [US1] Fix `currentDoc()` to map `'specify'` → `'spec'` in `webview/src/spec-viewer/editor/currentDoc.ts`
- [x] T002 [P] [US1] Add unit test for `currentDoc()` returning `'spec'` when `navState.currentDoc = 'specify'` in `tests/unit/spec-viewer/currentDoc.spec.ts`

**Checkpoint**: After T001, adding a comment to `spec.md` persists it to `.spec-context.json` and restores on reopen. US1 independently verified.

---

## Phase 2: User Story 2 — Consistent Behavior Across All Document Types (Priority: P2)

**Goal**: `sourceDoc` lookups in the extension's message handlers resolve correctly for all three core documents (`spec`, `plan`, `tasks`), even when `availableDocuments` entries carry `type = 'specify'` rather than `type = 'spec'`.

**Independent Test**: Add comments to `spec.md`, `plan.md`, and `tasks.md`. Close and reopen viewer — all three restore identically. Inspect `.spec-context.json` — each comment has the correct `doc` field.

### Implementation for User Story 2

- [x] T003 [P] [US2] Fix `handleAddComment` `sourceDoc` lookup to fall back to `fileName` match in `src/features/spec-viewer/messageHandlers.ts`
- [x] T004 [P] [US2] Fix `dispatchDocRefinement` `sourceDoc` lookup to fall back to `fileName` match in `src/features/spec-viewer/messageHandlers.ts`
- [x] T005 [P] [US2] Add unit test for `handleAddComment` resolving `sourceDoc` when `availableDocuments` has `{ type: 'specify', fileName: 'spec.md', isCore: true }` in `tests/unit/spec-viewer/messageHandlers.spec.ts`

**Checkpoint**: All three document types persist and restore comments symmetrically. `reviewComments[]` in `.spec-context.json` carries correct `doc` values for each entry. US1 and US2 both verified.

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: Verify no regression on existing working documents and confirm the Refine workflow still fires.

- [x] T006 [P] Smoke-test `plan.md` and `tasks.md` comment persist/restore to confirm no regression
- [x] T007 [P] Smoke-test the `✨ Refine` action on `spec.md` to confirm AI dispatch fires after T001–T004

---

## Dependencies

```
T001  → (unblocks) T002, T003, T004 (T001 is the primary gate; T003/T004 can be done in parallel with T001)
T003  → T004 (same file — apply sequentially to avoid conflicts)
T005  → (independent, can run in parallel with T003/T004)
T006, T007 → (after T001–T005)
```

## Parallel Execution Examples

**US1 + US2 setup in parallel** (T001 and T002 are in different contexts — webview vs. extension):

```
T001  webview/src/spec-viewer/editor/currentDoc.ts
T003  src/features/spec-viewer/messageHandlers.ts   ← different file, safe to parallelize with T001
T005  tests/unit/spec-viewer/messageHandlers.spec.ts
```

**After T003 completes**, apply T004 to the same file, then T006/T007.

## Implementation Strategy

**MVP**: T001 alone delivers US1 completely — spec.md comments persist and restore. Ship this first.

**Full**: T001–T005 deliver both user stories with symmetric behavior and unit-test coverage.

**Total tasks**: 7 (5 implementation / 2 smoke tests)
| Story | Count |
|-------|-------|
| US1 (P1) | 2 |
| US2 (P2) | 3 |
| Polish | 2 |
