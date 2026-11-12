# Tasks: Retire living specs

> **Scale note**: about 200 files in four areas. Phase 2 moves three shared helpers out of living files; every story depends on it. After that the four story phases own disjoint files and can run in parallel.

## Phase 1: Setup

- [x] **T001** Write the loss list (every retired command, view, setting, record field and capability, and why) · specs/669-retire-living-specs/loss-list.md

## Phase 2: Foundational

**Wave 1 — independent (different files):**

- [x] **T002** [P] Move the glob matcher from the resolver into `capture.py` and point `_glob_matcher` at it; add a glob test · apps/speckit-extension/scripts/capture.py, apps/speckit-extension/tests/test_capture_fields.py
- [x] **T003** [P] Move `GitRunner`/`makeDefaultGitRunner` to `core/utils/git.ts` and `unsupportedForRuntime` to `core/utils/yamlSubset.ts`; repoint `checkFreshness.ts`, `specViewerProvider.ts`, `companionSteering.ts` and their tests · apps/vscode/src/core/utils/git.ts, apps/vscode/src/core/utils/yamlSubset.ts

**⟶ Wait for Wave 1 to finish, then the story phases run in parallel.**

## Phase 3: User Story 1 - The living-spec commands are gone (P1)

Files: apps/speckit-extension/{commands,nodes,workflows,scripts (not doctor*),tests (not test_doctor*),docs,README.md,extension.yml}, .specify/companion.yml, .vscodeignore, .github/workflows/ci.yml, .claude/scripts/subagent-tally.py

### Tests

- [x] **T004** [P] [US1] FR-001: manifest lists no `living-*` command and no `living-specs`/`drift` tag · apps/speckit-extension/tests/test_packaging.py
- [x] **T005** [P] [US1] FR-003: Brownfield preset resolves with no living node · apps/speckit-extension/tests/test_workflows.py

### Implementation

**Wave 1 — independent (different files):**

- [x] **T006** [P] [US1] Delete the 7 commands, 3 reference parts, 3 living nodes and `docs/living-specs.md`; drop them from `extension.yml` (commands, tags, doctor wording) · apps/speckit-extension/commands, apps/speckit-extension/nodes, apps/speckit-extension/extension.yml
- [x] **T007** [P] [US1] Delete living scripts (`living_spec_fold`, `living_validate`, `check_living_spec`, `spec_deltas`, `record-living-specs`, `register-capability`, `relocate-capability`, `drift`, `check-coverage`, `resolve-spec-paths`) and their living-only tests · apps/speckit-extension/scripts, apps/speckit-extension/tests

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T008** [P] [US1] Cut living paths from `write-context.py`, `capture.py` setters, `companion_config.py`, `config_write.py`, `pipeline-graph.py`, `dispatch-briefs.py`, `check_quality.py`, `check_capture.py`, `run_trace.py`, `package-manifest.py`; trim mixed tests · apps/speckit-extension/scripts, apps/speckit-extension/tests
- [x] **T009** [P] [US1] Remove living nodes from `_order.yml` files, the Brownfield preset, `finalize.md`, `implement/complete.md`, `presets/_parts/timing.md`, `reference/fan-out.md`; update `docs/commands.md`, `docs/node-model.md`, `docs/install.md`, README · apps/speckit-extension/nodes, apps/speckit-extension/workflows/presets/brownfield.yml, apps/speckit-extension/docs
- [x] **T010** [P] [US1] Drop the living node and prompt wording from this repo's config; drop `.vscodeignore` living entries; repoint `subagent-tally.py` · .specify/companion.yml, .vscodeignore, .claude/scripts/subagent-tally.py

**⟶ Wait, then:**

- [x] **T011** [US1] Rebuild command bodies with `build.py` · apps/speckit-extension/commands

**Checkpoint**: the extension ships no living command and every pipeline step runs without one.

## Phase 4: User Story 2 - A project that had living specs keeps working (P1)

Files: apps/speckit-extension/scripts/doctor*.py, apps/speckit-extension/tests/test_doctor*.py, apps/speckit-extension/tests/test_retired_living.py

### Tests

- [x] **T012** [P] [US2] FR-004/FR-006/FR-007: a project with `livingSpecs:`, `capabilities/` and an old record runs config load and a write-context merge with no error, keeps the record block, and leaves `capabilities/` byte-identical · apps/speckit-extension/tests/test_retired_living.py
- [x] **T013** [P] [US2] FR-005: doctor prints `livingSpecs is retired; safe to delete` exactly once · apps/speckit-extension/tests/test_doctor_chat.py

