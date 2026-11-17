# Tasks: Hands-off runs also work on spec-kit's workflow engine

## Phase 1: Foundational

Files: `apps/speckit-extension/scripts/status-context.py`

- [x] **T001** [US1] Add `--size`: print the recorded size of the spec `.specify/feature.json` points at, or nothing, always exit 0 · apps/speckit-extension/scripts/status-context.py

## Phase 2: User Story 1 + 2 - Routing and resumable gates (P1)

Files: `apps/speckit-extension/workflows/speckit-companion.workflow.yml`, `apps/speckit-extension/tests/test_workflow_engine.py`, `apps/speckit-extension/tests/test_workflow_integrity.py`

**Goal**: the engine routes on the recorded size and every gate passes headless.

**Independent Test**: `specify workflow run` in a sandbox pauses at `review-spec` for a normal spec and skips gates for a simple one.

### Tests

**Wave 1 — independent (different files):**
- [x] **T002** [P] [US1] FR-001/FR-003: `status-context.py --size` prints `simple` for a recorded simple spec, nothing for a missing record or feature.json · apps/speckit-extension/tests/test_workflow_engine.py
- [x] **T003** [P] [US1] FR-002/FR-007: the switch reads `steps.<shell step>.output.stdout` and its case keys equal the folding or warning verdicts in `nodes/specify/_order.yml`; FR-004 no `scope`; FR-005 each gate has its own `verdict_input` with enum `""/approve/reject` · apps/speckit-extension/tests/test_workflow_integrity.py

### Implementation

**⟶ Wait for Wave 1 to finish, then:**
- [x] **T004** [US1] [US2] Replace `classify` with the `size` shell step, switch on its stdout, drop `scope`, add `review_spec`/`review_plan` inputs and bind every gate, document the default route · apps/speckit-extension/workflows/speckit-companion.workflow.yml

**Checkpoint**: the workflow routes and resumes on the engine.

## Phase 3: User Story 3 - Registration (P2)

Files: `apps/speckit-extension/scripts/doctor_checks.py`, `apps/speckit-extension/scripts/doctor.py`, `apps/speckit-extension/commands/speckit.companion.doctor.md`, `apps/speckit-extension/tests/test_doctor_workflow.py`

### Tests

- [x] **T005** [US3] FR-006: the doctor reports a missing and a stale registration with the add command, nothing when current; `--fix` runs `specify workflow add` and prints the command when `specify` is absent · apps/speckit-extension/tests/test_doctor_workflow.py

### Implementation

**⟶ Wait for T005, then Wave 2 — independent (different files):**
- [x] **T006** [P] [US3] `check_workflow(root)` and `register_workflow(root)` · apps/speckit-extension/scripts/doctor_checks.py
- [x] **T007** [P] [US3] Name the `workflow` check and `--fix` in the doctor body · apps/speckit-extension/commands/speckit.companion.doctor.md

**⟶ Wait for Wave 2, then:**
- [x] **T008** [US3] Wire the check into `examine` and add `--fix` · apps/speckit-extension/scripts/doctor.py

**Checkpoint**: after the fix, `specify workflow list` shows the Companion workflow.

## Phase 4: User Story 4 - Site docs (P3)

Files: `apps/website/src/content/docs/docs/customize/your-own-workflow.mdx`

- [x] **T009** [US4] FR-008: document `specify workflow run`, `specify workflow resume <run id> --input review_spec=approve`, the doctor fix and the permission note · apps/website/src/content/docs/docs/customize/your-own-workflow.mdx

## Phase 5: Polish

- [x] **T010** [P] Changelog line under [Unreleased] · apps/speckit-extension/CHANGELOG.md
- [x] **T011** Rebuild and run `build.py --check`, `package-manifest.py --check`, `check-command-emissions.py`, `instruction-budget.py --strict`, the extension's Python tests, and `npm run test:all` against the Success Criteria
- [x] **T012** Sandbox: engine run pauses at a gate and `resume --input` continues; a simple spec skips plan, tasks and gates; compare histories with an auto run (SC-001..SC-004, FR-009)

## Dependencies & Execution Order

Phase 1 → Phase 2 (T002, T003 → T004) → Phase 3 (T005 → T006, T007 → T008) → Phase 4 → Polish (T010 with any, T011 → T012).
