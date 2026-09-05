# Tasks: The health check reports what it cannot currently see

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Issue**: [#622](https://github.com/alfredoperez/speckit-companion/issues/622) · **Size**: normal

Three independent wirings, one per user story. Stories 1 and 2 are both `doctor_checks.py` edits and share no lines; story 3 is a build-time change to how commands are assembled and touches nothing the first two touch.

---

## Phase 1: Setup

No setup tasks. Everything lands in existing files in the `speckit-extension` layout, and the test suite already runs.

---

## Phase 2: Foundational

No foundational tasks. Every record this feature reads (`.trace-lost`, `verified[]`, `history[]`) already exists with a writer, and the shared helpers (`_lost_entries`, `_no_record`, `run_check`) already ship. There is no blocking infrastructure to build before the stories start.

---

## Phase 3: User Story 1 — A run that could not write its trace at all still leaves evidence (P1)

**Goal**: `check_trace` consults the unrecorded-calls marker before it decides the spec has no trace evidence, so a run whose trace file was never created still reports the calls it could not record.

**Independent Test**: Make a spec directory unwritable for new files but leave an existing capture path usable, run a capture, then run the health check. It names the unrecorded calls instead of reporting that nothing has been captured.

### Tests

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US1] Add a failing test: marker with entries and no trace file → `check_trace` returns status `ran` and exactly one `problem` finding whose detail contains a marker line verbatim (FR-002) · `speckit-extension/tests/test_doctor.py`
- [x] **T002** [P] [US1] Add a failing test: no marker and no trace file → `check_trace` still returns the `skipped` status with its current wording, and no findings (FR-003, FR-008) · `speckit-extension/tests/test_doctor.py`

**⟶ Wait for Wave 1 to finish, then:**

### Implementation

- [x] **T003** [US1] In `check_trace`, hoist the `_lost_entries(feature_dir)` read above the `read is None` early return and emit the existing lost finding on that path; keep the trace-present branch byte-identical, including the `{"lost": [...]}` payload capped at five entries (FR-001, FR-002, FR-003) · `speckit-extension/scripts/doctor_checks.py`

**Checkpoint**: A run whose trace file could not be created now reports its unrecorded calls. Story 1 is independently functional and testable — `pytest speckit-extension/tests/test_doctor.py` passes with T001 and T002 green.

---

## Phase 4: User Story 2 — A step that closed without running anything says so (P1)

**Goal**: A new `verification` check reports an implement step that reached completion with nothing recorded in `verified[]`, and reports no-record rather than a problem when there is nothing to read.

**Independent Test**: Close an implement step on a spec whose `verified[]` is empty, run the health check, confirm the finding appears. Record one verification, re-run, confirm it does not.

### Tests

**Wave 1 — independent (different files):**

- [x] **T004** [P] [US2] Add failing tests for `check_verification`: implement complete + empty/absent/non-list `verified[]` → one `problem` finding; implement complete + one entry → no findings; no implement complete → `skipped` no-record; missing or unreadable context → the shared `_no_record` skip (FR-004, FR-005, FR-008) · `speckit-extension/tests/test_doctor.py`

**⟶ Wait for Wave 1 to finish, then:**

### Implementation

**Wave 2 — independent (different files):**

- [x] **T005** [P] [US2] Add `check_verification(feature_dir, ctx)` after `check_completion`: `_no_record` guard first, then scan `history[]` for a step-level `complete` on `implement`, then judge `verified[]` non-empty; treat a non-list as empty, never as an error (FR-004, FR-005, FR-008) · `speckit-extension/scripts/doctor_checks.py`
- [x] **T006** [P] [US2] Update any test asserting the check count or the full `CHECKS` list so the new entry does not break the report-shape assertions · `speckit-extension/tests/test_doctor.py`

**⟶ Wait for Wave 2 to finish, then:**

- [x] **T007** [US2] Register `verification` in `CHECKS` between `completion` and `template`, and dispatch it through the existing `run_check(report, "verification", lambda: _via("doctor_checks", "check_verification", feature_dir, ctx))` so a raised exception stays contained (FR-004, FR-008) · `speckit-extension/scripts/doctor.py`

**Checkpoint**: A step that closes having executed nothing produces exactly one finding naming it. Story 2 is independently functional and testable — the doctor runs end to end with the new check registered.

---

## Phase 5: User Story 3 — A step's recorded time contains the work it claims (P2)

**Goal**: The step-start stamp moves out of the content nodes into a shared `step-start` part fenced at the top of every step frame, above the hooks fence, so a step's window opens before anything runs on its behalf.

**Independent Test**: Run a full pipeline and compare each step's recorded start against the earliest evidence of that step's work. The gap is dispatch latency, not minutes of unrecorded work.

### Tests

**Wave 1 — independent (different files):**

