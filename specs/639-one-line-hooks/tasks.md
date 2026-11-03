# Tasks: One-line journaling hooks

## Phase 1: Setup

None.

## Phase 2: Foundational

Files: `apps/speckit-extension/scripts/write-context.py`, `apps/speckit-extension/scripts/spec_context.py`

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add `pending_start_path(project_root)` beside the lock root, keyed by a hash of the project root · apps/speckit-extension/scripts/spec_context.py
- [x] **T002** [P] Add `--hook start|finish`: rewrite into today's `--kind`/`--status`/`--tasks-file` early in `_main()`; specify start saves the clock (or `--at`) and writes no record; specify finish records the saved start then the finish and deletes the file; implement finish syncs `<feature>/tasks.md`; any non-zero exit in a hook call becomes 0; add `--hook` to the guard lists and `_OP_FLAGS` · apps/speckit-extension/scripts/write-context.py

**⟶ Wait for Phase 2 to finish, then:**

## Phase 3: User Stories 1 and 2 - one-line pages, specify start without a carried time (P1)

Files: `apps/speckit-extension/commands/speckit.companion.before-step.md`, `apps/speckit-extension/commands/speckit.companion.after-specify.md`, `apps/speckit-extension/commands/speckit.companion.after-plan.md`, `apps/speckit-extension/commands/speckit.companion.after-tasks.md`, `apps/speckit-extension/commands/speckit.companion.after-implement.md`, `apps/speckit-extension/commands/speckit.companion.before-converge.md`, `apps/speckit-extension/commands/speckit.companion.after-converge.md`, `apps/speckit-extension/extension.yml`, `apps/speckit-extension/docs/how-it-works.md`, `apps/speckit-extension/docs/commands.md`, `apps/speckit-extension/tests/test_before_step_hook.py`, `apps/speckit-extension/tests/test_hook_mode.py`

### Tests

- [x] **T003** [US1] [US2] Hook parity: each (boundary, step) writes the same history as today's call; a double fire leaves one start and one finish; specify start writes nothing and specify finish records the saved start then the finish; a stale saved time is ignored; a bad call exits 0 · apps/speckit-extension/tests/test_hook_mode.py

### Implementation

**Wave 1 — independent (different files):**

- [x] **T004** [P] [US1] Rewrite the seven hook pages to frontmatter, one sentence and one `--hook` call · apps/speckit-extension/commands/speckit.companion.{before-step,after-specify,after-plan,after-tasks,after-implement,before-converge,after-converge}.md
- [x] **T005** [P] [US1] Hook descriptions stop restating statuses and the clock read · apps/speckit-extension/extension.yml
- [x] **T006** [P] [US2] Docs describe the saved specify start instead of the clock handoff · apps/speckit-extension/docs/how-it-works.md, apps/speckit-extension/docs/commands.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T007** [US1] Pin the new page shape: one sentence, one `--hook` command, no python check · apps/speckit-extension/tests/test_before_step_hook.py

**Checkpoint**: a stock run records the same history through seven one-line pages.

## Phase 4: User Story 3 - an unreadable extensions.yml is reported (P2)

Files: `apps/speckit-extension/presets/_parts/speckit-hooks.md`, `apps/speckit-extension/commands/speckit.companion.specify.md`, `apps/speckit-extension/commands/speckit.companion.plan.md`, `apps/speckit-extension/commands/speckit.companion.tasks.md`, `apps/speckit-extension/commands/speckit.companion.implement.md`

- [x] **T008** [US3] Report an unparseable `.specify/extensions.yml` with the parser error and that no hooks were checked; an absent file still skips silently; rebuild with `build.py` · apps/speckit-extension/presets/_parts/speckit-hooks.md

**Checkpoint**: the four built Companion steps carry the stock wording.

## Phase 5: Polish

- [x] **T009** [P] One `[Unreleased]` line · apps/speckit-extension/CHANGELOG.md
- [x] **T010** Record the page line counts before (331) and after; run the Python suite, `build.py --check`, shape parity, `check-command-emissions.py` and `check_quality.py --strict` · apps/speckit-extension/

## Dependencies & Execution Order

- Phase 2 blocks Phase 3 (pages call `--hook`). Phase 4 is independent of Phase 2 and 3.
- Phase 3: T003, then wave 1 (T004 to T006), then T007. Phase 4: T008. Phase 5 last.
