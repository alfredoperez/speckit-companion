# Tasks: where each skill comes from, and which skill hooks cannot run

## Phase 2: Foundational

Files: `apps/speckit-extension/scripts/build-pipeline.py`, `apps/speckit-extension/scripts/pipeline-graph.py`, `apps/vscode/src/protocol/pipeline.ts`

**Wave 1 — independent (different files):**

- [ ] **T001** [P] Add `skill_catalog`, `skill_problem` and `skill_hook_warnings`, and print the warnings in `main` without failing (FR-001, FR-002, FR-003, FR-005, FR-007) · apps/speckit-extension/scripts/build-pipeline.py
- [ ] **T002** [P] Add `SkillChoice`, `PipelineHook.problem`, `PipelineChoices.skillCatalog` and `pluginsRead`, `BuildReport.warnings`, all optional where an older install may omit them (FR-008) · apps/vscode/src/protocol/pipeline.ts

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T003** Carry `choices.skillCatalog`, `choices.pluginsRead` and a `problem` on every hook, from the functions in T001 (FR-004, FR-007) · apps/speckit-extension/scripts/pipeline-graph.py

## Phase 3: User Story 1 - A hook whose skill cannot run says so (P1)

Files: `apps/vscode/src/features/specs/pipelineBuildCommands.ts`, `apps/speckit-extension/tests/test_skill_hook_problems.py`, `apps/vscode/src/features/specs/__tests__/buildReport.test.ts`

### Tests

- [ ] **T004** [P] [US1] Graph and build preview: a missing skill, a `disable-model-invocation` skill, a plugin-prefixed name with a same-named project skill, and a callable skill each get the right problem, and the preview exits 0 with the warning (FR-004, FR-005) · apps/speckit-extension/tests/test_skill_hook_problems.py
- [ ] **T005** [P] [US1] The build report lists the warnings printed before the summary line and none from a failed run (FR-006) · apps/vscode/src/features/specs/__tests__/buildReport.test.ts

### Implementation

- [ ] **T006** [US1] `readBuildReport` fills `warnings` from the log (FR-006) · apps/vscode/src/features/specs/pipelineBuildCommands.ts

**Checkpoint**: a bad skill hook shows its reason in the graph, the build log and the build report.

## Phase 4: User Story 2 - The skill picker says where each skill comes from (P2)

Files: `apps/speckit-extension/tests/test_skill_catalog.py`

### Tests

- [ ] **T007** [US2] Catalog: project folders, user folder, an enabled and a disabled plugin, a plugin installed for another project, an unreadable registry, a folded description (FR-001, FR-002, FR-003) · apps/speckit-extension/tests/test_skill_catalog.py

**Checkpoint**: the picker data lists every skill with its source.

## Phase 5: Polish

- [ ] **T008** [P] Changelog lines under `[Unreleased]` for both deliverables · apps/speckit-extension/CHANGELOG.md, CHANGELOG.md
- [ ] **T009** Validate against Success Criteria: `npx tsc --noEmit -p ./`, related jest tests, the touched pytest files, docs-consistency · (no file)

## Dependencies & Execution Order

Foundational (T001, T002 in parallel, then T003) blocks both stories. US1 and US2 own disjoint files and can run in either order. Polish runs last; T009 after everything.
