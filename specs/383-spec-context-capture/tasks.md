# Tasks: Capture the full reasoning trail in the spec context

**Feature**: 383-spec-context-capture · **Plan**: [plan.md](./plan.md) · **Contract**: [contracts/write-context-cli.md](./contracts/write-context-cli.md)

## Phase 1: Setup

No setup tasks — no new tooling, dependencies, or scaffolding; the change lands entirely in existing files plus one new test module.

## Phase 2: Foundational (blocks all stories)

**Wave 1 — independent (different files):**

- [x] **T001** [P] Declare the new fields and entity types (`intent`, `expectations`, `verified`, `coverage`, `classification`; widen `decisions` to `DecisionEntry[] | string[]`; `VerificationEntry`, `CoverageEntry`, `ClassificationEntry`, `StepSummaryEntry`) · `src/core/types/specContext.ts`
- [x] **T002** [P] Declare the same fields in the JSON schema (all optional, additive) · `src/core/types/spec-context.schema.json`
- [x] **T003** [P] Add the shared writer helpers — JSON-or-plain-text entry coercion keyed on an identity field, and an ordered de-duped list append (clone of the living-specs merge) · `speckit-extension/scripts/write-context.py`

## Phase 3: User Story 1 — Capture the goal and non-goals (P1)

**Goal**: `intent` + `expectations` recorded at specify complete. **Independent Test**: run specify; context carries both.

### Implementation

**Wave 1:**

- [x] **T004** [US1] Add `--expectation` (repeatable, de-duped append via T003 helpers) + dispatch branch, with pytest cases for append/de-dupe/idempotency and the `--set intent=…` path · `speckit-extension/scripts/write-context.py`, `speckit-extension/tests/test_capture_fields.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T005** [US1] Emit `--set intent=…` + one `--expectation` per non-goal at specify completion in the specify node fragment; regenerate assembled commands · `speckit-extension/nodes/specify/`, `speckit-extension/commands/speckit.companion.specify.md`

**Checkpoint**: specify alone now persists the goal and the out-of-scope fence.

## Phase 4: User Story 2 — Capture decisions and verifications (P1)

**Goal**: `decisions[]` (with why/rejected) and `verified[]` (what/result/command/warnings) persisted. **Independent Test**: run plan + implement; both lists non-empty.

### Implementation

**Wave 1 — independent (same file, different handlers — sequential):**

- [x] **T006** [US2] Add `--decision` (JSON-or-text, identity `decision`) + dispatch + pytest cases (JSON obj, bare text wrap, de-dupe on reworded why) · `speckit-extension/scripts/write-context.py`, `speckit-extension/tests/test_capture_fields.py`
- [x] **T007** [US2] Add `--verified` (identity `what`) and `--concern` (identity `note`) + dispatch + pytest cases · `speckit-extension/scripts/write-context.py`, `speckit-extension/tests/test_capture_fields.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T008** [US2] Emit `--decision` at plan completion and `--verified`/`--decision`/`--concern` at implement close in the plan/implement node fragments; regenerate · `speckit-extension/nodes/plan/`, `speckit-extension/nodes/implement/`, assembled commands

**Checkpoint**: the why behind the code and the proof it works survive the session.

## Phase 5: User Story 3 — Requirement→task→test coverage (P2)

**Goal**: `coverage{}` answers "is FR-X tested?" from the context alone. **Independent Test**: run tasks + implement; entries carry tasks then tests.

### Implementation

**Wave 1:**

- [x] **T009** [US3] Add `--coverage-req <id>` with `--tasks <csv>` / `--tests <csv>` as a keyed non-destructive upsert (clone `_upsert_task_summary`) + pytest cases (two-phase merge, tests-only fill keeps tasks) · `speckit-extension/scripts/write-context.py`, `speckit-extension/tests/test_capture_fields.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T010** [US3] Emit req→tasks at tasks completion and req→tests at implement close in the tasks/implement node fragments; regenerate · `speckit-extension/nodes/tasks/`, `speckit-extension/nodes/implement/`, assembled commands

**Checkpoint**: coverage is queryable without re-reading tasks.md.

## Phase 6: User Story 4 — Fill the existing unwritten slots (P2)

**Goal**: `approach`, `concerns`, `step_summaries`, `last_action`, `classification` reliably populated. **Independent Test**: end-to-end run populates all five.

### Implementation

**Wave 1:**

- [x] **T011** [US4] Add `--step-summary` (keyed by `--step`, JSON-or-text on `summary`) and `--classification <json>` (verdict required, exit 2 on unparseable) + dispatch + pytest cases · `speckit-extension/scripts/write-context.py`, `speckit-extension/tests/test_capture_fields.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T012** [US4] Emit `--classification` at the specify sizing step, `--set approach=…` + `--step-summary` at plan/tasks/implement closes, `--set last_action=…` at step closes, and the skip-marker `--set last_action="<what> evaluated — skipped (<why>)"` at the living-specs/hook gates; regenerate · `speckit-extension/nodes/` (specify/plan/tasks/implement fragments), assembled commands

**Checkpoint**: every declared-but-empty slot now has a reliable writer (US5's skip-markers also land here).

## Phase 7: User Story 5 — Keep the timeline honest (P3)

### Implementation

**Wave 1:**

- [x] **T013** [US5] Fix step-duration derivation to compute spans only between `by: 'extension'` boundaries (other authors order events, never produce durations) + jest case with a mixed-author history · `src/core/types/specContext.ts`, matching test under `src/`/`tests/`

**Checkpoint**: no analytic can mistake a journaled timestamp for a measured duration.

## Phase 8: Polish

**Wave 1 — independent (different files):**

- [x] **T014** [P] Update the capture docs: new fields + emission points in the WHEN map, the timing caveat, the schema reference · `docs/capture-and-timing.md`, `docs/spec-context-schema.md`
- [x] **T015** [P] Release notes + version: spec-kit extension README/CHANGELOG + `extension.yml` version bump; root CHANGELOG entry for the type/derivation change · `speckit-extension/README.md`, `speckit-extension/CHANGELOG.md`, `speckit-extension/extension.yml`, `CHANGELOG.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T016** Full verification: pytest (`speckit-extension/tests/`), `npm test`, `npm run compile`, and the node-assembly parity check; validate against the spec's Success Criteria · repo root

## Dependencies & Execution Order

- **Setup → Foundational → US1 → US2 → US3 → US4 → US5 → Polish.** Foundational (T001–T003, one parallel wave) blocks everything: every flag builds on T003's helpers, every emission on T001/T002's types.
- Story phases each follow **flag-then-emit**: the writer flag (+tests) lands first, then the node-fragment emission that calls it (T004⟶T005, T006/T007⟶T008, T009⟶T010, T011⟶T012).
- T013 is independent of the Python work after Foundational (touches only the TS derivation) — it can interleave with any story phase.
- Polish: T014/T015 in parallel, then T016 as the final gate.
