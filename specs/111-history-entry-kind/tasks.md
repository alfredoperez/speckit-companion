# Tasks: Explicit History Entry Kind Field

**Input**: Design documents from `specs/111-history-entry-kind/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no incomplete task dependencies)
- **[US1/2/3]**: Which user story this task serves
- Exact file paths included in all descriptions

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Type and schema changes that all three user stories depend on.

**⚠️ CRITICAL**: Phases 2–4 cannot start until T001 is complete (all consumer files import `HistoryEntry` from `specContext.ts`). T002 can run in parallel with T001 since it touches a separate file.

- [X] T001 Add `HistoryEntryKind` type, add `kind: HistoryEntryKind` field, and change `from` to optional (`from?: HistoryEntryFrom`) on `HistoryEntry` in `src/core/types/specContext.ts`
- [X] T002 [P] Add `kind` enum `["start","complete"]` to `historyEntry` `properties`; add `"kind"` to `historyEntry` `required`; remove `"from"` from `historyEntry` `required` in `src/core/types/spec-context.schema.json`

**Checkpoint**: TypeScript type and JSON Schema reflect the new shape — all downstream edits can now begin

---

## Phase 2: User Story 1 — AI Writes Self-Documenting Entries (Priority: P1) 🎯 MVP

**Goal**: Every entry written by the extension carries `kind: "start"` or `kind: "complete"`, and the AI prompt schema documents both shapes with examples.

**Independent Test**: Write a new `.spec-context.json` by advancing a spec through two steps. Inspect the file — confirm every entry has `kind`, start entries have `from`, complete entries omit `from`.

- [X] T003 [US1] Update all four writer helpers in `src/features/specs/specContextWriter.ts`: `setStepStarted` (+`kind:"start"`), `setStepCompleted` (`kind:"complete"`, drop `from`), `setSubstepStarted` (+`kind:"start"`), `setSubstepCompleted` (`kind:"complete"`, drop `from`)
- [X] T004 [P] [US1] Update `SPEC_CONTEXT_SCHEMA` literal in `src/ai-providers/promptBuilder.ts`: add `kind` to `properties` and `required`; remove `from` from `required`; update all three render functions (`renderPreamble`, `renderLifecycleBody`, `renderSpecifyCreationLifecyclePreamble`) to show `kind:"start"`/`kind:"complete"` in every history-entry example and drop the self-loop `from` from completion examples
- [X] T005 [US1] Update `src/features/specs/__tests__/specContextWriter.test.ts`: add assertions that `kind === "start"` on all step/substep start entries and `kind === "complete"` (with no `from` field) on all step/substep complete entries

**Checkpoint**: US1 fully testable — any new `.spec-context.json` entry written by the extension is self-documenting; the AI prompt schema documents both entry shapes

---

## Phase 3: User Story 2 — Legacy Files Load Without Errors (Priority: P1)

**Goal**: `.spec-context.json` files written by older extension versions (no `kind`, self-loop pattern) load transparently and are migrated on next write.

**Independent Test**: Load a pre-existing fixture file (no `kind` field, `from.step === step` entries) through `readSpecContext`. Confirm the returned object has `kind` on every entry. Trigger a write and confirm the persisted file uses the new shape.

- [X] T006 [US2] Add `normalizeHistoryKind(entries: HistoryEntry[]): HistoryEntry[]` pure helper and call it inside `normalizeSpecContext` (after the `transitions`→`history` coercion) in `src/features/specs/specContextReader.ts`. Normalization rule: if entry lacks `kind` — for step entries (`substep == null`): `from.step === step` → `kind="complete"`, delete `from`; else → `kind="start"`. For substep entries: `from.substep === substep` → `kind="complete"`, delete `from`; else → `kind="start"`. Malformed/unrecognizable → `kind="start"` (safe fallback).
- [X] T007 [P] [US2] Update all four test fixtures in `tests/fixtures/spec-context/` (`054.json`, `055.json`, `056.json`, `058.json`) to the new shape: add `kind` to each entry (inferred from the self-loop rule), remove `from` from complete entries
- [X] T008 [US2] Add legacy-normalization tests to `tests/unit/specs/specContext.spec.ts`: (a) entries without `kind` + self-loop → normalized to `kind:"complete"`, `from` absent; (b) entries without `kind` + non-self-loop → normalized to `kind:"start"`, `from` kept; (c) malformed entry (no `kind`, no identifiable pattern) → normalized to `kind:"start"`; (d) entries that already have `kind` → passed through unchanged

**Checkpoint**: US2 fully testable — legacy files load without error, step timing is correct, and a subsequent write produces the new shape

---

## Phase 4: User Story 3 — Behavioral Preservation (Priority: P2)

**Goal**: Step timing derivation, running-step detection, and `lastEntryIsCompletionFor` all drive from `kind`, not from the self-loop pattern, producing identical results.

**Independent Test**: Run the derivation against a new-shape file and a legacy-normalized file. Confirm `startedAt`, `completedAt`, in-progress detection, and substep list are identical in both cases.

- [X] T009 [US3] Replace self-loop check in `lastEntryIsCompletionFor` in `src/features/specs/historyHelpers.ts`: `e.from?.step === step && e.substep == null` → `e.kind === 'complete' && e.substep == null`
- [X] T010 [P] [US3] Replace self-loop checks in `src/features/specs/stepHistoryDerivation.ts`: (a) `lastOwnIsCompletion`: `lastOwn?.from?.step === g.step && lastOwn?.substep == null` → `lastOwn?.kind === 'complete' && lastOwn?.substep == null`; (b) `buildSubsteps` isCompletion skip: `s.from?.substep === s.substep` → `s.kind === 'complete'`; (c) `buildSubsteps` nextIsMatchingCompletion: `next.from?.substep === s.substep` → `next.kind === 'complete'`
- [X] T011 [US3] Update `src/features/specs/__tests__/stepHistoryDerivation.test.ts`: add test cases using new-shape entries (explicit `kind` fields) for `lastOwnIsCompletion`, in-progress detection, and `buildSubsteps` substep pairing; confirm results match legacy-shape equivalents

**Checkpoint**: US3 fully testable — viewer timing, running-step ring, and footer state work identically with new-shape and legacy-normalized files

---

## Phase 5: Polish & Cross-Cutting

**Purpose**: Update demo fixtures and verify the full suite.

- [X] T012 [P] Update `specs/_00_demo-specified/.spec-context.json` to new shape: add `kind` to all history entries, remove `from` from complete entries
- [X] T013 [P] Update `specs/_01_demo-planned/.spec-context.json` to new shape: add `kind` to all history entries, remove `from` from complete entries
- [X] T014 [P] Update `specs/_02_demo-tasked/.spec-context.json` to new shape: add `kind` to all history entries, remove `from` from complete entries
- [X] T015 Run `npm test` from the repository root and confirm all test suites pass with no regressions

---

## Dependencies

```
T001 ──────────────────────────────────────────── T003, T004, T006, T009, T010
T002 (parallel with T001)
T003 ──────────── T005
T004 (parallel with T003 — different file)
T006 ──────────── T007 (fixtures), T008 (tests)
T009 (parallel with T010 — different files)
T010 ──────────── T011
T012, T013, T014 (parallel — different files)
T015 depends on: T005, T007, T008, T011, T012, T013, T014
```

## Parallel Execution Examples

**US1 + US2 in parallel** (after T001):
- Developer A: T003 → T005 (writer + writer tests)
- Developer B: T004 (promptBuilder — separate file)
- Developer C: T006 → T007, T008 (reader normalization + legacy tests)

**US3 + Polish in parallel** (after US1 + US2 pass):
- Developer A: T009, T010 → T011 (disambiguation + tests)
- Developer B: T012, T013, T014 (demo fixtures — independent files)

## Implementation Strategy

**MVP (US1 + Foundational)**: T001 → T002 → T003 → T004 → T005 — delivers the self-documenting writer with updated schema and prompt; minimal risk, no behavior change.

**Full delivery order**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

**Total**: 15 tasks across 5 phases
- Phase 1 (Foundational): 2 tasks
- Phase 2 (US1 — Writer + Prompt): 3 tasks
- Phase 3 (US2 — Legacy Normalization): 3 tasks
- Phase 4 (US3 — Disambiguation): 3 tasks
- Phase 5 (Polish): 4 tasks
