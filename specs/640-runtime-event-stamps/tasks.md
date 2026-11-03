# Tasks: Step boundaries from runtime events

## Phase 1: Setup

None.

## Phase 2: Foundational

Files: `apps/speckit-extension/scripts/write-context.py`

**Wave 1 — one file, in order:**

- [x] **T001** Add `--event user_prompt_submit|stop`: read stdin JSON defensively; a step-command prompt becomes `--hook start --step <step>`; any other prompt is a no-op · apps/speckit-extension/scripts/write-context.py
- [x] **T002** Stop gate: newest open step whose document changed after its start (implement also at 100%), or a saved specify start older than the spec file, becomes `--hook finish`; otherwise a no-op · apps/speckit-extension/scripts/write-context.py
- [x] **T003** Event mode in `main()`: buffer both streams (still traced), always exit 0, trace op `event` · apps/speckit-extension/scripts/write-context.py

**⟶ Wait for Phase 2 to finish, then:**

## Phase 3: User Stories 1, 2 and 3 - wire the handlers (P1)

Files: `apps/speckit-extension/commands/speckit.companion.on-prompt.md`, `apps/speckit-extension/commands/speckit.companion.on-stop.md`, `apps/speckit-extension/extension.yml`, `apps/speckit-extension/scripts/check_quality.py`, `apps/speckit-extension/README.md`, `apps/speckit-extension/docs/commands.md`, `apps/speckit-extension/tests/test_event_mode.py`

### Tests

- [x] **T004** [US1] [US2] [US3] Prompt variants stamp the start, others write nothing; stop closes plan only after `plan.md` changes; a clarifying-question stop on specify closes nothing; implement with unchecked tasks stays open; a closed step is unchanged; every payload (Stop, malformed, empty, no spec) exits 0 with empty stdout and stderr · apps/speckit-extension/tests/test_event_mode.py

### Implementation

**Wave 1 — independent (different files):**

- [x] **T005** [P] [US1] Two handler commands with `scripts: py: scripts/write-context.py --event <name>` and a one-line body saying they run on their own · apps/speckit-extension/commands/speckit.companion.on-prompt.md, apps/speckit-extension/commands/speckit.companion.on-stop.md
- [x] **T006** [P] [US1] `provides.commands` entries and an `events:` block (user_prompt_submit, stop, timeout 10) · apps/speckit-extension/extension.yml
- [x] **T007** [P] [US3] Add both handlers to `NEVER_PROMPT` · apps/speckit-extension/scripts/check_quality.py
- [x] **T008** [P] [US1] Name the handlers beside the hooks · apps/speckit-extension/README.md, apps/speckit-extension/docs/commands.md

**Checkpoint**: an agent with runtime events records starts and finishes with no model call; one without them keeps its hooks.

## Phase 4: Polish

- [x] **T009** [P] One `[Unreleased]` line · apps/speckit-extension/CHANGELOG.md
- [x] **T010** Run the Python suite, `build.py --check`, `check-command-emissions.py`, `check_quality.py --strict`, `package-manifest.py --check` and `tsc` · apps/speckit-extension/

## Dependencies & Execution Order

- Phase 2 blocks Phase 3. Phase 2: T001, T002, T003 in order (one file). Phase 3: T004, then wave 1 (T005 to T008). Phase 4 last.
