# Tasks: Capture plain SpecKit runs with hooks only

**Feature**: [stock-hooks-only.spec.md](./stock-hooks-only.spec.md) · **Plan**: [plan.md](./plan.md)

> **Scale note.** About 45 files across the spec-kit extension, the VS Code extension and committed fixtures, most of it deletion. The fixtures in Polish change only by running the `specify` CLI. The reconciler tests invert: what was "never remove" becomes "remove once".

## Phase 1: Setup

- [x] **T001** Add the start hook command and register it for the four before events · `apps/speckit-extension/commands/speckit.companion.before-step.md`, `apps/speckit-extension/extension.yml`
- [x] **T002** Make the specify finish hook write a start from the noted time and a real finish · `apps/speckit-extension/commands/speckit.companion.after-specify.md`

## Phase 2: Foundational

Files: `apps/speckit-extension/presets/companion-standard/`, `apps/speckit-extension/tests/golden/`, `apps/speckit-extension/scripts/{_command_parts,build,check_shape_parity,assemble_nodes}.py`, `apps/speckit-extension/tests/{test_standard_preset_wrap,test_nodes,test_command_spelling,test_node_replacement,test_instruction_budget,test_node_boundaries}.py`, `.github/workflows/ci.yml`

**Wave 1 — independent (different files):**

- [x] **T003** [P] [US1] Delete the preset folder · `apps/speckit-extension/presets/companion-standard/`
- [x] **T004** [P] [US1] Delete the golden files and the preset test · `apps/speckit-extension/tests/golden/`, `apps/speckit-extension/tests/test_standard_preset_wrap.py`
- [x] **T005** [P] [US1] Make the carrier list the seven namespaced bodies and drop the golden helpers · `apps/speckit-extension/scripts/_command_parts.py`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T006** [P] [US1] Drop the golden check and the stock timing-fence check, fix the OK line · `apps/speckit-extension/scripts/check_shape_parity.py`
- [x] **T007** [P] [US1] Drop `--bless`, the preset glob and the golden clause · `apps/speckit-extension/scripts/build.py`
- [x] **T008** [P] [US1] Reword the "golden" comments · `apps/speckit-extension/scripts/assemble_nodes.py`
- [x] **T009** [P] [US1] Drop the stock timing-fence test class · `apps/speckit-extension/tests/test_nodes.py`
- [x] **T010** [P] [US1] Drop the golden directory from the spelling sweep · `apps/speckit-extension/tests/test_command_spelling.py`
- [x] **T011** [P] [US1] Rename the three tests that say "golden" · `apps/speckit-extension/tests/test_node_replacement.py`, `apps/speckit-extension/tests/test_instruction_budget.py`, `apps/speckit-extension/tests/test_node_boundaries.py`
- [x] **T012** [P] [US1] Rename the CI step that names preset goldens · `.github/workflows/ci.yml`

**Checkpoint**: `build.py --check` and the extension's Python tests pass with no preset.

## Phase 3: User Story 1 - Plain SpecKit commands are spec-kit's own text (P1)

Files: `apps/speckit-extension/scripts/check_quality.py`, `apps/speckit-extension/scripts/doctor_checks.py`, `apps/speckit-extension/tests/test_doctor.py`, `apps/speckit-extension/tests/test_before_step_hook.py`

**Goal**: a hooks-only run is captured and its own health checks stay quiet.
**Independent Test**: the new hook test passes, and the doctor does not warn about batching on a run journaled by the extension.

### Tests

- [x] **T013** [P] [US1] Test that the manifest registers the four before hooks to one command, and that the specify finish hook names both writer calls · `apps/speckit-extension/tests/test_before_step_hook.py`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T014** [P] [US1] Add the start hook to the never-prompt roster · `apps/speckit-extension/scripts/check_quality.py`
- [x] **T015** [P] [US1] Count only agent-written task finishes toward the batching warning, with a test · `apps/speckit-extension/scripts/doctor_checks.py`, `apps/speckit-extension/tests/test_doctor.py`

**Checkpoint**: plain SpecKit capture works from hooks alone and reports clean.

## Phase 4: User Story 2 - An existing project is cleaned up (P1)

Files: `apps/vscode/src/features/settings/companionPresetReconciler.ts`, `apps/vscode/src/features/settings/__tests__/companionPresetReconciler.test.ts`, `apps/vscode/src/extension.ts`, `apps/vscode/src/features/steering/companionSteering.ts`, `apps/vscode/src/features/steering/steeringExplorerProvider.ts`, `apps/vscode/src/features/steering/__tests__/{companionSteering,steeringExplorerProvider}.test.ts`, `apps/vscode/src/core/constants.ts`, `package.json`, `tooling/scripts/desktop-check.mjs`

**Goal**: one editor start removes a leftover preset, and nothing ever adds it.
**Independent Test**: the reconciler tests pass with the directions inverted.

### Tests

