---
description: "Task list for Complexity Fast-Path"
---

# Tasks: Complexity Fast-Path

**Input**: Design documents from `/specs/137-complexity-fast-path/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Tests are scoped to the two named deliverables — the Jest precedence test (`companionPresetReconciler.test.ts`) and the end-to-end eval (`check_capture.py`). No speculative test tasks are added; the command-body logic is AI-prompt text verified by the eval, not by unit tests.

**Organization**: Tasks are grouped by user story. US1 and US2 share the classify step (foundational); each adds its own branch to the same command body, so they are sequential on that file. US3 is the config-resolution machinery and is independent of the command body.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to (US1, US2, US3)
- Paths are absolute-from-repo-root; two extensions live here — VS Code extension in `src/`, spec-kit extension in `speckit-extension/`.

## Path note

This feature spans **two co-located extensions**:
- **VS Code extension** (`src/`, `package.json`) — the config knob (setting + resolution + mirror).
- **spec-kit extension** (`speckit-extension/`) — the classify step + fast-path branch + lifecycle fold, carried in **command bodies** (not templates, per `docs/template-profiles.md`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Declare the config knob's identity and schema so both the resolver and the command body can reference it.

- [x] **T001** [P] Add `complexityFastPath: 'speckit.companion.complexityFastPath'` to the `ConfigKeys` object in `src/core/constants.ts`
- [x] **T002** [P] Add the `speckit.companion.complexityFastPath` boolean setting (`type: boolean`, `default: false`, `scope: window`, description per `contracts/config-setting.md`) to `contributes.configuration` in `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The classify step is the shared decision point that US1 (simple branch) and US2 (normal branch + guardrail) both build on. It MUST exist before either branch can be added.

**⚠️ CRITICAL**: US1 and US2 both edit `speckit.companion.specify.md` to attach their branch — they depend on this step and on each other for that file.

- [x] **T003** Add the **classify step** to `speckit-extension/commands/speckit.companion.specify.md`: after the spec content is drafted, read `complexityFastPath` from `.specify/companion.yml` (default `false` when absent — opt-in beta), estimate `projectedFiles` and `projectedTasks` from the drafted requirements, detect the scope-phrase signal (`smaller`/`larger`/`none`), and compute the `simple | normal` verdict per the decision block in `contracts/classification.md` (errs toward `normal` on weak/conflicting signals; the fixed 5-files / 10-tasks threshold is a constant in the body). Branch bodies are added per-story below.

**Checkpoint**: The command body classifies every run; the branch behaviors are filled in by US1 and US2.

---

## Phase 3: User Story 1 - Small change fast-tracks to implementation (Priority: P1) 🎯 MVP

**Goal**: A trivial change classifies `simple` and produces a single combined spec/plan/tasks artifact, landing the developer at the implement step in one run.

**Independent Test**: Run `/speckit.companion.specify` with description `rename foo to bar`. Expect one combined `spec.md` (Overview + FR + SC + Assumptions + Approach + Implementation Tasks), no separate `plan.md`/`tasks.md`, and `.spec-context.json` with `plan`+`tasks` `start`/`complete` pairs tagged `substep: "fast-path"` and `status: ready-to-implement`. (The fast-path flag defaults to `false` — set `speckit.companion.complexityFastPath: true` first to exercise this story.)

### Implementation for User Story 1

- [x] **T004** [P] [US1] Add a `--substep` CLI flag to `speckit-extension/scripts/write-context.py` (`parser.add_argument("--substep", default=None)`) and thread it into the step-level `start`/`complete` entries written by the `--step`/`--kind` path, so a folded entry carries `substep: "fast-path"` instead of `null`
- [x] **T005** [US1] Add the **simple / minimal-mode branch** to `speckit-extension/commands/speckit.companion.specify.md`: when `verdict == "simple"`, write the combined `spec.md` with two appended sections — a compact **Approach** (files to touch / dependencies) and an **Implementation Tasks** list (`[Tn] [P?] + path`) — still write `checklists/requirements.md`, and do **not** emit separate `plan.md` / `tasks.md` (per `contracts/classification.md` + research Decision 4)
- [x] **T006** [US1] In the simple branch of `speckit-extension/commands/speckit.companion.specify.md`, append the **lifecycle fold** by calling `write-context.py` in order — `plan` start, `plan` complete, `tasks` start, `tasks` complete — each with `--substep fast-path --by ai`, the final call adding `--status ready-to-implement`, exactly per `contracts/lifecycle-fold.md` (depends on T004 for `--substep`)

