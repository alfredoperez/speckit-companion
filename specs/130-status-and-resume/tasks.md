---
description: "Task list for Status + Resume (v1 boundary)"
---

# Tasks: Status + Resume (v1 boundary)

**Input**: Design documents from `/specs/130-status-and-resume/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included for the Python resolver (`status-context.py`) and the `lastTransition.ts` helper, matching the repo's existing test conventions (`speckit-extension/tests/test_context.py`, Jest BDD). The two markdown commands are agent-run, so their "tests" are quickstart validation tasks, not automated suites.

**Organization**: Tasks are grouped by user story. The Python resolver is foundational — both P1 stories depend on it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (status), US2 (resume), US3 (sidebar)
- Paths are repository-relative.

## Path Conventions

This is a single-project VS Code extension. New command behavior lives in the Companion-owned `speckit-extension/` package; GUI wiring lives in `src/features/specs/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new files so the foundational and story work has stable seams.

- [x] **T001** [P] Scaffold `speckit-extension/scripts/status-context.py` with shebang, `argparse` (`--feature-dir`), and feature-directory resolution copied from `write-context.py` (precedence: `--feature-dir` → `SPECIFY_FEATURE_DIRECTORY` → `SPECIFY_FEATURE` → `.specify/feature.json` → git branch prefix)
- [x] **T002** [P] Create command stubs `speckit-extension/commands/speckit.companion.status.md` and `speckit-extension/commands/speckit.companion.resume.md` with frontmatter `description` + a Prerequisites section (python3 check + graceful-skip warning) mirroring the existing `speckit.companion.capture-*.md` files

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `status-context.py` resolver that produces the `ResumeResolution` consumed by both US1 and US2. **No user story can be completed until this phase is done.**

- [x] **T003** Implement read-or-derive in `speckit-extension/scripts/status-context.py`: read `.spec-context.json`; on missing/malformed, fall back to `derive-from-files.py` inference (tasks.md→implement, plan.md→plan, spec.md→specify); set `source` to `"state"` or `"derived"` (research R4, FR-002/FR-006/FR-011)
- [x] **T004** Implement the next-step resolution table in `speckit-extension/scripts/status-context.py` producing the `ResumeResolution` object (`currentStep`, `status`, `decisions[]`, `nextStep`, `nextCommand`, `nextActionLabel`, `complete`) per data-model.md + research R3; read `decisions[]` as the top-level passthrough (research R1)
- [x] **T005** Add tasks-step granularity to `speckit-extension/scripts/status-context.py`: when `currentStep=implement` and tasks remain unchecked, set `nextTask` to the first unchecked task in `tasks.md` order; `nextCommand=/speckit.implement` (FR-005)
- [x] **T006** Emit dual output from `speckit-extension/scripts/status-context.py`: the human summary block AND a final machine line `RESOLUTION: {json}` so `resume` and tests parse deterministically (contracts/status-command.md); always `exit 0`, never fail the host (python3-missing guard)
- [x] **T007** [P] Add Python unit tests in `speckit-extension/tests/test_context.py` for the resolver: state read, derive fallback, each next-step row, terminal/`complete`, tasks-step `nextTask`, and the no-files "nothing to summarize" case

**Checkpoint**: Resolver returns correct `ResumeResolution` JSON for every state — US1 and US2 can now proceed in parallel.

---

## Phase 3: User Story 1 — See where a spec stands (Priority: P1) 🎯 MVP

**Goal**: `/speckit.companion.status` prints current step, status, decisions, and next action for the active spec.

**Independent test**: On a spec carried partway through the pipeline, run `/speckit.companion.status` and confirm the printed step/status/decisions/next-action match on-disk state; delete `.spec-context.json` and confirm it still prints with `source: derived`.

- [x] **T008** [US1] Flesh out `speckit-extension/commands/speckit.companion.status.md`: python3 guard + graceful skip, run `status-context.py`, print the human summary, always exit 0 (contracts/status-command.md, FR-001)
- [x] **T009** [US1] Validate status output for start-of-pipeline, mid-pipeline, derived (no state file), and malformed-state cases per quickstart.md §1 (FR-002/FR-011, SC-001/SC-003)

**Checkpoint**: US1 is independently shippable — this is the MVP.

---

## Phase 4: User Story 2 — Resume from where you stopped (Priority: P1)

**Goal**: `/speckit.companion.resume` advances the pipeline from the recorded step with decisions in scope, dispatching the next `/speckit.*` command.

**Independent test**: Carry a spec to `planned`, run resume, confirm it dispatches `/speckit.tasks` with decisions echoed; stop mid-implement and confirm it continues at the next unchecked task; on a terminal-state spec confirm it reports complete and dispatches nothing.

