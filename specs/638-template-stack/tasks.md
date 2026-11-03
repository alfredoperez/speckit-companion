# Tasks: Companion steps read spec-kit's template stack

## Phase 1: Setup

None: the scripts, tests and harness already exist.

## Phase 2: Foundational

Files: `apps/speckit-extension/scripts/template_render.py`

**Wave 1 — one file, in order:**

- [x] **T001** Add `BUILT_REL = .specify/companion/built` and `base_template(project_root, name)`: run `resolve-template.sh <stem>` with the project as cwd and `SPECIFY_INIT_DIR`; no script or no bash reads the core file; a non-zero exit raises `TemplateError`; a result byte-equal to Companion's old extension-layer copy reads the core file · apps/speckit-extension/scripts/template_render.py
- [x] **T002** `resolve()` takes the project root, starts swaps from `base_template()`, and when nothing is configured returns the winner whole if it differs from the core file · apps/speckit-extension/scripts/template_render.py
- [x] **T003** `render_shape_note()` points at `BUILT_REL` and has a whole-file wording for a template followed as it is · apps/speckit-extension/scripts/template_render.py

**⟶ Wait for Phase 2 to finish, then:**

## Phase 3: User Stories 1 and 2 - the build follows the stack and keeps its copy in the project (P1)

Files: `apps/speckit-extension/scripts/build-pipeline.py`, `apps/speckit-extension/scripts/pipeline-graph.py`, `apps/speckit-extension/scripts/config_write.py`, `apps/speckit-extension/tests/test_template_stack.py`, `apps/speckit-extension/tests/test_builder_flow.py`, `apps/speckit-extension/tests/test_presets.py`

### Tests

- [x] **T004** [US1] New tests: override section reaches the copy and the note; preset append reaches it; swaps apply on top of an override; uncustomised project writes no copy and identical bodies; no script falls back; a failing script stops the build with nothing written; an old extension-layer copy is ignored and removed · apps/speckit-extension/tests/test_template_stack.py

### Implementation

**Wave 1 — independent (different files):**

- [x] **T005** [P] [US1] `plan_templates()` passes the project root, carries `whole`, and `main()` writes copies to `BUILT_REL` under the project, then deletes Companion's old copies in `.specify/extensions/companion/templates/` · apps/speckit-extension/scripts/build-pipeline.py
- [x] **T006** [P] [US1] `_template()` lists `sectionsAvailable` from `base_template()`, falling back to the core file on a resolver error · apps/speckit-extension/scripts/pipeline-graph.py
- [x] **T007** [P] [US1] `check_template_section()` checks the heading against `base_template()`, same fallback · apps/speckit-extension/scripts/config_write.py
- [x] **T008** [P] [US2] Point the old-path assertions at `.specify/companion/built/` · apps/speckit-extension/tests/test_builder_flow.py, apps/speckit-extension/tests/test_presets.py

**Checkpoint**: an override or preset reaches Companion's plan, the copy lives under `.specify/companion/built/`, and an uncustomised project is unchanged.

## Phase 4: User Story 3 - the doctor names an ignored team template (P2)

Files: `apps/speckit-extension/scripts/doctor_checks.py`, `apps/speckit-extension/scripts/doctor.py`, `apps/speckit-extension/commands/speckit.companion.doctor.md`, `apps/speckit-extension/tests/test_doctor.py`

### Tests

- [x] **T009** [US3] `check_built` cases: missing copy, stale copy, uncustomised project is not applicable, no resolver script is a skip with a reason · apps/speckit-extension/tests/test_doctor.py

### Implementation

**Wave 1 — one file:**

- [x] **T010** [US3] `check_built(feature_dir, ctx=None, root=None)`: compute what the build would write per step and compare it with the copy under `BUILT_REL` · apps/speckit-extension/scripts/doctor_checks.py

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T011** [US3] Register `built` in `CHECKS` and `examine()`, and name it in the doctor command's check list · apps/speckit-extension/scripts/doctor.py, apps/speckit-extension/commands/speckit.companion.doctor.md

**Checkpoint**: the doctor reports a missing or stale built copy and says nothing on an uncustomised project.

## Phase 5: Polish

- [x] **T012** [P] The staleness check also looks at `.specify/presets` · apps/vscode/src/features/specs/pipelineBuild.ts
- [x] **T013** [P] One `[Unreleased]` line · apps/speckit-extension/CHANGELOG.md
- [x] **T014** Run the speckit-extension Python suite, `build.py --check`, shape parity and `tsc` against the Success Criteria · apps/speckit-extension/

## Dependencies & Execution Order

- Phase 2 blocks everything: every caller needs `base_template()`.
- Phase 3 and Phase 4 own disjoint files and can run side by side once Phase 2 is done.
- Phase 3: T004 first, then wave 1 (T005 to T008). Phase 4: T009, T010, then T011.
- Phase 5 runs last; T014 runs once, after everything.
