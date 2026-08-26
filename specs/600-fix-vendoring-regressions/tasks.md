# Tasks: Fix 0.20.2 Vendoring Regressions

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md)
**Tests**: Included — the spec's FR-007 pins each behavioral fix with a regression test.

## Phase 1: Setup

No setup work — the fixes land in existing modules with existing test suites.

## Phase 2: Foundational

No foundational work — the four fixes are independent of each other.

## Phase 3: User Story 1 — Relocation never strands the project half-moved (P1)

**Goal**: A relocation that fails partway rolls back every applied move, leaving files and registry as they started.

**Independent Test**: Relocate three capabilities where the third move raises; the tree is exactly as it started.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US1] Restore the caller-owned `done` parameter on `_apply_moves` (append as each move lands, no return value), move the call inside the `try` in `relocate()`, and restore the docstring line explaining why · speckit-extension/scripts/relocate-capability.py
- [x] **T002** [P] [US1] Regression test: a 3-move relocation whose 3rd move raises rolls back the first two and leaves the tree and registry as they started · speckit-extension/tests/test_living_specs.py

**Checkpoint**: US1 is independently verifiable — the new test fails on the old shape and passes on the restored one.

## Phase 4: User Story 2 — Re-deriving never duplicates history (P2)

**Goal**: `derive()` appends a step's `start` entry at most once, matching `write-context.update_context`.

**Independent Test**: Derive twice at one step; the record carries one start entry.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T003** [P] [US2] Restore the `if not wc._has_step_start(log, step, None):` guard around the start append, with its one-line comment naming the sibling guard · speckit-extension/scripts/derive-from-files.py
- [x] **T004** [P] [US2] Regression test: deriving twice at the same step produces exactly one start entry in history · speckit-extension/tests/test_context.py

**Checkpoint**: US2 is independently verifiable via the new derive-twice test.

## Phase 5: User Story 3 — Registry writes are atomic (P2)

**Goal**: `_write_registry` writes via temp file + rename, matching `relocate-capability._write_config` exactly.

**Independent Test**: The registry write goes through a temporary file renamed into place.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T005** [P] [US3] Restore the temp-file + `os.replace` write in `_write_registry`, byte-matching the relocation writer's tail, with its one-line comment · speckit-extension/scripts/register-capability.py
- [x] **T006** [US3] Regression test: the registry write goes through a temp file and an interrupted write cannot truncate the registry · speckit-extension/tests/test_living_specs.py

**⟶ Wait — T006 edits the same file as T002; run it after Phase 3's wave is folded.**

**Checkpoint**: US3 is independently verifiable via the atomic-write test.

## Phase 6: User Story 4 — Implement command steps read 1–7 (P3)

**Goal**: The assembled implement command's final step is numbered 7; the fix lives in the source node.

**Independent Test**: The assembled body's top-level steps read 1, 2, 3, 4, 5, 6, 7.

### Implementation

- [x] **T007** [US4] Renumber the final mark-complete step `5.` → `7.` · speckit-extension/nodes/implement/complete.md

**⟶ Wait for T007 to finish, then:**

- [x] **T008** [US4] Re-assemble the command bodies (`assemble-nodes.py`, then `build-commands.py`) so the generated implement body carries the fix · speckit-extension/commands/speckit.companion.implement.md

**⟶ Wait for T008 to finish, then:**

- [x] **T009** [US4] Re-bless the frozen golden baseline (`capture-golden.py`) as its own clearly-visible change · speckit-extension/tests/golden/

**Checkpoint**: US4 is verifiable by listing the assembled body's step numbers; parity gates pass.

## Phase 7: Polish

**Wave 1 — independent (different files):**

- [x] **T010** [P] Changelog entry under `## [Unreleased]` in user-facing release-note voice, no version bump, no internal symbol names · speckit-extension/CHANGELOG.md

**⟶ Wait for every prior phase, then:**

- [x] **T011** Validate against Success Criteria: full Python suite, `npm run compile && npm test`, and every CI gate (shape parity, assemble/build checks, package manifest, command emissions, quality gate), plus the doctor on this spec · speckit-extension/

## Dependencies & Execution Order

- Phases 3, 4, 5, and 6 are mutually independent; Phase 7's T011 waits for all of them.
- Phase 3: one wave (T001 ∥ T002). Phase 4: one wave (T003 ∥ T004). Phase 5: T005, then T006 (same test file as T002). Phase 6: T007 → T008 → T009, strictly ordered (source node → regenerate → re-bless). Phase 7: T010 anytime; T011 last.
