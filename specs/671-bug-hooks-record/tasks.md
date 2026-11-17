# Tasks: Record bug runs through the bug hooks

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/hooks.md](./contracts/hooks.md)

## Phase 1: Setup

No setup: the writer, the pane and the test harnesses already exist.

## Phase 2: Foundational

Files: `apps/speckit-extension/scripts/write-context.py`, `apps/speckit-extension/scripts/spec_context.py`

**Wave 1 — one file:**

- [x] **T001** Add `--bug <slug>`: validate the slug (`^[a-z0-9][a-z0-9._-]*$`), refuse it with `--feature-dir`, resolve the target to `<repo>/.specify/bugs/<slug>/`, allow only `assess`, `fix`, `test` as steps, and make `--hook start|finish` write a start or complete with no status change · `apps/speckit-extension/scripts/write-context.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T002** On a `--bug` finish, read the stage's outcome from its report (`assessment.md` Verdict, `fix.md` Status, `test.md` Result) into the entry's `did` · `apps/speckit-extension/scripts/write-context.py`

## Phase 3: User Story 1 - A bug run typed in chat leaves a record (P1)

Files: `apps/speckit-extension/extension.yml`, `apps/speckit-extension/commands/speckit.companion.before-bug.md`, `apps/speckit-extension/commands/speckit.companion.after-bug.md`, `.specify/extensions/.registry`

### Tests

Files: `apps/speckit-extension/tests/test_bug_hooks.py`

- [x] **T003** [US1] FR-001: `extension.yml` registers all six bug hook keys, each pointing at a command listed in `provides.commands` · `apps/speckit-extension/tests/test_bug_hooks.py`
- [x] **T004** [US1] FR-002, FR-005: running the writer CLI with `--hook start` then `--hook finish --bug login-timeout --step assess` leaves a start and a complete for `assess` in `.specify/bugs/login-timeout/.spec-context.json`; a second run appends, never replaces; a bad slug writes nothing · `apps/speckit-extension/tests/test_bug_hooks.py`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T005** [P] [US1] Add `speckit.companion.before-bug` and `speckit.companion.after-bug`, one line each, telling the agent to pass the slug and stage the bug command just resolved · `apps/speckit-extension/commands/`
- [x] **T006** [P] [US1] Register the six hooks and the two commands · `apps/speckit-extension/extension.yml`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T007** [US1] Re-install the dev extension and keep `.specify/extensions/.registry` in the diff, as CI's command-emission check requires · `.specify/extensions/.registry`

**Checkpoint**: a chat bug run leaves a record.

## Phase 4: User Story 2 - Partial and stopped runs are visible (P1)

### Tests

Files: `apps/speckit-extension/tests/test_bug_hooks.py` (owned by Phase 3; these extend it after Phase 3), `apps/vscode/src/features/bugs/__tests__/bugRecord.test.ts`

- [x] **T008** [US2] FR-003: a fix finish with `**Status**: partial` in `fix.md` records `did: partial`; an assess finish with verdict `invalid` records `invalid` · `apps/speckit-extension/tests/test_bug_hooks.py`
- [x] **T009** [US2] FR-004: a record with assess done and a fix start with no finish, then a test start, reads fix as stopped; a lone fix start reads as running · `apps/vscode/src/features/bugs/__tests__/bugRecord.test.ts`

### Implementation

Files: `apps/vscode/src/features/bugs/bugRecord.ts`

- [x] **T010** [US2] `recordRun(directory)`: read the bug's `.spec-context.json` with `readSpecContextSyncSafe`, map history to stages with state done, stopped or running, seconds and outcome; undefined when there is no record · `apps/vscode/src/features/bugs/bugRecord.ts`

**Checkpoint**: stopped and partial stages read correctly.

## Phase 5: User Story 3 - The pane shows stage times once (P2)

Files: `apps/vscode/src/features/bugs/bugReports.ts`, `apps/vscode/src/features/spec-viewer/reportPanels.ts`, `apps/vscode/src/features/reports/bugStory.ts`, `apps/vscode/src/features/reports/reportPageModel.ts`, `apps/vscode/webview/src/spec-viewer/report-pages/BugStoryPage.tsx`, `apps/vscode/webview/src/spec-viewer/__stories__/ReportPages.stories.tsx`

### Tests

Files: `apps/vscode/src/features/reports/__tests__/bugStory.test.ts`, `apps/vscode/webview/src/spec-viewer/report-pages/__tests__/BugStoryPage.test.tsx`

- [x] **T011** [US3] FR-006, FR-007, FR-008: the story built with a record and no engine shows a Run log from the record; with both, the engine's steps only; with neither, no Run log · `apps/vscode/src/features/reports/__tests__/bugStory.test.ts`
- [x] **T012** [US3] FR-006: the page's Run log caption says the times come from Companion's record for a recorded run, and from spec-kit's run log for an engine run · `apps/vscode/webview/src/spec-viewer/report-pages/__tests__/BugStoryPage.test.tsx`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T013** [P] [US3] `BugReport.record` from `recordRun` when the bug has no engine run · `apps/vscode/src/features/bugs/bugReports.ts`
- [x] **T014** [P] [US3] `BugEngineView.source: 'engine' | 'record'`, run id and workflow optional for a record · `apps/vscode/src/features/reports/reportPageModel.ts`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T015** [P] [US3] Pass `record` in the story extras · `apps/vscode/src/features/spec-viewer/reportPanels.ts`
- [x] **T016** [P] [US3] Build the Run log from the engine run, else from the record · `apps/vscode/src/features/reports/bugStory.ts`
- [x] **T017** [P] [US3] Caption the Run log by source · `apps/vscode/webview/src/spec-viewer/report-pages/BugStoryPage.tsx`
- [x] **T018** [P] [US3] Add a recorded-run story beside the engine one · `apps/vscode/webview/src/spec-viewer/__stories__/ReportPages.stories.tsx`

**Checkpoint**: the bug page shows stage times once.

## Phase 6: Polish

- [x] **T019** One `[Unreleased]` line in each changelog: the spec-kit extension (records chat bug runs) and the VS Code extension (the bug page shows those times) · `apps/speckit-extension/CHANGELOG.md`, `CHANGELOG.md`
- [x] **T020** Validate against the Success Criteria: `npx tsc --noEmit -p ./`, the related jest tests, the spec-kit extension suite, `check_shape_parity.py`, `docs-consistency.test.ts`

## Dependencies & Execution Order

Foundational (T001 → T002) blocks every story. Phase 3: tests, then Wave 1 (T005, T006), then T007. Phase 4 needs Phase 3's test file and T002; T010 is its own file. Phase 5 needs T010: Wave 1 (T013, T014) blocks Wave 2 (T015–T018). Polish runs last.