**Checkpoint**: A one-line-change spec fast-tracks end-to-end to implement; US1 is independently demoable (SC-001, SC-005).

---

## Phase 4: User Story 2 - Large change keeps the full pipeline (Priority: P1)

**Goal**: A substantial change classifies `normal`, writes `spec.md` only, and runs the full specify → plan → tasks → implement sequence; threshold crossings warn rather than silently fast-track.

**Independent Test**: Run `/speckit.companion.specify` with `add OAuth login with token refresh and session storage`. Expect `spec.md` only, classified `normal`, with distinct `/speckit.companion.plan` and `/speckit.companion.tasks` runs following. A description naming > 5 files or implying > 10 tasks emits the guardrail warning.

### Implementation for User Story 2

- [x] **T007** [US2] Add the **normal branch** to `speckit-extension/commands/speckit.companion.specify.md`: when `verdict == "normal"`, write `spec.md` only (no combined sections, no lifecycle fold) and let the existing full pipeline continue unchanged — plan and tasks are recorded by their own `/speckit.companion.plan` / `/speckit.companion.tasks` runs (depends on T003)
- [x] **T008** [US2] Add the **guardrail warning** to `speckit-extension/commands/speckit.companion.specify.md`: when `projectedFiles > 5` OR `projectedTasks > 10` OR `scopeSignal == "larger"`, emit `[companion] Change exceeds the small-change guardrail (5 files / 10 tasks) — running the full pipeline.` then run `normal`; exactly-at-threshold (5 files / 10 tasks) is the simple ceiling and does NOT warn (per `contracts/classification.md`, SC-003)

**Checkpoint**: Large and boundary changes run the full pipeline with a guardrail warning; US1 and US2 both work (SC-002, SC-003).

---

## Phase 5: User Story 3 - Developer can force the full pipeline (Priority: P2)

**Goal**: The fast-path is opt-in — an editor setting (default off) enables auto-detection; when it is off, every change runs the full pipeline.

**Independent Test**: With `speckit.companion.complexityFastPath` unset or `false` (VS Code settings), run `/speckit.companion.specify` on a one-line change. Expect the full pipeline, no combining, no warning. The editor setting is the source of truth; the extension mirrors it into `.specify/companion.yml`, which the command body reads.

### Implementation for User Story 3

- [x] **T009** [US3] Implement `resolveComplexityFastPath()` in `src/features/settings/companionPresetReconciler.ts`: resolve `settingValue ?? false` (the VS Code `speckit.companion.complexityFastPath` setting is the single source of truth) and mirror it into `.specify/companion.yml` alongside `templateProfile`, matching the existing mirror pattern (per `contracts/config-setting.md`, research Decision 3)
- [x] **T010** [P] [US3] Add Jest tests for `resolveComplexityFastPath` to `src/features/settings/companionPresetReconciler.test.ts` covering the mirror behavior from `contracts/config-setting.md` (setting `true` → `true`; setting `false` → `false`; setting absent → `false`) and that the resolved value is mirrored into `companion.yml`

**Checkpoint**: With the flag off, trivial changes run the full pipeline; precedence is deterministic (SC-004). The command body's `fastPathEnabled == false → normal, no warning` behavior already lands via the classify decision (T003).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Keep the preset parity copy, docs, changelogs, and eval in lockstep with the behavior change (docs are part of the change, not a follow-up — see CLAUDE.md).

