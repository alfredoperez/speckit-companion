# Tasks: Reduce per-step pipeline overhead

## Phase 1: Setup

**Wave 1 — independent (different files):**
- [x] **T001** [P] Confirm the four `speckit-extension` gates + `npm test` are green on a clean tree · speckit-extension/scripts/

## Phase 2: Item 1 — measure + escalate (US1, US3)

**Wave 2 — independent (different files):**
- [x] **T002** [P] Add the baseline measurement script that reads the assembled pipeline bodies and prints redundant-token total · speckit-extension/tests/measure_pipeline_overhead.py
- [x] **T003** [P] Run the script; record the baseline (9,492 redundant tokens) in spec.md/plan.md · specs/542-pipeline-overhead/plan.md

**⟶ Wait for Wave 2, then:**
- [x] **T004** Investigate the dispatch path (executeSlashCommand sends a name, not the body); confirm no safe on-disk dedupe; document the escalation · specs/542-pipeline-overhead/spec.md

## Phase 3: Item 2 — single-owner validation (US2)

**Wave 3 — sequential (same command surface):**
- [x] **T005** Edit the tasks Polish phase to defer validation to a declared `implement-exec` review hook · speckit-extension/nodes/tasks/tasks-doc.md
- [x] **T006** Regenerate the assembled tasks command body · speckit-extension/commands/speckit.companion.tasks.md
- [x] **T007** Re-bless the golden capture · speckit-extension/tests/golden/commands/commands__speckit.companion.tasks.md

## Phase 4: Polish

- [x] **T008** Update docs: capture-and-timing.md, template-profiles.md, speckit-extension/README.md, `[Unreleased]` CHANGELOG · docs/
- [x] **T009** Validate against Success Criteria — covered by the project's post-implement review hook (no separate suite run); the four gates + `npm test` + Python unittest run once via the ship review · speckit-extension/scripts/

## Dependencies & Execution Order

Setup → Item 1 (Wave 2 parallel, then T004) → Item 2 (Wave 3 sequential) → Polish. Item 1 and Item 2 are independent; Item 2's three tasks are sequential because T006/T007 derive from T005.
