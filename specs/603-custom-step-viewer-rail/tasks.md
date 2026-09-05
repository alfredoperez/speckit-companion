# Tasks: A step you add appears in the spec viewer

**Feature**: `603-custom-step-viewer-rail` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Size**: normal

Line format: `- [ ] **T###** [P?] [US#] Description · exact/file/path`. `[P]` = independent of the other tasks in its wave (different file, no incomplete dependency), so it can be built in any order. `[US#]` maps the task to a user story.

No Setup phase: the change adds no dependency, no config and no tooling. It starts at Foundational.

---

## Phase 1: Foundational — the reader and the one shared resolver

Blocks every story. Nothing consumes these yet, so this phase produces no visible change.

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add `ProjectStep` and `readProjectSteps(root)`: scan `<root>/.specify/companion/nodes/*/`, take `label` from `description:` in `_frame.md` (fall back to the directory name with dashes as spaces), `after` from `after:` in `_order.yml`, `writes` from the first node file declaring `writes:`. Skip silently on a name colliding with `specify`/`plan`/`tasks`/`implement`/`mark-complete`/`auto`, a name outside `[a-z][a-z0-9-]*`, or an absent/unreadable `_order.yml`. Return entries ordered by directory name. Never throws · `src/features/workflows/projectSteps.ts`
- [x] **T002** [P] Add project-step fixtures the reader and resolver tests both read: one step placed after `implement`, one after `specify`, one unplaced (no `after:`), one with a malformed `_order.yml`, one named `plan` (collision), and two naming the same `after` · `tests/fixtures/project-steps/`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T003** [P] Unit-test the reader against the fixtures: label fallback, `writes:` pickup, directory-name ordering, and every skip rule returning the remaining steps rather than throwing (FR-007) · `src/features/workflows/__tests__/projectSteps.test.ts`
- [x] **T004** [P] Add the shared resolver module: `resolveCompanionSteps(root)` maps each placed `ProjectStep` to a `WorkflowStepConfig` (`command: speckit.companion.<name>`, `file: writes`, `actionOnly` when it writes nothing, `untimed` never set) and splices it in after the step it names, leaving `COMPANION_WORKFLOW` unmutated and `mark-complete` last; `resolveSpecPipeline(specDir, changeRoot?)` resolves the spec's recorded workflow and applies the splice only for Companion; `shouldRecordStepStart(steps, name)` returns true when the step is in the resolved pipeline and not `untimed` · `src/features/workflows/pipelineResolution.ts`

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — independent (different files):**

- [x] **T005** [P] Unit-test the resolver: no step directory returns `COMPANION_WORKFLOW.steps` unchanged (SC-003); a step placed after `implement` lands before `mark-complete`; a step placed after `specify` lands between specify and plan; an unplaced step and one naming a step outside `PLACEABLE_AFTER` are omitted (FR-003); two steps on the same `after` appear in directory-name order and are stable across calls; a stock-SpecKit and a user-defined pipeline come back untouched (FR-008); `COMPANION_WORKFLOW` is never mutated · `src/features/workflows/__tests__/pipelineResolution.test.ts`
- [x] **T006** [P] Export `resolveSpecPipeline`, `resolveCompanionSteps` and `shouldRecordStepStart` from the workflows barrel so both providers import from one place · `src/features/workflows/index.ts`

**Checkpoint**: the pipeline the project runs can be resolved, with tests. No surface reads it yet.

---

## Phase 2: User Story 1 — the step I added shows up in the rail (P1) 🎯 MVP

**Goal**: the rail and the sidebar both draw the project's placed step, in the position it declares.

**Independent Test**: add a step placed after `implement` in a sandbox project, build, open any spec there, and confirm the rail draws five steps in run order rather than four.

### Tests

- [x] **T007** [P] [US1] Add a viewer test that the rail's step list comes from `resolveSpecPipeline`: five steps for a workspace with one placed step, and the existing four-step expectations unchanged for a workspace with none (SC-003) · `src/features/spec-viewer/__tests__/stateDerivation.test.ts`
- [x] **T008** [P] [US1] Add a `customWorkflowProgress` test that a Companion pipeline carrying an added step is still classified built-in, so progression stays history-driven and never falls back to file presence (FR-009) · `src/features/specs/__tests__/customWorkflowProgress.test.ts`

**⟶ Wait for the tests to fail, then:**

### Implementation

**Wave 1 — independent (different files):**

- [x] **T009** [P] [US1] Widen `isBuiltinWorkflow` to also treat a pipeline whose every step command begins with `speckit.companion.` as built-in, so a spliced Companion pipeline keeps history-driven progression · `src/features/specs/customWorkflowProgress.ts`
- [x] **T010** [P] [US1] Delete the private `resolveWorkflowSteps` and call the shared `resolveSpecPipeline` at every use site (`showSpec`, the handler deps at line ~556, and the two step-list reads) · `src/features/spec-viewer/specViewerProvider.ts`
- [x] **T011** [P] [US1] Delete the private `resolveWorkflowSteps` and call the shared `resolveSpecPipeline` where the tree builds a spec's step list · `src/features/specs/specExplorerProvider.ts`

**Checkpoint**: the rail, the sidebar and the footer all draw the project's placed step, from one resolution (FR-001, FR-006). Steps are clickable but an added step's document does not open yet.

---

## Phase 3: User Story 2 — the step's document opens from the rail (P2)

**Goal**: clicking an added step opens the document it declared it writes, or says it is not yet produced.

