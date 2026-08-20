# Tasks: Footer next step matches the pending step

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Issue**: [#582](https://github.com/alfredoperez/speckit-companion/issues/582)
**Size**: normal

## Phase 1: Setup

No setup work. The module, its test file, and the workflow constants all already exist; nothing new needs scaffolding.

## Phase 2: Foundational

Nothing blocks the stories. Both defects live in one module and are independent of each other, so each story can be built and verified on its own.

## Phase 3: User Story 1 — A freshly specified Companion spec offers Plan next (P1)

**Goal**: The footer names the planning step on a spec whose only documents are the specification and its quality checklist.

**Independent Test**: Stage `spec.md` and `checklists/requirements.md` in a temp directory, build a context at `currentStep: specify` / `status: specified`, run it through `synthesizeCustomProgress` with the SpecKit Companion steps, and assert the footer's approve action reads `Plan`.

### Tests

**Wave 1 — the failing test comes first (one file):**

- [x] **T001** [US1] Add a failing regression test that stages `spec.md` + `checklists/requirements.md` on disk, runs the real `stepHasOutput` through `synthesizeCustomProgress` with `COMPANION_WORKFLOW.steps`, and asserts `getFooterActions` yields `approve:Plan` — confirm it fails on the current code before changing anything · `src/features/specs/__tests__/customWorkflowProgress.test.ts`

### Implementation

**⟶ Wait for T001 to fail, then:**

- [x] **T002** [US1] Front-load `isCustomWorkflow` with an exact step-name-sequence match against `DEFAULT_WORKFLOW.steps` and `COMPANION_WORKFLOW.steps`, computed once at module load, returning `false` on a match and falling through to the existing `STEP_NAMES` rule otherwise · `src/features/specs/customWorkflowProgress.ts`

**⟶ Wait for T002, then:**

- [x] **T003** [US1] Confirm T001 now passes and the existing `synthesizeCustomProgress` suite is untouched · `src/features/specs/__tests__/customWorkflowProgress.test.ts`

**Checkpoint**: A freshly specified SpecKit Companion spec offers Plan in the footer. FR-001 and FR-003 are satisfied and demonstrable.

## Phase 4: User Story 2 — The quality checklist is never mistaken for planning output (P2)

**Goal**: A document inside a folder a step claims stops counting as a later step's related document.

**Independent Test**: With a developer-authored pipeline whose early step declares a sub-folder, place a document only inside that sub-folder; no later step reads as having produced output.

### Tests

**Wave 1 — independent (different concerns, same file, so sequential):**

- [x] **T004** [US2] Add a failing test: a step with `includeRelatedDocs` must read `false` when the only extra document lives under an earlier step's `subDir` · `src/features/specs/__tests__/customWorkflowProgress.test.ts`

**⟶ Wait for T004, then:**

- [x] **T005** [US2] Add the paired guard test: a loose unclaimed `.md` in the spec directory still reads `true`, and a step that owns its own `subDir` still reads `true` from its own folder · `src/features/specs/__tests__/customWorkflowProgress.test.ts`

### Implementation

**⟶ Wait for T004–T005 to fail, then:**

- [x] **T006** [US2] Collect every step's `subDir` into a claimed-directory set in `relatedDocsPresent` and prune matching directories during the recursive scan instead of descending into them · `src/features/specs/customWorkflowProgress.ts`

**Checkpoint**: Sub-folder documents are attributed only to the step that owns them. FR-002 is satisfied.

## Phase 5: User Story 3 — Workflows the developer wrote themselves keep advancing (P2)

**Goal**: Prove the fix is additive — nothing that reconstructed progression before stops doing so.

**Independent Test**: The pre-existing ticket-shaped and GSD-shaped suites pass with no edits.

### Tests

**Wave 1 — independent (different files):**

- [x] **T007** [P] [US3] Run the full `customWorkflowProgress` suite unmodified and confirm every pre-existing developer-authored-pipeline test still passes; any edit needed to an existing test means the fix is not additive · `src/features/specs/__tests__/customWorkflowProgress.test.ts`
- [x] **T008** [P] [US3] Add an explicit additivity assertion: `isCustomWorkflow` stays `true` for a pipeline that uses lifecycle names plus a `mark-complete` step but is not the shipped SpecKit Companion sequence · `src/features/specs/__tests__/customWorkflowProgress.test.ts`

**Checkpoint**: FR-004 is satisfied with a test that would catch an over-broad exemption.

## Phase 6: Verification — shorts audit and fresh-install validation

**Goal**: Discharge the two evidence-only requirements. No product code changes here.

**Wave 1 — independent (no shared state):**

- [x] **T009** [P] Audit both distributions for a "shorts" command, skill, or asset — search the working tree, `speckit-extension/`, and the packaged artifact — and record the result as evidence for FR-006 · `specs/582-footer-next-step/verification.md`
- [x] **T010** [P] Create a disposable sandbox under `examples/`, initialize it with the real `specify` command-line tool (a genuine install, never a copy of an existing installation), and confirm the initialization output · `examples/582-fresh-install/`

**⟶ Wait for T010, then:**

- [x] **T011** Run the constitution step in the fresh sandbox and confirm it produces a constitution · `examples/582-fresh-install/`

**⟶ Wait for T011, then:**

- [x] **T012** Install the companion spec-kit extension into the fresh sandbox through its own installer, then run the status flow and confirm a recorded run appears with a readable current step and status — record the evidence for FR-007 · `specs/582-footer-next-step/verification.md`

**Checkpoint**: FR-006 and FR-007 are satisfied with recorded evidence.

## Phase 8: Status and resume dispatch the Companion family (found during T012)

**Goal**: A spec recorded as running the Companion workflow gets Companion commands from the status resolver, not stock ones.

**Why it is here**: T012 surfaced it. The resolver selects the Companion command table on the legacy per-spec `profile` field holding `turbo`, but that field was retired — nothing writes it, and the writer records `workflow: companion` instead. The Companion table is therefore unreachable, so `/speckit.companion.status` reports the stock next command and `/speckit.companion.resume` dispatches the stock pipeline. Same failure as the reported bug, one surface over.

**Independent Test**: Resolve status for a context carrying `workflow: companion` and assert the next command is the Companion one; resolve one carrying neither and assert it is still the stock one.

### Tests

**Wave 1 — one file:**

- [x] **T016** Add failing tests: a `workflow: companion` context resolves Companion next-commands at every step, a stock context still resolves stock ones, and a legacy `profile: turbo` context still resolves Companion ones · `speckit-extension/tests/test_context.py`

### Implementation

**⟶ Wait for T016 to fail, then:**

- [x] **T017** Select the command family from the recorded `workflow` field, keeping `profile: turbo` as a legacy fallback, and reinstall the extension locally so the working copy matches · `speckit-extension/scripts/status-context.py`

**Checkpoint**: Status and resume both speak the Companion command family for Companion specs.

## Phase 7: Polish

**Wave 1 — independent (different files):**

- [x] **T013** [P] Add the user-facing changelog entry under `## [Unreleased]`, written as release notes with no internal file or symbol names · `CHANGELOG.md`
- [x] **T014** [P] Update the spec-viewer living spec if this fix changes an observable behavior it documents; skip with a note if it does not · `src/features/spec-viewer/spec-viewer.spec.md`

**⟶ Wait for Wave 1, then:**

- [x] **T015** Validate against the Success Criteria: run the TypeScript compile and the full test suite, and confirm SC-001 through SC-006 · `package.json`

## Dependencies & Execution Order

- **Phase 1 and Phase 2** are empty; work starts at Phase 3.
- **Phase 3** (US1): T001 fails → T002 fixes → T003 confirms. Strictly sequential.
- **Phase 4** (US2): T004 then T005 (same file) → T006 fixes. Independent of Phase 3 in principle, but both edit the same two files, so run it after Phase 3.
- **Phase 5** (US3): T007 and T008 are independent of each other and depend on T002 and T006 both landing.
- **Phase 6**: T009 and T010 are fully independent of the code change and of each other. T011 waits on T010; T012 waits on T011.
- **Phase 8**: T016 fails, T017 fixes. Independent of Phases 3-5 (different language, different distribution).
- **Phase 7**: T013 and T014 are independent; T015 waits on everything.
- **Requirement coverage**: FR-001 → T001–T003; FR-002 → T004–T006; FR-003 → T001, T003; FR-004 → T007, T008; FR-005 → T001; FR-006 → T009; FR-007 → T010-T012, T016-T017.