- [x] **T008** [P] [US3] Add a failing test: every step frame (`specify`, `plan`, `tasks`, `implement`) carries the `step-start` part fence, and it sits above the `speckit-hooks` fence (FR-006) · `speckit-extension/tests/test_node_boundaries.py`
- [x] **T009** [P] [US3] Add a failing test: a second step-level `start` for the same `(step, substep)` pair appends no entry and the earlier timestamp stands (FR-007) · `speckit-extension/tests/test_context.py`

**⟶ Wait for Wave 1 to finish, then:**

### Implementation

- [x] **T010** [US3] Create the shared part: the step-agnostic "stamp this step's start" block, written in the same `let <step> be this command's phase` idiom `speckit-hooks` uses, instructing the `write-context.py --step <step> --status <status> --kind start --by extension` call (FR-006) · `speckit-extension/presets/_parts/step-start.md`

**⟶ Wait for T010 to finish, then:**

**Wave 3 — independent (different files):**

- [x] **T011** [P] [US3] Fence `step-start` above the `speckit-hooks` fence · `speckit-extension/nodes/specify/_frame.md`
- [x] **T012** [P] [US3] Fence `step-start` above the `speckit-hooks` fence · `speckit-extension/nodes/plan/_frame.md`
- [x] **T013** [P] [US3] Fence `step-start` above the `speckit-hooks` fence · `speckit-extension/nodes/tasks/_frame.md`
- [x] **T014** [P] [US3] Fence `step-start` above the `speckit-hooks` fence · `speckit-extension/nodes/implement/_frame.md`

**⟶ Wait for Wave 3 to finish, then:**

**Wave 4 — independent (different files):**

- [x] **T015** [P] [US3] Drop the now-duplicated start stamp from the plan gather node, leaving the substep boundaries intact · `speckit-extension/nodes/plan/gather-context.md`
- [x] **T016** [P] [US3] Drop the now-duplicated start stamp from the tasks node · `speckit-extension/nodes/tasks/tasks-doc.md`
- [x] **T017** [P] [US3] Drop the now-duplicated start stamp from the implement node · `speckit-extension/nodes/implement/implement-exec.md`
- [x] **T018** [P] [US3] Drop the now-duplicated start stamp from the specify resolve nodes; leave the fast-path folds in `specify/finalize.md` and their explicit `plan`/`tasks` starts untouched · `speckit-extension/nodes/specify/resolve-dir.md`, `speckit-extension/nodes/specify/resolve-dir-git.md`
- [x] **T019** [P] [US3] Drop the now-duplicated start stamp from the auto resolve node · `speckit-extension/nodes/auto/resolve-dir.md`

**⟶ Wait for Wave 4 to finish, then:**

- [x] **T020** [US3] Regenerate the frozen command captures (`python3 speckit-extension/scripts/capture-golden.py`) so `check-shape-parity`'s golden assertion passes, and confirm the part text is byte-identical across all four commands · `speckit-extension/tests/golden/commands/`

**Checkpoint**: Every step stamps its start before its hooks run. Story 3 is independently functional and testable — the parity gate and the golden captures agree.

---

## Phase 6: Polish

**Wave 1 — independent (different files):**

- [x] **T021** [P] Add the two new checks to the doctor's documented check list so the report's surface matches what it runs · `docs/` (the doctor reference) and `speckit-extension/README.md`
- [x] **T022** [P] Write the user-facing release note under `## [Unreleased]`, in release-notes voice: the health check now reports unrecorded calls when the trace file is missing, and names a step that closed having verified nothing · `speckit-extension/CHANGELOG.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T023** Validate against the Success Criteria: run `pytest speckit-extension/tests/` and the shape-parity gate, then run the doctor on a clean spec and confirm zero new findings appear (SC-001 through SC-005) · repository root

---

## Dependencies & Execution Order

**Phase order**: Setup (empty) → Foundational (empty) → US1 → US2 → US3 → Polish. The three stories share no files, so they can also run in any order or together; the sequence above is priority order, not a hard dependency.

- **US1**: T001/T002 (tests, parallel) ⟶ T003 (the `check_trace` edit).
- **US2**: T004 (tests) ⟶ T005/T006 (the new check + the count assertions, parallel) ⟶ T007 (registration, which depends on the function existing).
- **US3**: T008/T009 (tests, parallel) ⟶ T010 (the part, which every fence references) ⟶ T011–T014 (four frames, parallel) ⟶ T015–T019 (five node cleanups, parallel) ⟶ T020 (golden regeneration, which must see the final assembled text).
- **Polish**: T021/T022 (docs, parallel) ⟶ T023 (the single validation run, last).

T005 and T003 both edit `doctor_checks.py` and are therefore never in the same wave, though they sit in different phases and touch different functions.
