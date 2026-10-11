# Tasks: Keep the recording tooling here, send the films elsewhere

**Feature**: [recording-tooling-home.spec.md](./recording-tooling-home.spec.md) · **Plan**: [plan.md](./plan.md)

No Setup or Foundational phase: no story waits on another story's files.

## Phase 1: User Story 1 - Every recording the films need comes from one command on main (P1)

**Goal**: all recording code is on this branch and a missed task tick fails.

**Independent Test**: `npm run record:board` exits 0 and `.record/` holds `board-run-steps` and `board-spec-journey`.

Files: `tooling/scripts/board-shots.mjs`, `tooling/scripts/terminal-check.mjs`, `tooling/scripts/lib/recording.mjs`, `tooling/scripts/lib/teamboard-run.mjs`

### Implementation

**Wave 1 — the commit's script changes:**

- [x] **T001** [US1] Apply the script hunks of `90b5b159` (not its docs hunk): the run-steps film, `READ_SECONDS`, `writeTeamboardRecord` and `RECORD_STATES` · `tooling/scripts/board-shots.mjs`, `tooling/scripts/lib/recording.mjs`, `tooling/scripts/lib/teamboard-run.mjs`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T002** [P] [US1] Apply the `board-run` worktree diff: the `board-spec-journey` film with its event marks · `tooling/scripts/board-shots.mjs`
- [x] **T003** [P] [US1] Apply the `board-run` worktree diff on top of this tree's `film-session-start` edit: `film-tick-task` on `RUN_FOLDER` · `tooling/scripts/terminal-check.mjs`

**⟶ Wait for Wave 2 to finish, then:**

- [x] **T004** [US1] Add `tickTask(file, id)` that throws when the task line is missing, and use it for every recorded tick · `tooling/scripts/lib/teamboard-run.mjs`, `tooling/scripts/board-shots.mjs`, `tooling/scripts/terminal-check.mjs`

**⟶ Wait for T004, then:**

- [x] **T005** [US1] Run `node --check` on the four scripts and `npm run record:board`; confirm both new board recordings are written · `.record/`

**Checkpoint**: the board films record from a clean checkout.

## Phase 2: User Story 2 - A skill can make one still or one recording by reading one page (P2)

**Goal**: one page tells a skill which command to run.

**Independent Test**: the stills and recordings sections name every command, the one-step flag and where it works, the output folder and the machine needs.

Files: `docs/visual-assets.md`

### Implementation

- [x] **T006** [US2] Add a short stills runbook: one table of command, what it makes, where it lands and what the machine needs, plus how to run one step with `--only` and which commands read it · `docs/visual-assets.md`

**⟶ Wait for T006, then:**

- [x] **T007** [US2] Bring the recordings section up to date in place: add `board-run-steps`, `board-spec-journey` and `mod-session-start` to the table, fix the step count, say how to record one step, state the machine needs, and add one sentence on how the other repository turns frames into plates · `docs/visual-assets.md`

**Checkpoint**: the guide matches the scripts.

## Phase 3: User Story 3 - One file says what the product looks like in marketing (P2)

**Goal**: one file holds the look, with real values.

**Independent Test**: every colour in `THEME.md` equals its value in `apps/website/src/styles/tokens.css`, and `npx vsce ls` does not list `THEME.md`.

Files: `THEME.md`, `DESIGN.md`, `CLAUDE.md`, `.vscodeignore`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T008** [P] [US3] Write the look file: palette, type by role, mascot and mark paths, motifs, and what it does not cover · `THEME.md`
- [x] **T009** [P] [US3] Add one line pointing at `THEME.md` for site-matching work · `DESIGN.md`
- [x] **T010** [P] [US3] Add one line for `THEME.md` under "Where things are documented" · `CLAUDE.md`
- [x] **T011** [P] [US3] Keep `THEME.md` out of the package · `.vscodeignore`

**Checkpoint**: the look is stated once and does not ship.

## Phase 4: Polish

- [x] **T012** Validate against the Success Criteria: `npm run compile && npm test`, every colour in `THEME.md` checked against the token file by script, every path in it exists, `npx vsce ls` has no `THEME.md`, no `videos/` folder, and no hard-wrapped paragraph in the changed `.md` files

## Dependencies & Execution Order

Phases 1, 2 and 3 own different files and can run side by side. Polish runs last.

- **Phase 1**: T001 blocks T002 and T003, which block T004, which blocks T005.
- **Phase 2**: T006 then T007, same file. T007 names recordings that Phase 1 adds, by name only.
- **Phase 3**: one wave of four.
