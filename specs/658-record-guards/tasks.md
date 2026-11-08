# Tasks: The run record keeps its promises

## Phase 1: Foundational

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US1] `status_moves_back()` and the damaged-record copy in `read_ctx` · apps/speckit-extension/scripts/spec_context.py
- [x] **T002** [P] [US1] Refuse a backward same-step status and say so · apps/speckit-extension/scripts/write-context.py

**⟶ Wait for Wave 1 to finish, then:**

## Phase 2: Tests

- [x] **T003** [P] [US1] [US2] Unit tests: planned then planning stays planned; truncated, `[]` and empty records kept aside; a reader moves nothing · apps/speckit-extension/tests/test_record_guards.py
- [x] **T004** [P] [US3] Property tests from the pdd-lite seed, unittest + Hypothesis, skip without it · apps/speckit-extension/tests/test_record_properties.py

## Phase 3: Polish

- [x] **T005** CI slow-lane step installs Hypothesis and runs the property file · .github/workflows/ci.yml
- [x] **T006** Changelog: fold into the run-record line · apps/speckit-extension/CHANGELOG.md
- [x] **T007** Validate: Python suite, property file, build check, tsc

T001 and T002 block the tests; T005 needs T004.
