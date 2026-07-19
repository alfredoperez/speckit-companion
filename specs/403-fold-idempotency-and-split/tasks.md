# Tasks — Repeatable folding, and a context script small enough to reason about

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contract**: [contracts/cli.md](./contracts/cli.md)

Two commits. Phases 1 to 3 are commit one (the fold fix, #465). Phases 4 to 6 are commit two (the dispatch fix and the split, #458). The fold fix must be fully green before any code moves.

## Phase 1: Setup

**Wave 1 — independent (different files):**

- [x] **T001** [P] Build the command-line differential harness — runs a matrix of invocations against a given copy of the writer in a fresh temp spec dir and records stdout, stderr, exit code, and the resulting context file for each · `speckit-extension/tests/test_cli_parity.py`
- [x] **T002** [P] Build the idempotency matrix helper — generates a delta-block spec for any ordered combination of verbs against one shared heading, with a **distinct body per verb**, and applies it repeatedly · `speckit-extension/tests/test_living_specs.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** Record the pre-change baseline: run the differential harness against the current writer and store its output as the reference the post-split run must match · `speckit-extension/tests/test_cli_parity.py`

**Checkpoint**: both measuring instruments exist and are calibrated against today's code.

## Phase 2: Foundational — prove the tests fail against today's code

No story work starts until the tests are proven to measure something real.

**Wave 1 — independent (different files):**

- [x] **T004** [P] [US1] Write the table-driven test over all 12 ordered same-heading verb pairs, asserting a second apply to the first apply's output changes nothing; confirm it goes red for exactly the 4 known-broken pairs · `speckit-extension/tests/test_living_specs.py`
- [x] **T005** [P] [US1] Write the unbounded-growth test — apply an add-and-rename delta set 5 times and assert the requirement heading count never grows; confirm it goes red at 5 headings · `speckit-extension/tests/test_living_specs.py`
- [x] **T006** [P] [US1] Write the table-driven test over all 24 ordered same-heading verb triples; confirm it goes red for the 11 known-broken triples · `speckit-extension/tests/test_living_specs.py`
- [x] **T007** [P] [US2] Write the multi-flag dispatch test — one invocation carrying both a decision and a verification records both and reports both; confirm it goes red · `speckit-extension/tests/test_context.py`

**Checkpoint**: every new assertion is verified red against unmodified code. Nothing is being measured by a test that would pass regardless.

## Phase 3: User Story 1 — folding the same change twice leaves the living spec alone (Priority: P1)

**Goal**: every combination of requirement-change verbs is repeatable.

**Independent Test**: apply an add-and-rename delta set five times; heading count stays at one and the text stops changing after the first apply.

### Implementation

- [x] **T008** [US1] Add the rename-map resolver — build the source-to-target map from a delta set's rename entries, resolve chains to a fixed point, and terminate on a cycle · `speckit-extension/scripts/write-context.py`

**⟶ Wait for T008, then:**

- [x] **T009** [US1] Make the add verb rename-aware — resolve each added heading through the map, rewrite the section's heading line to the resolved name, and run the existence check against the resolved name · `speckit-extension/scripts/write-context.py`
- [x] **T010** [US1] Let a same-heading edit supply the added section's body, so an add-plus-edit pair settles on one body instead of alternating · `speckit-extension/scripts/write-context.py`

**⟶ Wait for T009 and T010, then:**

- [x] **T011** [US1] Run the full matrix — all pairs, all triples, the growth test — and confirm every case is now idempotent and the previously-passing cases still pass · `speckit-extension/tests/test_living_specs.py`
- [x] **T012** [US1] Confirm the living-spec eval's repeatability assertion passes for an add-plus-edit fold, which it has been failing for legitimate input · `.claude/skills/eval-speckit-extension/check_living_spec.py`
- [x] **T013** [US1] Drift-proof the fix — revert the change, confirm the new tests go red, restore it, confirm green · `speckit-extension/scripts/write-context.py`

**Checkpoint**: the fold is repeatable for every verb combination. This is commit one, complete and independently reviewable.

## Phase 4: User Story 2 — two pieces of captured information in one call both get recorded (Priority: P1)

**Goal**: no capture flag is silently dropped.

**Independent Test**: one invocation with both a decision and a verification; read the context file and find both.

### Implementation

- [x] **T014** [US2] Split the flag dispatch into an additive capture group that all runs and an exclusive lifecycle group that keeps first-match-wins, keeping the default step update suppressed whenever any capture flag is present · `speckit-extension/scripts/write-context.py`
- [x] **T015** [US2] Make the reporting match — one confirmation line per action taken, so a single-flag call still prints exactly one line · `speckit-extension/scripts/write-context.py`

**⟶ Wait for T014 and T015, then:**

- [x] **T016** [US2] Run the differential harness against the baseline from T003 and confirm every single-flag invocation is unchanged in output, exit code, and resulting context file · `speckit-extension/tests/test_cli_parity.py`

**Checkpoint**: multi-flag calls record everything; single-flag calls are provably unchanged.

## Phase 5: User Story 3 — the context script is small enough to read, spec, and debug (Priority: P2)

**Goal**: the split, with the command line held identical.

### Implementation

- [x] **T017** [US3] Create the shared store module — context read and atomic write, feature-directory resolution, history log accessors, git helpers, and the canonical step and status vocabulary · `speckit-extension/scripts/spec_context.py`

**⟶ Wait for T017, then — independent of each other (different files):**

- [x] **T018** [P] [US3] Move delta parsing and its grammar into its own module, with no file access · `speckit-extension/scripts/spec_deltas.py`
- [x] **T019** [P] [US3] Move the capture writers — decisions, verifications, concerns, expectations, context entries, coverage, step summaries, classification, living-spec name recording, and capture-entry coercion · `speckit-extension/scripts/capture.py`
- [x] **T020** [P] [US3] Move task syncing, task-marker parsing, and checkbox writing · `speckit-extension/scripts/task_sync.py`

**⟶ Wait for T018 through T020, then:**

- [x] **T021** [US3] Move the fold — the delta applier, the rename map, requirement spans, target resolution, the initial scaffold, and the fold entry point · `speckit-extension/scripts/living_spec_fold.py`

**⟶ Wait for T021, then:**

- [x] **T022** [US3] Reduce the original script to the command line, the lifecycle, atomic writing, history migration, journal finish and advance, terminal promotion, and the no-regress guard — importing the new modules and re-exporting every moved name so no caller changes · `speckit-extension/scripts/write-context.py`
- [x] **T023** [US3] Add the five new modules to the runtime packing list · `speckit-extension/scripts/package-manifest.py`

**⟶ Wait for T022 and T023, then:**

- [x] **T024** [US3] Run the packaging gate, the shape-parity check, and the two command-assembly checks, and confirm all are clean · `speckit-extension/scripts/package-manifest.py`
- [x] **T025** [US3] Run the differential harness against the T003 baseline again and confirm the full flag matrix is byte-identical apart from the intended multi-flag fix · `speckit-extension/tests/test_cli_parity.py`
- [x] **T026** [US3] Confirm every external importer still resolves the names it uses through the original script, without editing any of them · `speckit-extension/scripts/derive-from-files.py`

**Checkpoint**: the split is complete, the command line is unchanged, and nothing outside the scripts folder was touched.

## Phase 6: Polish

**Wave 1 — independent (different files):**

- [x] **T027** [P] Add an unreleased changelog entry for each half, written for users · `speckit-extension/CHANGELOG.md`
- [x] **T028** [P] Update the capture-and-timing reference where it describes the writer's shape and the fold's repeatability · `docs/capture-and-timing.md`
- [x] **T029** [P] Update the architecture reference where it describes the extension's scripts · `docs/architecture.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T030** Run the full verification set — the extension's Python suites, the repository compile and test run, shape parity, command emissions, and packaging — and confirm every success criterion in the spec is met · `specs/403-fold-idempotency-and-split/spec.md`

## Dependencies & Execution Order

- **Phase 1 (Setup)** blocks everything: T001 and T002 are independent; T003 needs T001.
- **Phase 2 (Foundational)** needs Phase 1's helpers. Its four tests are mutually independent and must all be proven red before Phase 3 starts.
- **Phase 3 (US1)** needs Phase 2. T008 blocks T009 and T010; those two block T011 through T013. Ends commit one.
- **Phase 4 (US2)** needs Phase 3's commit. T014 and T015 block T016.
- **Phase 5 (US3)** needs Phase 4. T017 blocks the independent trio T018 to T020, which blocks T021, which blocks T022 and T023, which block the verification trio T024 to T026.
- **Phase 6 (Polish)** needs Phase 5. Its three doc tasks are independent; T030 needs all of them.

### Parallel opportunities

- Phase 1 Wave 1: T001 and T002.
- Phase 2 Wave 1: T004, T005, T006, T007 — four separate assertions, two files.
- Phase 5 Wave 2: T018, T019, T020 — three new files with no dependency on each other.
- Phase 6 Wave 1: T027, T028, T029 — three separate documents.