- [x] **T016** [US2] Rewrite the reconciler tests: remove once when installed, nothing when absent, never add, survive a failing CLI · `apps/vscode/src/features/settings/__tests__/companionPresetReconciler.test.ts`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T017** [P] [US2] Make `companion-standard` a removed-once preset; delete the add, enable and stale paths; rename the entry point · `apps/vscode/src/features/settings/companionPresetReconciler.ts`
- [x] **T018** [P] [US2] Remove the Companion "Templates" reader and its test · `apps/vscode/src/features/steering/companionSteering.ts`, `apps/vscode/src/features/steering/__tests__/companionSteering.test.ts`
- [x] **T019** [P] [US2] Stop faking the preset folder in the desktop check · `tooling/scripts/desktop-check.mjs`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T020** [P] [US2] Call the renamed cleanup at activation and fix its comment · `apps/vscode/src/extension.ts`
- [x] **T021** [P] [US2] Remove the Templates group from the Steering tree, its context values and its mock · `apps/vscode/src/features/steering/steeringExplorerProvider.ts`, `apps/vscode/src/core/constants.ts`, `apps/vscode/src/features/steering/__tests__/steeringExplorerProvider.test.ts`, `package.json`

**Checkpoint**: the VS Code extension compiles and its tests pass.

## Phase 5: User Story 3 - The prompt on a plain step stays truthful (P2)

Files: `apps/vscode/src/ai-providers/__tests__/promptBuilder.test.ts`

- [x] **T022** [US3] Pin that a stock command gets the full stock preamble and never the "command's body carries" text, and that a Companion command is unchanged · `apps/vscode/src/ai-providers/__tests__/promptBuilder.test.ts`

**Checkpoint**: the prompt contract is pinned by a test.

## Phase 6: User Story 4 - The docs say what is true (P3)

Files: `apps/speckit-extension/README.md`, `apps/speckit-extension/docs/{commands,install,node-model,how-it-works,contributing,publishing}.md`, `apps/speckit-extension/CHANGELOG.md`, `CHANGELOG.md`, `CLAUDE.md`, `docs/doc-sync.md`, `.claude/pr-profile.md`, `.claude/review-checklist.md`, `.claude/skills/release-qa/SKILL.md`, `apps/vscode/webview/src/pipeline-builder/__stories__/PipelineBuilder.stories.tsx`

**Wave 1 — independent (different files):**

- [x] **T023** [P] [US4] Add the start hook row and fix the hook prose · `apps/speckit-extension/README.md`
- [x] **T024** [P] [US4] Twenty-four commands, the hooks table, a start hook section, the new specify finish calls · `apps/speckit-extension/docs/commands.md`
- [x] **T025** [P] [US4] Replace the "Command families" preset section · `apps/speckit-extension/docs/install.md`
- [x] **T026** [P] [US4] Replace the "stock carrier" section and the golden sentences · `apps/speckit-extension/docs/node-model.md`
- [x] **T027** [P] [US4] Show before and after in the hook chain; fix the hook counts · `apps/speckit-extension/docs/how-it-works.md`, `apps/speckit-extension/docs/contributing.md`, `apps/speckit-extension/docs/publishing.md`
- [x] **T028** [P] [US4] Replace the unreleased "wrap" entry with the hooks-only one · `apps/speckit-extension/CHANGELOG.md`
- [x] **T029** [P] [US4] Replace the unreleased "refresh" entry with the cleanup one · `CHANGELOG.md`
- [x] **T030** [P] [US4] Rewrite the isolation exception: activation only removes a leftover preset · `CLAUDE.md`
- [x] **T031** [P] [US4] Fix the preset mentions in the contributor guides · `docs/doc-sync.md`, `.claude/pr-profile.md`, `.claude/review-checklist.md`, `.claude/skills/release-qa/SKILL.md`
- [x] **T032** [P] [US4] Reword the Storybook preset fixture that names the retired preset · `apps/vscode/webview/src/pipeline-builder/__stories__/PipelineBuilder.stories.tsx`

**Checkpoint**: no shipped doc claims timing is added inside spec-kit's commands.

## Phase 7: Polish

- [x] **T033** Regenerate the committed `specify` fixtures through the CLI and keep only those files · `.specify/extensions.yml`, `.specify/extensions/.registry`, `.claude/skills/speckit-{specify,plan,tasks,implement,clarify,analyze,constitution}/SKILL.md`
- [x] **T034** Run the extension checks: `build.py --check`, `package-manifest.py --check`, `check-command-emissions.py`, `check_quality.py --strict --commands-dir`, and the Python tests
- [x] **T035** Run the VS Code checks: type-check and the jest suites for settings, steering, ai-providers and docs-consistency
- [x] **T036** Validate against the Success Criteria: seven stock commands byte-identical in a fresh project, and no doc hit for the old claims

## Dependencies & Execution Order

- Setup is done. Foundational blocks everything: the build cannot pass while tooling still names the deleted preset.
- Foundational: Wave 1 (delete, carrier list) blocks Wave 2 (checks, tests, CI name).
- US1, US2, US3 and US4 own disjoint files and can run in parallel after Foundational.
- US2: Wave 1 (reconciler, steering reader, desktop check) blocks Wave 2 (activation call, Steering tree).
- Polish runs last: T033 needs the final manifest, T034 to T036 need everything.
