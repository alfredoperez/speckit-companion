# Tasks: Status shows the decisions a run actually recorded

**Input**: Design documents from `specs/601-status-object-decisions/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/status-output.md](./contracts/status-output.md)

Line format: `- [ ] **T###** [P?] [US#] Description · exact/file/path`. `[P]` marks a task independent of the others in its wave.

## Phase 1: Foundational

Blocks every story: without a recorded baseline there is nothing to prove the fix against.

**Wave 1 — single:**

- [x] **T001** Record the pre-fix baseline — run the status resolver against `specs/599-pipeline-doctor` and against this spec, and capture that both print `Decisions: (none recorded)` while their contexts hold recorded decisions · speckit-extension/scripts/status-context.py

## Phase 2: User Story 1 — See the decisions the run recorded (P1)

**Goal**: A status report on a spec whose decisions were recorded by a real run lists those decisions.

**Independent Test**: Point the resolver at `specs/599-pipeline-doctor` and confirm its recorded decisions appear in the report.

### Tests

**Wave 1 — single:**

- [x] **T002** [US1] Add regression cases to `StatusResolveTests`: object-form decisions render their decision text, string-form decisions still render unchanged, and a list mixing both forms renders every entry in recorded order (FR-001, FR-002, FR-003) · speckit-extension/tests/test_context.py

**⟶ Wait for T002, then:**

- [x] **T003** [US1] Run the new cases against the unmodified reader and confirm they fail — the object-form and mixed cases must be red before the fix lands · speckit-extension/tests/test_context.py

### Implementation

**⟶ Wait for T003, then:**

- [x] **T004** [US1] Widen the decisions reader to accept both stored forms — a non-empty string passes through, an entry object contributes its `decision` text, recorded order preserved, `why`/`rejected` kept reachable rather than discarded (FR-001, FR-002, FR-003, FR-005, FR-006) · speckit-extension/scripts/status-context.py

**⟶ Wait for T004, then:**

- [x] **T005** [US1] Confirm the cases from T002 pass and the resolver now lists the recorded decisions for `specs/599-pipeline-doctor` and for this spec (SC-001, SC-002) · speckit-extension/scripts/status-context.py

**Checkpoint**: User Story 1 is independently functional — real runs' decisions appear in status, hand-authored ones are unchanged.

## Phase 3: User Story 2 — A malformed decision never hides the good ones (P2)

**Goal**: One unusable entry is skipped; the rest still render and the report still exits successfully.

**Independent Test**: Put an entry with no decision text and a non-decision entry into a context alongside good decisions, then confirm the good ones list and the report completes.

### Tests

**Wave 1 — single:**

- [x] **T006** [US2] Add cases for an entry object missing its `decision` key, an entry whose `decision` is blank, and a non-dict non-string entry — each skipped while the remaining decisions still render (FR-004) · speckit-extension/tests/test_context.py

### Implementation

**⟶ Wait for T006, then:**

- [x] **T007** [US2] Verify the widened reader's skip branch covers all three shapes, correcting it if any case is red, and confirm the resolver still exits 0 on every shape of recorded data (FR-004, FR-008, SC-003) · speckit-extension/scripts/status-context.py

**Checkpoint**: User Story 2 is independently functional — degradation is per entry, never per section.

## Phase 4: User Story 3 — The other recorded lists are checked for the same blind spot (P3)

**Goal**: Every reader of the run's other captured lists is accounted for as fixed or verified correct.

**Independent Test**: Enumerate the readers and show each one's verdict.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T008** [P] [US3] Audit the drift reader of `verified[]` for the string-only assumption and fix it if it shares the defect (FR-007) · speckit-extension/scripts/doctor_drift.py
- [x] **T009** [P] [US3] Audit the writers of `expectations[]` and `context[]` and confirm their string-only shape is guaranteed by construction rather than by convention (FR-007) · speckit-extension/scripts/capture.py

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T010** [US3] Record the audit outcome on the spec — one verification naming every reader checked and its verdict (FR-007, SC-004) · specs/601-status-object-decisions/.spec-context.json

**Checkpoint**: User Story 3 is independently functional — the class of bug is closed, not just the instance.

## Phase 5: Polish

**Wave 1 — independent (different files):**

- [x] **T011** [P] Add the user-facing release note under `## [Unreleased]` › Fixed, describing what the user sees rather than the code that changed · speckit-extension/CHANGELOG.md
- [x] **T012** [P] Author the living-spec requirement delta for the `capture-runtime` capability so completion can fold it · specs/601-status-object-decisions/spec.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T013** Validate against the Success Criteria — run the extension's Python suite, the VS Code suite, and every gate (shape parity, node assembly, command build, package manifest, command emissions, command quality) · speckit-extension/tests
- [x] **T014** Run the pipeline doctor on this spec and report every finding verbatim · speckit-extension/scripts/doctor.py

## Dependencies & Execution Order

- **Phase 1 (Foundational)** blocks everything: T001's baseline is what T005 is measured against.
- **Phase 2 (US1)** runs strictly in sequence — T002 → T003 → T004 → T005 — because the failure-direction proof in T003 only means something between authoring the tests and changing the reader, and all four touch the two files under change.
- **Phase 3 (US2)** depends on Phase 2's widened reader: T006 → T007.
- **Phase 4 (US3)** is independent of Phases 2 and 3 and could start any time after Phase 1; its Wave 1 (T008, T009) touches two different files and joins at T010.
- **Phase 5 (Polish)** waits for Phases 2–4: its Wave 1 (T011, T012) touches two different files, then T013 and T014 run last so they validate the finished state.