- [x] **T011** Sync the full classify step + simple branch + normal branch + guardrail warning from `speckit-extension/commands/speckit.companion.specify.md` into the preset parity copy `speckit-extension/presets/companion-turbo/commands/speckit.specify.md` so the two bodies stay in parity (depends on T003, T005, T006, T007, T008)
- [x] **T012** [P] Update `docs/template-profiles.md`: document the classify step, the simple/normal branch, the combined-artifact shape (Approach + Implementation Tasks in `spec.md`), and the guardrail warning
- [x] **T013** [P] Update root `README.md` (new `speckit.companion.complexityFastPath` setting + fast-track behavior, Configuration section) and `CHANGELOG.md` (user-facing release note, VS Code side — no internal symbol names)
- [x] **T014** [P] Update `speckit-extension/README.md` (classify + fast-path behavior) and `speckit-extension/CHANGELOG.md` (spec-kit-side release note); leave the `extension.yml` version bump to the `/publish-speckit-ext` release flow
- [x] **T015** [P] Add fast-path assertions to the eval `.claude/skills/eval-speckit-extension/check_capture.py`: confirm a fast-tracked spec has folded `plan`/`tasks` `start`+`complete` history entries tagged `substep: "fast-path"`, real (non-backfilled) timestamps, and final `status: ready-to-implement`
- [x] **T016** Run `quickstart.md` validation — all five scenarios (small fast-tracks, large full pipeline, guardrail warning, opt-out, eval)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001, T002 in parallel.
- **Foundational (Phase 2)**: After Setup. T003 declares the shared classify decision — BLOCKS US1 and US2.
- **US1 (Phase 3)**: After T003. MVP slice; testable at default flag without US3.
- **US2 (Phase 4)**: After T003. Edits the same command body as US1 — sequence US2 after US1's edits to avoid same-file conflicts.
- **US3 (Phase 5)**: Independent of the command body (TypeScript-only) — can run any time after Setup.
- **Polish (Phase 6)**: T011 after all command-body tasks (T003, T005, T006, T007, T008); T012–T015 in parallel; T016 last.

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (T003). No dependency on US2 or US3.
- **US2 (P1)**: Depends on Foundational (T003). Shares `speckit.companion.specify.md` with US1 → sequence after US1's file edits.
- **US3 (P2)**: Independent — config resolution in `src/`, no command-body dependency.

### Within Each User Story

- US1: T004 (script flag, parallel) → T005 (simple branch) → T006 (fold, needs T004 + T005).
- US2: T007 (normal branch) and T008 (guardrail) both edit one file → sequential.
- US3: T009 (resolver) → T010 (tests).

### Parallel Opportunities

- T001 ∥ T002 (Setup).
- T004 ∥ T005-start are different files (write-context.py vs the command body) — T004 can run alongside the US1 command-body work, but T006 needs T004.
- US3 (T009→T010) runs fully in parallel with US1/US2 (different extension, different files).
- Polish T012 ∥ T013 ∥ T014 ∥ T015 (distinct files).

---

## Parallel Example: kick-off

```bash
# Setup in parallel:
Task: "Add complexityFastPath to ConfigKeys in src/core/constants.ts"
Task: "Add speckit.companion.complexityFastPath setting to package.json"

# US3 runs alongside the command-body track (different files):
Task: "Implement resolveComplexityFastPath in companionPresetReconciler.ts"
Task: "Add the --substep flag to write-context.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Setup (T001, T002) → Foundational classify step (T003).
2. US1 (T004, T005, T006) → a one-line change fast-tracks to implement.
3. **STOP and VALIDATE**: run quickstart scenario 1 — combined `spec.md`, folded lifecycle, `ready-to-implement`.

### Incremental Delivery

1. MVP (US1) — small changes fast-track (SC-001, SC-005).
2. US2 — large/boundary changes keep the full pipeline + guardrail (SC-002, SC-003).
3. US3 — opt-in flag (editor setting, default off), mirrored to companion.yml (SC-004).
4. Polish — preset parity, docs, changelogs, eval, quickstart.

---

## Notes

- The classify step and both branches are **AI-prompt logic in command bodies**, not TypeScript — verified by the eval (T015) and quickstart (T016), not unit tests.
- Two extensions, two changelogs: VS Code side (T013) and spec-kit side (T014) — never cross them, and never edit `.specify/extensions/companion/CHANGELOG.md` (generated).
- Extension isolation: the command body reads the **mirrored** `companion.yml` value; it never reads VS Code settings directly. The mirror lives once in `resolveComplexityFastPath` (T009).
- Keep the preset copy (T011) byte-for-byte in parity with the per-spec opt-in command body.
