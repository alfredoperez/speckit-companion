# Tasks: Living specs — trust the fold

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contracts**: [contracts/living-validate.md](./contracts/living-validate.md) · **Size**: oversized

## Scale note

Twenty-one files across both halves of the repository: the spec-kit scripts and command bodies, the VS Code extension's specs feature, one shared fixture directory read by two test suites, and the registry. The thing to watch is the duplication — the checks exist once in Python and once in TypeScript, and Phase 2 builds them against the same fixtures on purpose so neither can drift. Every user story after that consumes those checks rather than re-deriving them.

---

## Phase 1: Setup

**Wave 1 — the shared fixtures, which both runtimes read (one file each, independent):**

- [x] **T001** [P] Create the shared fixture directory with a README saying both suites read it and that an example only one side reads fails the build · `speckit-extension/tests/fixtures/spec-shape/README.md`
- [x] **T002** [P] Fixture: a clean spec producing no findings · `speckit-extension/tests/fixtures/spec-shape/clean.md`
- [x] **T003** [P] Fixture: a requirement with no scenario under it · `speckit-extension/tests/fixtures/spec-shape/requirement-without-scenario.md`
- [x] **T004** [P] Fixture: a scenario with a condition and no outcome, and one with an outcome and no condition · `speckit-extension/tests/fixtures/spec-shape/scenario-missing-half.md`
- [x] **T005** [P] Fixture: two requirements sharing one heading · `speckit-extension/tests/fixtures/spec-shape/duplicate-requirement.md`
- [x] **T006** [P] Fixture: a `touches` marker whose pattern matches nothing on disk, beside one that matches · `speckit-extension/tests/fixtures/spec-shape/unmatched-touches-glob.md`
- [x] **T007** [P] Fixture: a heading inside a fenced block, which is not a requirement · `speckit-extension/tests/fixtures/spec-shape/heading-in-fence.md`
- [x] **T008** [P] Fixture: requirements appended past the uncovered-files section, which are still requirements · `speckit-extension/tests/fixtures/spec-shape/stranded-requirements.md`
- [x] **T009** [P] Fixture: a feature spec whose delta block names an unregistered capability and modifies a heading the target lacks · `speckit-extension/tests/fixtures/spec-shape/delta-broken.md`
- [x] **T010** [P] Fixture: a feature spec whose deltas are sound · `speckit-extension/tests/fixtures/spec-shape/delta-clean.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T011** Write the expected-findings manifest naming every fixture on disk and the findings each must produce, with severity, code and line · `speckit-extension/tests/fixtures/spec-shape/expected.json`

---

## Phase 2: Foundational

Both check implementations and their tests. **No user-story work begins until this phase is done** — every story consumes these findings.

### Tests

**Wave 2 — one suite per runtime (different files, independent). Both fail first:**

- [x] **T012** [P] Python suite reading the manifest: one case per fixture asserting exact findings, plus the drift guard asserting the manifest names every `.md` on disk · `speckit-extension/tests/test_living_validate.py`
- [x] **T013** [P] TypeScript suite reading the same manifest and iterating it, so an unread fixture fails · `src/features/specs/__tests__/specShapeCheck.test.ts`

### Implementation

**⟶ Wait for Wave 2, then Wave 3 — one implementation per runtime (different files, independent):**

- [x] **T014** [P] [US1] The Python checks and the finding shape: severity, code, path, line, message, fix, capability; fence-aware requirement and scenario parsing reusing the resolver's heading rules · `speckit-extension/scripts/living_validate.py`
- [x] **T015** [P] [US1] The TypeScript twin, pure text-in findings-out with no editor import, sharing the finding shape · `src/features/specs/specShapeCheck.ts`

**⟶ Wait for Wave 3, then:**

- [x] **T016** Confirm both suites pass against the shared manifest and that neither skips a fixture · `speckit-extension/tests/test_living_validate.py`, `src/features/specs/__tests__/specShapeCheck.test.ts`

**Checkpoint**: the six finding kinds are detected identically by both runtimes, pinned to one fixture set.

---

## Phase 3: User Story 1 — A shape check anyone can run (P1)

**Goal**: one command reports every finding across the project's living specs and active feature specs, changes nothing, and always exits successfully.

**Independent Test**: run it against this repository's fourteen capabilities; it prints real findings, exits 0, and leaves the tree clean.

### Tests

- [x] **T017** [US1] Cases for the CLI: human output shape, `--json` object shape, the always-zero exit, the living-specs-off no-op, and an unreadable file reported as a skip rather than a crash · `speckit-extension/tests/test_living_validate.py`

### Implementation

**⟶ Wave 4 — the walk and the two output forms (same file, sequential):**

- [x] **T018** [US1] Walk every registered capability spec and every active feature spec's delta sections, collecting findings ordered by path, line and code · `speckit-extension/scripts/living_validate.py`
- [x] **T019** [US1] The `--json` report object with `enabled`, `checked`, `findings` and `skipped`, modelled on the drift detector's shape · `speckit-extension/scripts/living_validate.py`
- [x] **T020** [US1] The human renderer: severity, location, sentence, indented fix; a one-line clean result; skipped files listed with their reasons verbatim · `speckit-extension/scripts/living_validate.py`
- [x] **T021** [US1] The `--root` and `--json` flags and the always-zero exit · `speckit-extension/scripts/living_validate.py`

**⟶ Wait for Wave 4, then Wave 5 — registration (different files, independent):**

- [x] **T022** [P] [US1] The command body, following the shape of the drift and coverage command bodies · `speckit-extension/commands/speckit.companion.living-validate.md`
- [x] **T023** [P] [US1] Register the command with its description · `speckit-extension/extension.yml`

**⟶ Wait for Wave 5, then:**

- [x] **T024** [US1] Run the command against this repository and confirm it reports real findings and exits 0 · `speckit-extension/scripts/living_validate.py`

**Checkpoint**: User Story 1 is independently functional. The check runs, reports, and never gates.

---

## Phase 4: User Story 2 — A fold that refuses to damage the record (P1)

**Goal**: the fold runs the same check first and refuses, per capability, on an error-level finding, naming it.

**Independent Test**: fold a delta modifying a heading the target does not carry; the fold refuses, names the heading, and the file is byte-for-byte unchanged.

### Tests

- [x] **T025** [US2] Fold cases: refusal on a missing delta heading, refusal on an unregistered capability marker, a warning-only delta applying normally, and one broken capability not blocking a sound sibling · `speckit-extension/tests/test_living_specs.py`

### Implementation

**⟶ Wave 6 — the refusal, in the fold (single task):**

- [x] **T026** [US2] Import the validator in-process, check each capability's deltas before writing, refuse on any error-level finding naming its message and code, and leave that capability's file untouched · `speckit-extension/scripts/living_spec_fold.py`

**Checkpoint**: User Story 2 is independently functional. A delta that would corrupt the record cannot be written.

---

## Phase 5: User Story 3 — A break caught while you are typing it (P2)

**Goal**: saving a spec file publishes the same findings against that file at their lines.

**Independent Test**: save a spec file whose scenario has no outcome; a problem appears at that line and clears once fixed.

### Tests

- [x] **T027** [US3] Diagnostics cases: findings map to the right lines and severities, they clear when fixed, a non-spec file is ignored, and a project with living specs off publishes nothing · `src/features/specs/__tests__/specShapeDiagnostics.test.ts`

### Implementation

**⟶ Wave 7 — the diagnostics layer (single task):**

- [x] **T028** [US3] Own the diagnostic collection, run the checks on save of `*.spec.md`, map severity to diagnostic severity, and clear on fix · `src/features/specs/specShapeDiagnostics.ts`

**⟶ Wait for Wave 7, then:**

- [x] **T029** [US3] Register the listener at activation and dispose the collection on deactivate · `src/extension.ts`

**Checkpoint**: User Story 3 is independently functional. A break surfaces in seconds rather than days.

---

## Phase 6: User Story 4 — A spec cannot be emptied by accident (P2)

**Goal**: a fold that would leave a capability with no requirements refuses unless the registry declares that capability retired.

**Independent Test**: fold a delta removing every requirement from a capability that has not declared retirement; it refuses and names the capability. Declare it and the same fold applies.

### Tests

- [x] **T030** [US4] Retire-guard cases: refusal when undeclared, application when declared, and no effect when the fold removes only some requirements · `speckit-extension/tests/test_living_specs.py`

### Implementation

**⟶ Wave 8 — the registry key, both readers (different files, independent):**

- [x] **T031** [P] [US4] Read the optional `retire` key in the Python registry loader, defaulting to false · `speckit-extension/scripts/resolve-spec-paths.py`
- [x] **T032** [P] [US4] Carry `retire` on the parsed capability in the TypeScript registry reader · `src/features/specs/livingSpecsModel.ts`

**⟶ Wait for Wave 8, then:**

- [x] **T033** [US4] Refuse a fold that would leave the spec with no requirements unless the capability declares retirement, naming the capability in the refusal · `speckit-extension/scripts/living_spec_fold.py`

**Checkpoint**: User Story 4 is independently functional. A spec cannot be emptied without saying so.

---

## Phase 7: Polish

**Wave 9 — documentation and the living-spec fold (different files, independent):**

- [x] **T034** [P] Document the command, the finding kinds and the retire key in the living-specs guide · `docs/living-specs.md`
- [x] **T035** [P] User-facing release note for the spec-kit extension, under Unreleased · `speckit-extension/CHANGELOG.md`
- [x] **T036** [P] User-facing release note for the VS Code extension's save-time diagnostics, under Unreleased · `CHANGELOG.md`
- [x] **T037** [P] Register the new command's name in the spec-kit extension README's command list · `speckit-extension/README.md`

**⟶ Wait for Wave 9, then Wave 10 — fold this feature's own deltas into the capabilities it changed (different files, independent):**

- [x] **T038** [P] Fold the validator, the fold refusal and the retire guard into the capture-runtime capability · `speckit-extension/scripts/capture-runtime.spec.md`
- [x] **T039** [P] Fold the new command's contract into the companion-commands capability · `capabilities/companion-commands/spec.md`
- [x] **T040** [P] Fold the save-time diagnostics and the registry key into the specs capability · `src/features/specs/specs.spec.md`

**⟶ Wait for Wave 10, then:**

- [x] **T041** Validate against the Success Criteria: full Jest suite, full Python suite, both compiles, shape parity, command emissions, and drift back to zero · `package.json`, `speckit-extension/tests/`

---

## Dependencies & Execution Order

Setup → Foundational → User Story 1 → User Story 2 → User Story 3 → User Story 4 → Polish.

- **Setup**: Wave 1's ten fixtures are independent of each other; Wave 2's manifest waits on all of them, because it names every file on disk.
- **Foundational**: the two test suites (Wave 2) come before the two implementations (Wave 3), which are independent of each other; Wave 3 blocks everything after it.
- **User Story 1**: Wave 4's four tasks share one file and run in order; Wave 5's command body and registration are independent and wait on Wave 4.
- **User Story 2**: one wave, one file, waiting on Foundational.
- **User Story 3**: the diagnostics module (Wave 7) blocks its registration at activation.
- **User Story 4**: the two registry readers (Wave 8) are independent and both block the fold's guard.
- **Polish**: the four documents (Wave 9) are independent; the three capability folds (Wave 10) wait on the work being finished; the suite run is last and validates everything.

Stories 3 and 4 are genuinely independent of each other and of Story 2 once Foundational is done — only their shared consumption of the checks orders them here.