- [x] **T010** [US2] Flesh out `speckit-extension/commands/speckit.companion.resume.md`: python3 guard, run `status-context.py`, parse the `RESOLUTION:` line, branch on `complete` / derived-no-files / tasks-step / dispatch (contracts/resume-command.md, FR-003)
- [x] **T011** [US2] Implement decisions-in-scope dispatch in `speckit.companion.resume.md`: agent invokes the resolved `nextCommand` stating `decisions[]` as in-scope context; tasks-step continues at `nextTask` via `/speckit.implement` (FR-004/FR-005/FR-012); does NOT depend on a `specify workflow resume` CLI subcommand (research R2)
- [x] **T012** [US2] Implement terminal-state handling in `speckit.companion.resume.md`: `complete=true` → print "Pipeline complete — nothing to resume" and dispatch nothing (FR-010)
- [x] **T013** [US2] Validate resume for `planned→tasks`, tasks-step `nextTask`, and terminal-state per quickstart.md §2 (SC-002/SC-005)

**Checkpoint**: US2 is independently shippable on top of the foundational resolver; together with US1 completes both P1 stories.

---

## Phase 5: User Story 3 — See and act on status in the sidebar (Priority: P2)

**Goal**: The Companion sidebar shows current step, status badge, and last transition, plus an inline Resume action on active specs that dispatches resume and refreshes live.

**Independent test**: Open the sidebar on a spec at a known step; confirm step + badge + last-transition line render; click Resume and confirm state updates without a manual refresh. (Sidebar code is independent of US1/US2; the Resume button's end-to-end effect needs US2's command present.)

- [x] **T014** [P] [US3] Create `src/features/specs/lastTransition.ts`: derive `{label, at, relative}` from the last `ctx.history[]` entry; return `null` on empty history; `relative` measured from the entry's `at`, not `now − step start` (data-model LastTransition, research R5)
- [x] **T015** [P] [US3] Add Jest BDD test `src/features/specs/__tests__/lastTransition.test.ts` covering populated history, empty-history→null, and relative-time formatting
- [x] **T016** [US3] Edit `src/features/specs/specExplorerProvider.ts`: set each spec tree item's description/tooltip to current step + existing status badge + the last-transition label from `lastTransition.ts` (research R5, FR-007)
- [x] **T017** [US3] Register `speckit.specs.resume` in `src/features/specs/specCommands.ts`: handler dispatches `/speckit.companion.resume` via `dispatchSlashCommandViaTempFile` (provider-agnostic) (research R6, FR-008)
- [x] **T018** [US3] Add to `package.json`: `contributes.commands` entry `speckit.specs.resume` (title + icon) and a `view/item/context` inline entry gated to active lifecycle context values only (not completed/archived) (FR-008, constitution II)
- [x] **T019** [US3] Verify sidebar live-refresh: the existing `.spec-context.json` watcher re-renders step/status/last-transition after Resume with no manual refresh, per quickstart.md §3 (FR-009, SC-004)

**Checkpoint**: GUI surfacing complete; the canonical state is visible and actionable from the sidebar.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] **T020** [P] Update `README.md` (Custom Commands / Companion section) to document `/speckit.companion.status` and `/speckit.companion.resume` and the sidebar Resume action (CLAUDE.md docs rule)
- [x] **T021** [P] Update `docs/sidebar.md` for the inline Resume action, the last-transition line, and step/badge surfacing
- [x] **T022** [P] Update `speckit-extension/CHANGELOG.md` and `speckit-extension/docs/commands.md` for the two new commands
- [x] **T023** Authoring-parity validation per quickstart.md §4: a terminal-authored spec and a GUI-authored spec reach the same status/resume conclusion (FR-012, SC-005)
- [x] **T024** Graceful-degradation check: with `python3` unavailable, both commands warn and no-op without failing the host command

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → before everything.
- **Foundational (Phase 2)** → blocks US1 and US2. Hard gate.
- **US1 (Phase 3)** and **US2 (Phase 4)** → both depend only on Foundational; independent of each other.
- **US3 (Phase 5)** → sidebar code (T014–T018) is independent of US1/US2 and can be built in parallel; the Resume button's end-to-end behavior (T019) needs US2's command to exist.
- **Polish (Phase 6)** → after the stories it documents/validates.

### Story dependency graph

```text
Setup → Foundational ┬→ US1 (status)  ─┐
                     └→ US2 (resume) ──┼→ Polish
        US3 (sidebar code) ───────────┘   (T019 E2E waits on US2)
```

## Parallel Opportunities

- T001 ∥ T002 (different files).
- T007 (Python tests) ∥ the command flesh-out once the resolver API is stable.
- Within US3: T014 ∥ T015 (helper + its test, different files from the provider edits).
- Polish: T020 ∥ T021 ∥ T022 (independent docs).

## Implementation Strategy

- **MVP = US1 (status)** — the smallest independently shippable slice: install Companion, run `/speckit.companion.status`, see the spec's position. Ship it alone if needed.
- **Next increment = US2 (resume)** — the second P1, completing the command pair and the headline "continue where you stopped" capability.
- **Then US3 (sidebar)** — makes status/resume ambient in the GUI; P2, builds on the same canonical data.

## Format validation

All tasks use `- [ ] TNNN [P?] [Story?] description + path`. Setup/Foundational/Polish carry no story label; US1/US2/US3 tasks carry their label. Every task names the concrete file it touches.
