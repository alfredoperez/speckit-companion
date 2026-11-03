# Tasks: A clean converge completes the spec

## Phase 1: Setup

None.

## Phase 2: Foundational

Files: `apps/speckit-extension/scripts/write-context.py`

- [x] **T001** After a `--hook finish --step converge` write, complete the spec through `mark_spec_complete(feature_dir, "extension")` only when status is `implemented`, every task is checked and `tasks.md` was not modified after converge's start · apps/speckit-extension/scripts/write-context.py

**⟶ Wait for Phase 2 to finish, then:**

## Phase 3: User Story 1 - a clean converge completes the spec (P1)

Files: `apps/speckit-extension/tests/test_converge_completes.py`

### Tests

- [x] **T002** [US1] Clean converge completes by extension; a converge that touched tasks.md stays implemented; an implementing spec is not completed; an unchecked task blocks it; a completed spec is unchanged · apps/speckit-extension/tests/test_converge_completes.py

**Checkpoint**: a stock run's clean converge ends at completed with no model call.

## Phase 4: User Story 2 - the manual command is one line (P2)

Files: `apps/speckit-extension/commands/speckit.companion.mark-complete.md`, `apps/speckit-extension/extension.yml`, `apps/speckit-extension/docs/commands.md`

**Wave 1 — independent (different files):**

- [x] **T003** [P] [US2] The page becomes frontmatter, one sentence and one `--mark-complete` call · apps/speckit-extension/commands/speckit.companion.mark-complete.md
- [x] **T004** [P] [US2] Command description matches the page · apps/speckit-extension/extension.yml
- [x] **T005** [P] [US2] Say that the converge hook completes a clean spec · apps/speckit-extension/docs/commands.md

## Phase 5: Polish

- [x] **T006** [P] One `[Unreleased]` line · apps/speckit-extension/CHANGELOG.md
- [x] **T007** Run the Python suite, `build.py --check`, `check-command-emissions.py`, `check_quality.py --strict` and `package-manifest.py --check` · apps/speckit-extension/

## Dependencies & Execution Order

- Phase 2 blocks Phase 3. Phase 4 is independent. Phase 5 last.
