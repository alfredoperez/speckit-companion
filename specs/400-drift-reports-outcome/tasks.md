# Tasks: Drift and fold-back summaries report outcome, not intent

**Size**: normal · **Stories**: 5 · **Tasks**: 12

Every test task below carries a **drift-proof** obligation: after the test passes, revert the production change it covers, confirm the test goes red, then restore. A test that passes both before and after the fix is worthless and does not count as done.

## Phase 1: Setup

No setup tasks. Both scripts, both test suites, and both doc surfaces already exist; nothing needs scaffolding.

## Phase 2: Foundational

Blocks every story. The drift summary cannot branch on what was checked until the result object carries it.

**Wave 1 — single task (foundation for all drift stories):**

- [x] **T001** [US1] Add a `checked` integer to the result `compute_drift` returns, set on both the disabled-early-return path and the normal path, equal to the number of capabilities actually examined · `speckit-extension/scripts/drift.py`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — single task (rewrites the renderer all stories assert against):**

- [x] **T002** [US1] [US2] [US3] Rewrite the summary in `render_human` to branch on the checked count: emit nothing when disabled, emit the counts line with no success glyph when zero were checked, emit the counted success claim when at least one was checked and none drifted, and emit the skipped count alongside the drift report when both are present · `speckit-extension/scripts/drift.py`

**Checkpoint**: the drift command reports honestly in all four states; stories 1 through 4 are now testable.

## Phase 3: User Story 1 — A drift run that checked nothing must not claim everything is fine (P1)

**Goal**: An all-skipped run states that nothing was checked and makes no success claim.

**Independent Test**: Build a sandbox whose capability specs are uncommitted, run drift, assert the output contains no success phrase and states zero checked.

### Tests

**Wave 3 — independent (each a distinct test case, same file, written together as one edit):**

- [x] **T003** [US1] Test that an all-skipped run reports zero checked and the skipped count, and that the rendered output contains neither `All capabilities in sync` nor the `✓` glyph · `speckit-extension/tests/test_living_specs.py`
- [x] **T004** [US1] Test that a disabled run still renders the empty string, so the fix did not make a switched-off feature chatty, and test that an enabled-but-unconfigured run reports no capabilities configured rather than a success claim · `speckit-extension/tests/test_living_specs.py`

**Checkpoint**: US1 is independently functional and drift-proofed.

## Phase 4: User Story 2 — A partly-skipped run reports both halves honestly (P1)

**Goal**: A mixed run states the checked count and the skipped count.

**Independent Test**: Sandbox with one committed and one uncommitted capability spec; assert both numbers appear.

**Wave 4 — independent of Wave 3 (distinct test cases):**

- [x] **T005** [P] [US2] Test that a mixed run with one checked-and-clean and one skipped capability reports both the checked count and the skipped count in the summary · `speckit-extension/tests/test_living_specs.py`
- [x] **T006** [P] [US2] Test that a mixed run where the checked capability has drifted still reports the drift findings and still states the skipped count · `speckit-extension/tests/test_living_specs.py`

**Checkpoint**: US2 is independently functional.

## Phase 5: User Story 3 — A genuinely clean run still reads as clean (P1)

**Goal**: A real all-clear keeps its success line, now carrying the checked count.

**Independent Test**: Sandbox with all specs committed and no changes; assert the success line appears.

**Wave 5 — single task:**

- [x] **T007** [US3] Update the two existing tests that assert the old exact success string (`test_in_sync_reports_single_all_clear` and `test_exempt_file_is_filtered_out`) to the new counted claim, re-deriving each from the contract rather than loosening the assertion, and add a case asserting the count in the claim is accurate · `speckit-extension/tests/test_living_specs.py`

**Checkpoint**: US3 is functional and the pre-existing suite is green against the new contract, not weakened to pass.

## Phase 6: User Story 4 — A caller can tell "clean" from "did not run" (P2)

**Goal**: The machine-readable surface and exit code let a caller branch correctly.

**Independent Test**: Assert `checked` on the JSON result across states and assert the process exits zero in each.

**Wave 6 — independent (distinct test cases):**

- [x] **T008** [P] [US4] Test that the JSON result carries `checked` across the disabled, all-skipped, mixed, and clean states, and that `checked` always equals the length of the capabilities list · `speckit-extension/tests/test_living_specs.py`
- [x] **T009** [P] [US4] Test that the command exits zero in the all-skipped, clean, and drift-found states, pinning the never-halts contract against the exit-code decision recorded in research · `speckit-extension/tests/test_living_specs.py`

**Checkpoint**: US4 is functional; the drift half of the change is complete.

## Phase 7: User Story 5 — Fold-back reports what it applied, not what it attempted (P2)

**Goal**: The fold's counts line counts applied changes and names dropped ones.

**Independent Test**: Fold a spec whose change blocks name absent headings; assert the counts reflect what landed.

**Wave 7 — single task (production change the tests assert against):**

- [x] **T010** [US5] Make delta application report what it applied — return per-verb applied counts alongside the updated text, counting only changes that matched a heading (and excluding an addition skipped as already present) — and render the fold's counts line from those applied numbers, appending a note naming how many changes were dropped when any were · `speckit-extension/scripts/write-context.py`

**⟶ Wait for Wave 7 to finish, then:**

**Wave 8 — single task:**

- [x] **T011** [US5] Test the three fold cases: every change dropped reports zeros and names the drop, a partial match reports only what applied, and an all-applied fold reports counts identical to today's output; update any existing caller of the delta-application helper for its new return shape · `speckit-extension/tests/test_living_specs.py`

**Checkpoint**: US5 is functional; both halves of the change are complete.

## Phase 8: Polish

**Wave 9 — single task:**

- [x] **T012** Update the "Spotting drift" paragraph that documents the all-clear and skip behavior in `speckit-extension/README.md`, and add an `[Unreleased]` entry to `speckit-extension/CHANGELOG.md` in user-facing voice with no internal file or symbol names · `speckit-extension/README.md`, `speckit-extension/CHANGELOG.md`

**Validation against Success Criteria**: run the full Python suites, `check-shape-parity.py`, `npm run compile`, and `npm test`; confirm SC-001 through SC-007, with SC-007 satisfied by the drift-proof obligation on every test task above.

## Dependencies & Execution Order

Phases run in order: Foundational (T001 → T002) blocks all five stories, because every story asserts against the reshaped result and renderer. Story phases 3 through 6 all depend on Wave 2 and are otherwise independent of each other — their test waves could run in any order. Phase 7 is independent of phases 3 through 6 entirely (a different script, a different surface) and could be built in parallel with them by a host with subagents; it is sequenced last only because the drift command is the filed ticket. Phase 8 depends on every preceding phase, since the docs describe the final behavior of both halves.

Within phases: T001 blocks T002 (same file, the renderer reads the field the result gains). T002 blocks T003 through T009. T010 blocks T011. Everything blocks T012.
