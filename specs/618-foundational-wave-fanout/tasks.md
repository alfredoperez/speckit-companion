# Tasks: Implement fans out large Foundational waves

## Phase 1: Setup

None: no new tooling or dependencies.

---

## Phase 2: Foundational (blocks every story)

Files: `speckit-extension/scripts/dispatch-briefs.py`, `speckit-extension/scripts/doctor_checks.py`, `speckit-extension/tests/test_dispatch_briefs.py`

### Tests

**Wave 1 — independent (different files):**

- [x] **T001** [P] Failing tests: `foundational_waves` splits spec 612's Foundational phase into 7, 4, 4, 4, 1 at join lines; `--waves` prints briefs for waves of 4+ with at most four workers per wave and labels `wave: W.N`; a phase of small waves prints `Working inline`; the doctor names an implement that closed without wave check-ins · speckit-extension/tests/test_dispatch_briefs.py

### Implementation

**Wave 1 — independent (different files):**

- [x] **T002** [P] `foundational_waves(tasks_text)` (split at `⟶ Wait` lines and phase headings, task lines `- [ ] **T###**`) and the `--waves` mode printing worker briefs per qualifying wave · speckit-extension/scripts/dispatch-briefs.py
- [x] **T003** [P] `check_dispatch` also covers implement: after implement closes, each qualifying Foundational wave with no `wave: W.` check-in is a warning · speckit-extension/scripts/doctor_checks.py

**Checkpoint**: T001 passes. The doctor and the script share one definition of a wave.

---

## Phase 3: User Story 1 — A big shared foundation is built by several workers (P1)

**Goal**: implement runs `--waves` at the start of Foundational and dispatches what it prints; small waves, Setup and Polish stay inline (User Story 2 is the same rule's other half and lives in these files).

**Independent Test**: the built implement body tells the agent to run `dispatch-briefs.py --waves` for Foundational and no longer says Foundational always stays inline.

Files: `speckit-extension/nodes/implement/implement-exec.md`, `speckit-extension/nodes/implement/_frame.md`, `speckit-extension/nodes/tasks/tasks-doc.md`, `speckit-extension/commands/speckit.companion.implement.md`, `speckit-extension/commands/speckit.companion.tasks.md`, `speckit-extension/tests/golden/commands/`, `speckit-extension/presets/companion-standard/commands/`, `speckit-extension/tests/test_dispatch_threshold.py`

### Tests

- [x] **T004** [US1] Replace the "Setup, Foundational and Polish always stay with you" assertion with one that the built body routes Foundational through `--waves` and keeps Setup and Polish inline; keep the "five or more files" agreement check · speckit-extension/tests/test_dispatch_threshold.py

### Implementation

**Wave 1 — independent (different files):**

- [x] **T005** [P] [US1] Step 3: Setup and Polish stay inline; Foundational runs `dispatch-briefs.py --waves` and dispatches what it prints, crossing each join only after its workers return (reusing step 5's check); stay under 1,000 words · speckit-extension/nodes/implement/implement-exec.md
- [x] **T006** [P] [US1] Outline no longer says the foundational phase is built inline · speckit-extension/nodes/implement/_frame.md
- [x] **T007** [P] [US1] The sentence describing implement's dispatch names Foundational waves too · speckit-extension/nodes/tasks/tasks-doc.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T008** [US1] Rebuild command bodies and presets from nodes and refresh the goldens · speckit-extension/commands/, speckit-extension/presets/companion-standard/commands/, speckit-extension/tests/golden/commands/

**Checkpoint**: T004 passes, shape parity and assembly checks pass, budget `--strict` passes.

---

## Phase 4: User Story 3 — The run's subagent tally expects the new workers (P2)

**Goal**: the tally's implement expectation names each qualifying Foundational wave.

**Independent Test**: the tally run on spec 612 expects three Foundational waves.

Files: `.claude/scripts/subagent-tally.py`, `.claude/commands/fix-tickets.md`

**Wave 1 — independent (different files):**

- [x] **T009** [P] [US3] `expected()` imports `foundational_waves` from `dispatch-briefs.py` and adds the qualifying waves to implement's expectation · .claude/scripts/subagent-tally.py
- [x] **T010** [P] [US3] The tally description names Foundational waves of 4+ tasks · .claude/commands/fix-tickets.md

**Checkpoint**: the tally on `specs/612-living-spec-review` reports 3 qualifying waves.

---

## Phase 5: Polish

Files: `speckit-extension/docs/commands.md`, `speckit-extension/CHANGELOG.md`

**Wave 1 — independent (different files):**

- [x] **T011** [P] Implement's section says Foundational waves of 4+ tasks go to workers · speckit-extension/docs/commands.md
- [x] **T012** [P] Unreleased entry in user-facing voice · speckit-extension/CHANGELOG.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T013** Validate against Success Criteria: spec-kit extension tests, shape parity, node assembly, package manifest, command emissions, budget `--strict` · repository

---

## Dependencies & Execution Order

- **Phase 2 → 3 → 4 → 5.** Foundational blocks everything: the node points at `--waves` and the tally imports the splitter. US3 depends only on Phase 2.
- **Phase 2**: T001 → (T002 ∥ T003).
- **Phase 3**: T004 → (T005 ∥ T006 ∥ T007) → T008.
- **Phase 4**: T009 ∥ T010.
- **Phase 5**: (T011 ∥ T012) → T013.
