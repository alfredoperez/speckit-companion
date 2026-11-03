# Tasks: New specs are written as spec.md

**Scale note**: about 24 files in two disjoint phases, nodes and scripts. The rebuilt command bodies are owned by the nodes phase.

## Phase 1: Setup

None.

## Phase 2: Foundational

None: the two stories touch disjoint files.

## Phase 3: User Story 1 - Companion writes spec.md (P1)

Files: `apps/speckit-extension/nodes/specify/resolve-dir.md`, `apps/speckit-extension/nodes/specify/resolve-dir-git.md`, `apps/speckit-extension/nodes/specify/draft-spec.md`, `apps/speckit-extension/nodes/specify/draft-spec-delta.md`, `apps/speckit-extension/nodes/specify/draft-spec-bugfix.md`, `apps/speckit-extension/nodes/specify/quality-checklist.md`, `apps/speckit-extension/nodes/specify/quality-checklist-blocking.md`, `apps/speckit-extension/nodes/specify/branch.md`, `apps/speckit-extension/nodes/specify/finalize.md`, `apps/speckit-extension/nodes/auto/resolve-dir.md`, `apps/speckit-extension/nodes/plan/gather-context.md`, `apps/speckit-extension/nodes/tasks/tasks-doc.md`, `apps/speckit-extension/nodes/implement/implement-exec.md`, `apps/speckit-extension/commands/speckit.companion.{specify,plan,tasks,implement,auto}.md`, `apps/speckit-extension/commands/.manifest.json`

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US1] Writer nodes name the new file `spec.md` and declare `writes: spec.md`; the dir guard still refuses a folder holding either name · apps/speckit-extension/nodes/specify/{resolve-dir,resolve-dir-git,draft-spec,draft-spec-delta,draft-spec-bugfix,quality-checklist,quality-checklist-blocking,branch,finalize}.md, apps/speckit-extension/nodes/auto/resolve-dir.md
- [x] **T002** [P] [US1] Loader nodes name `spec.md` first and `<short-name>.spec.md` as the older form · apps/speckit-extension/nodes/plan/gather-context.md, apps/speckit-extension/nodes/tasks/tasks-doc.md, apps/speckit-extension/nodes/implement/implement-exec.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** [US1] Rebuild with `build.py`; `build.py --check` and shape parity pass · apps/speckit-extension/commands/

**Checkpoint**: a new Companion spec is `spec.md`.

## Phase 4: User Story 2 - checks accept either name (P1)

Files: `apps/speckit-extension/scripts/manifest.py`, `apps/speckit-extension/scripts/doctor_checks.py`, `apps/speckit-extension/scripts/check_quality.py`, `apps/speckit-extension/scripts/dispatch-briefs.py`, `apps/speckit-extension/tests/test_manifest.py`, `apps/speckit-extension/tests/test_pipeline_graph.py`, `apps/speckit-extension/tests/test_doctor.py`, `apps/speckit-extension/tests/test_check_quality.py`, `apps/speckit-extension/tests/test_dispatch_briefs.py`

### Tests

- [x] **T004** [US2] Manifest and pipeline-graph expect `spec.md`; doctor artifact check passes a `spec.md` folder and a named folder; quality check scores a named spec; briefs name `spec.md` when none exists · apps/speckit-extension/tests/{test_manifest,test_pipeline_graph,test_doctor,test_check_quality,test_dispatch_briefs}.py

### Implementation

**Wave 1 — independent (different files):**

- [x] **T005** [P] [US2] `unproduced` resolves a declared `spec.md` through `feature_spec_path` · apps/speckit-extension/scripts/manifest.py
- [x] **T006** [P] [US2] `_artifact_exists` resolves `spec.md` through `feature_spec_path` · apps/speckit-extension/scripts/doctor_checks.py
- [x] **T007** [P] [US2] `check_verbosity` reads the spec through `feature_spec_path` · apps/speckit-extension/scripts/check_quality.py
- [x] **T008** [P] [US2] Fallback text names `spec.md` · apps/speckit-extension/scripts/dispatch-briefs.py

**Checkpoint**: old and new folders both pass every check.

## Phase 5: Polish

- [x] **T009** [P] Docs and the resolver comment name `spec.md` as the new form · apps/speckit-extension/docs/commands.md, apps/speckit-extension/docs/install.md, apps/vscode/src/features/specs/featureSpecPath.ts
- [x] **T010** [P] One `[Unreleased]` line · apps/speckit-extension/CHANGELOG.md
- [x] **T011** Run the Python suite, `build.py --check`, emissions, quality gate, manifest gate, `tsc`, and stock `check-prerequisites.sh --json --require-spec --require-tasks` against a spec.md folder · apps/speckit-extension/

## Dependencies & Execution Order

- Phase 3 and Phase 4 own disjoint files and run side by side. Phase 3: wave 1 (T001, T002), then T003. Phase 4: T004, then wave 1 (T005 to T008). Phase 5 last.
