# Tasks: Amend a spec after work has started

> **Scale note**: about 20 files across the writer, the viewer and a new command. The foundational phase gives every story the `amendments` field; the command and the Overview row then run in parallel on disjoint files.

## Phase 1: Setup

None.

## Phase 2: Foundational - the `amendments` field (blocks every story)

**Wave 1 — tests first (different files):**
- [x] **T001** [P] Writer tests: `--amend` appends one entry with `at`, `by`, `what`, `why`, `replanned`; two identical amendments both survive; `--batch` with `amendments` appends; a malformed `amendments` batch is refused before writing; an amend call writes no lifecycle history and never changes status (FR-002, FR-004) · apps/speckit-extension/tests/test_capture_fields.py, apps/speckit-extension/tests/test_cli_parity.py
- [x] **T002** [P] Schema test: a record with `amendments` parses and one without still parses · packages/viewer/tests/schemas.test.ts

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**
- [x] **T003** [P] `append_amendments`, `amendments` in `BATCH_KEYS`, `_parsed_batch` and `apply_batch` · apps/speckit-extension/scripts/capture.py
- [x] **T004** [P] `AmendmentEntry` and `amendments?` on `SpecContext` and `ViewerState` · packages/viewer/src/contract/specContext.ts, packages/viewer/src/contract/viewerState.ts
- [x] **T005** [P] `amendments` in the zod `SpecContextSchema` · packages/viewer/src/contract/schemas.ts
- [x] **T006** [P] `amendments` on the VS Code `ViewerState` copy and the JSON schema · apps/vscode/src/core/types/specContext.ts, apps/vscode/src/core/types/spec-context.schema.json

**⟶ Wait for Wave 2 to finish, then:**
- [x] **T007** `--amend` flag, `capture_mode`, the writer list, `_CAPTURE_FLAGS` and the `--batch` help · apps/speckit-extension/scripts/write-context.py

## Phase 3: User Stories 1, 2 and 3 - the amend command (Priority: P1)

Files: apps/speckit-extension/commands/speckit.companion.amend.md, apps/speckit-extension/extension.yml, .specify/extensions/.registry, apps/speckit-extension/README.md, apps/speckit-extension/docs/commands.md, apps/website/src/content/docs/docs/reference/commands.mdx, apps/website/src/content/docs/docs/steps/index.mdx, apps/speckit-extension/tests/test_amend_command.py

**Goal**: amend edits the spec in place, records it, replans only when requirements changed, never moves status back, and asks keep-or-remove for removed requirements.

**Independent Test**: the command is registered, its body carries each rule, and the emission checks pass.

### Tests

**Wave 1:**
- [x] **T008** [US1] [US2] [US3] Test the amend body and its registration: edits spec.md in place and never mints a folder (FR-001); records with `--amend` (FR-002); dispatches `speckit.companion.plan` then `speckit.converge` only when requirements were added or removed (FR-003); never writes status and points a completed spec to Set status (FR-004); keep-or-remove attended, concern unattended (FR-005); listed in extension.yml, the registry, README and docs/commands.md with matching descriptions (FR-007) · apps/speckit-extension/tests/test_amend_command.py

### Implementation

**Wave 1 — independent (different files):**
- [x] **T009** [P] [US1] [US2] [US3] Write the flat command body from resume's shape · apps/speckit-extension/commands/speckit.companion.amend.md
- [x] **T010** [P] [US1] Register it in `provides.commands` and the tracked registry · apps/speckit-extension/extension.yml, .specify/extensions/.registry
- [x] **T011** [P] [US1] Document it in the extension README and the command reference · apps/speckit-extension/README.md, apps/speckit-extension/docs/commands.md
- [x] **T012** [P] [US1] Site: a Run state row and the "flow forward" paragraph in How Companion keeps specs (FR-007) · apps/website/src/content/docs/docs/reference/commands.mdx, apps/website/src/content/docs/docs/steps/index.mdx

**Checkpoint**: amend runs from any agent the extension installs into.

## Phase 4: User Story 4 - the Overview shows it (Priority: P2)

Files: packages/viewer/src/core/stateDerivation.ts, packages/viewer/src/core/overviewAvailability.ts, packages/viewer/src/view/components/OverviewDossier.tsx, apps/vscode/src/features/spec-viewer/__tests__/stateDerivation.test.ts, apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx, apps/vscode/src/core/utils/__tests__/overviewAvailability.test.ts, apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx, apps/website/src/content/docs/docs/results/the-overview.mdx, .changeset/amended-overview-row.md

**Goal**: an amended spec's Overview says so.

**Independent Test**: a spec with two amendments shows "Amended · 2 times · last: …"; one with none shows no row.

### Tests

**Wave 1 — independent (different files):**
- [x] **T013** [P] [US4] Derivation carries amendments and drops malformed ones; absent on older records (FR-006) · apps/vscode/src/features/spec-viewer/__tests__/stateDerivation.test.ts
- [x] **T014** [P] [US4] The intent block shows the Amended row with count and last change, and none without amendments (FR-006) · apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx
- [x] **T015** [P] [US4] A spec with only amendments still has an Overview · apps/vscode/src/core/utils/__tests__/overviewAvailability.test.ts

### Implementation

**Wave 1 — independent (different files):**
- [x] **T016** [P] [US4] `pickAmendments` and the `amendments` field in the derived state · packages/viewer/src/core/stateDerivation.ts
- [x] **T017** [P] [US4] `amendments` counts as recorded activity · packages/viewer/src/core/overviewAvailability.ts
- [x] **T018** [P] [US4] The Amended row after Replaces, and amendments in `lineage` · packages/viewer/src/view/components/OverviewDossier.tsx

**⟶ Wait for Wave 1 to finish, then:**
- [x] **T019** [P] [US4] An amended variant of the lineage story · apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx
- [x] **T020** [P] [US4] The intent card description mentions the Amended row · apps/website/src/content/docs/docs/results/the-overview.mdx
- [x] **T021** [P] [US4] A speckit-viewer changeset · .changeset/amended-overview-row.md

**Checkpoint**: the Overview shows amendments.

## Phase 5: Polish

**Wave 1 — independent (different files):**
- [x] **T022** [P] One `[Unreleased]` line for amend · apps/speckit-extension/CHANGELOG.md
- [x] **T023** [P] One `[Unreleased]` line for the Overview row · CHANGELOG.md

**⟶ Wait for Wave 1 to finish, then:**
- [x] **T024** Validate SC-001 to SC-004: the extension suite, `check-command-emissions.py`, `build.py --check`, the related jest suites, `npx tsc --noEmit -p ./`, the viewer build, and the changelog consistency test · apps/speckit-extension/tests

## Dependencies & Execution Order

- Foundational (Phase 2) blocks Phases 3 and 4: tests (T001, T002) → field and contract (T003–T006) → `--amend` (T007).
- Phases 3 and 4 own disjoint files and run side by side.
- Phase 3: T008, then T009–T012 in one wave.
- Phase 4: T013–T015, then T016–T018, then T019–T021.
- Polish: T022, T023, then T024.