### Implementation

- [x] **T014** [US2] Delete `doctor_drift.py` and the drift check; replace the `briefed` living check with `check_retired_living` · apps/speckit-extension/scripts/doctor.py, apps/speckit-extension/scripts/doctor_checks.py, apps/speckit-extension/scripts/doctor_chat.py

**⟶ Wait, then:**

- [x] **T021** [US4] FR-011: doctor notes a constitution naming flow-back or living specs, via `check_persistence_model`, with its test · apps/speckit-extension/scripts/doctor_checks.py, apps/speckit-extension/tests/test_doctor_chat.py

**Checkpoint**: an upgraded living-specs project runs clean and the doctor names the leftover once.

## Phase 5: User Story 3 - The VS Code sidebar drops the Living Specs surface (P2)

Files: package.json, apps/vscode/** (except core/utils/git.ts, yamlSubset.ts), .storybook/preview.tsx, tooling/scripts/*, apps/copilot-canvas/**

### Tests

- [x] **T015** [P] [US3] FR-008: manifest has no living view or command; extension activates without them · apps/vscode/src/features/specs/__tests__/manifest.test.ts
- [x] **T016** [P] [US3] FR-007: an old record still renders `LivingSpecsCard` with text chips · apps/vscode/webview/src/spec-viewer/components/cards/__tests__/LivingSpecsCard.test.tsx

### Implementation

**Wave 1 — independent (different files):**

- [x] **T017** [P] [US3] Delete `features/living-specs/**`, `specShapeCheck`/`specShapeDiagnostics` and their tests; unwire from `extension.ts`, `constants.ts`, `contextKeys.ts`, `telemetry.ts`, `docs/telemetry.md`, `package.json` · apps/vscode/src, package.json
- [x] **T018** [P] [US3] Remove the builder's living panel and `PipelineLivingSpecs` protocol · apps/vscode/webview/src/pipeline-builder, apps/vscode/src/features/pipeline-builder, apps/vscode/src/protocol/pipeline.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T019** [US3] Remove the viewer's living mode (host and webview), keep the card and its derivation, make chips text · apps/vscode/src/features/spec-viewer, apps/vscode/src/protocol/viewer.ts, apps/vscode/webview/src/spec-viewer, apps/vscode/webview/styles

**⟶ Wait, then:**

- [x] **T020** [P] [US3] Update stories, fixtures and tooling capture scripts; rebuild the canvas vendor copy · .storybook/preview.tsx, tooling/scripts, apps/copilot-canvas

**Checkpoint**: no living surface in VS Code; old records still show their card.

## Phase 6: User Story 4 - The loss and the persistence model are written down (P2)

Files: apps/website/**, content/media/**, README.md, CHANGELOG.md, apps/speckit-extension/CHANGELOG.md, docs/architecture/*

### Implementation

**Wave 1 — independent (different files):**

- [x] **T022** [P] [US4] Delete the site page, redirect it via `MOVED`, add "How Companion keeps specs" to the steps page, remove living links across the site · apps/website
- [x] **T023** [P] [US4] Drop the living clips from the media manifest and their source folders; fix README alt text and link · content/media, README.md
- [x] **T024** [P] [US4] Changelogs: spec-kit `[Unreleased]` Removed linking the loss list; root Removed line for the sidebar · apps/speckit-extension/CHANGELOG.md, CHANGELOG.md
- [x] **T025** [P] [US4] Drop living nodes from the architecture JSON and regenerate · docs/architecture

**Checkpoint**: the loss is named and the site states the model.

## Phase 7: Polish

- [x] **T026** Run `build.py --check`, `package-manifest.py --check`, `check-command-emissions.py`, `instruction-budget.py --strict`, Python tests, `tsc`, related jest, site build, and `grep -r living- apps/speckit-extension` against SC-001..SC-004 · repo

## Dependencies & Execution Order

Setup → Foundational (Wave 1: T002, T003) → Phases 3–6 in parallel → Polish. Phase 3: T006/T007 → T008/T009/T010 → T011. Phase 4: T012/T013 → T014 → T021. Phase 5: T017/T018 → T019 → T020. Phase 6: T022–T025 together.

## Phase 8: Convergence

- [x] T027 Drop retired node ids (`load-living-specs`, `draft-spec-delta`) from a project's node order and phases with one build warning instead of refusing the build per Edge Cases/FR-002 (partial)