**Independent Test**: add a step declared to write a named file, run it so the file exists, click its step in the rail, and confirm the file opens.

### Tests

- [x] **T012** [US2] Add tests that an added step with a `writes:` renders as a tab whose document resolves to that path, that a missing file reports "not yet produced" rather than an empty panel or a failure, and that a step with no `writes:` renders action-only like implement · `src/features/spec-viewer/__tests__/documentScanner.test.ts`

**⟶ Wait for the test to fail, then:**

### Implementation

- [x] **T013** [US2] Make the document lookup use the resolved step's `file` rather than a shipped-step name, so an added step's declared document opens and an absent one reports not-yet-produced (FR-004) · `src/features/spec-viewer/specViewerProvider.ts`

**Checkpoint**: US1 plus a working tab behind any added step that writes a document.

---

## Phase 4: User Story 3 — moving forward reaches the added step (P2)

**Goal**: the forward action offers and dispatches the added step, and the run records it.

**Independent Test**: sit a spec on the step before an added one, use the forward action, and confirm it names the added step, dispatches `speckit.companion.<name>`, and the reopened spec reads that step as completed.

### Tests

- [x] **T014** [P] [US3] Add tests that the footer's next-step action names and dispatches the added step when it is next, that a run recording the added step reads it completed and offers the following step, and that a spec recorded before the step existed opens with the added step showing not-started · `src/features/spec-viewer/__tests__/footerActions.test.ts`
- [x] **T015** [P] [US3] Add a test that `shouldRecordStepStart` writes a start for an added Companion step, still refuses one for `mark-complete`, and still refuses one for a user-workflow step · `src/features/spec-viewer/__tests__/messageHandlers.test.ts`

**⟶ Wait for the tests to fail, then:**

### Implementation

**Wave 1 — independent (different files):**

- [x] **T016** [P] [US3] Replace `LIFECYCLE_STEP_NAMES` with `shouldRecordStepStart` against the already-resolved pipeline at the dispatch path · `src/features/spec-viewer/messageHandlers.ts`
- [x] **T017** [P] [US3] Replace the `LIFECYCLE_STEPS` set with `shouldRecordStepStart` at all three call sites (lines ~650, ~659, ~748), resolving the spec's pipeline where it is not already at hand · `src/features/specs/specCommands.ts`

**Checkpoint**: the run walks through the added step end to end — offered, dispatched, journaled, and read back as completed (FR-005, FR-009).

---

## Phase 5: User Story 4 — timing and progress count the added step honestly (P3)

**Goal**: the added step counts toward phase coverage, and a step that never recorded reports partial coverage rather than a guessed duration.

**Independent Test**: complete a run through a pipeline with one added step and confirm the timing summary's phase count includes it; skip the added step and confirm partial coverage.

### Tests

- [x] **T018** [US4] Add tests that the timing denominator counts the added step and that an unrecorded added step yields partial coverage with no invented duration (FR-010) · `src/features/spec-viewer/__tests__/phaseCalculation.test.ts`

**⟶ Wait for the test to fail, then:**

### Implementation

- [x] **T019** [US4] Make the phase denominator read the resolved pipeline rather than a shipped-step constant, so the added step counts and an unrecorded one lowers coverage instead of being guessed · `src/features/spec-viewer/phaseCalculation.ts`

**Checkpoint**: every surface named in FR-006 — rail, sidebar, footer, timing summary — reports the same step count (SC-002).

---

## Phase 6: Polish

**Wave 1 — independent (different files):**

- [x] **T020** [P] Document the behaviour: the rail draws the project's placed steps, placement comes from `_order.yml` `after:`, an unplaced step stays hand-launched only, and nothing is written to `speckit.customWorkflows` · `docs/viewer-states.md`
- [x] **T021** [P] Add the user-facing entry under `## [Unreleased]` — a step you add to the pipeline now appears in the spec viewer · `CHANGELOG.md`
- [x] **T022** [P] Add a test asserting the feature never writes `speckit.customWorkflows` (SC-005) · `src/features/workflows/__tests__/pipelineResolution.test.ts`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T023** Run the test and lint suites and validate against the Success Criteria: SC-001 (one build, no settings edit), SC-002 (four surfaces agree), SC-003 (existing viewer tests pass unchanged), SC-004 (a deleted or corrupted step directory opens every spec on the shipped pipeline), SC-005 (zero settings lines changed) · `npm test && npm run lint`

---

## Dependencies & Execution Order

Foundational → US1 (P1) → US2 (P2) → US3 (P2) → US4 (P3) → Polish. Each story phase is independently testable once Foundational lands; US2, US3 and US4 each need US1's shared-resolver wiring, not each other.

- **Phase 1 (Foundational)**: Wave 1 (T001, T002) blocks Wave 2 (T003, T004); Wave 2 blocks Wave 3 (T005, T006).
- **Phase 2 (US1)**: tests T007, T008 first, then the single implementation wave T009, T010, T011 (three different files, no order between them).
- **Phase 3 (US2)**: T012 blocks T013.
- **Phase 4 (US3)**: T014, T015 block the wave T016, T017 (two different files).
- **Phase 5 (US4)**: T018 blocks T019.
- **Phase 6 (Polish)**: T020, T021, T022 run in any order; all three block the suite run T023.

The only cross-file ordering that matters is that no provider is edited before `pipelineResolution.ts` exists, and that the built-in detector (T009) lands with or before the provider switch (T010, T011) so a spliced pipeline is never briefly treated as user-defined.
