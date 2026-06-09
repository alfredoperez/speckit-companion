---
description: "Task list for Timing fidelity v2 — finish-only journaling + reconciler activation"
---

# Tasks: Timing fidelity v2 — finish-only journaling + reconciler activation

**Input**: Design documents from `specs/133-timing-fidelity-v2/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/capture-contracts.md, quickstart.md

**Tests**: This feature touches modules that already have test suites (`promptBuilder.test.ts`, `stepHistoryDerivation.test.ts`, `companionPresetReconciler.test.ts`). Those suites are updated in-place so they don't lie — not net-new TDD. The capture eval (`check_capture.py`) is the integration gate.

**Organization**: Grouped by the three user stories from spec.md so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, Polish carry no story label)

## Path Conventions

Two-extension repo. Spec-kit-side files live under `speckit-extension/`; VS Code-extension-side under `src/` + `webview/`; shared docs under `docs/`; the eval under `.claude/skills/eval-speckit-extension/`.

---

## Phase 1: Setup (Shared Baseline)

**Purpose**: Establish the green baseline before changing capture behavior.

- [x] T001 Confirm baseline on branch `133-timing-fidelity-v2`: bundled presets exist at `.specify/extensions/companion/presets/{companion-standard,companion-lean}`, and the two guards run clean — `python3 speckit-extension/scripts/check-shape-parity.py` and `python3 .claude/skills/eval-speckit-extension/check_capture.py specs/_02_demo-tasked/` — so any later failure is attributable to this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The finish-only writer primitive + guard that BOTH the live path (US1) and the backstop (US3) build on. Same file (`speckit-extension/scripts/write-context.py`), so these run sequentially.

**⚠️ CRITICAL**: US1 live journaling and US3 backstop both depend on this phase.

- [x] T002 Add a per-task finish path to `speckit-extension/scripts/write-context.py`: when invoked with `--task <id> --kind complete` (step `implement`), append exactly ONE finish entry `{ step: "implement", substep: <id>, task: <id>, kind: "complete", by, at: _now_iso() }` — no paired `start`. Make it idempotent via `_has_complete(log, "implement", <id>)` (no-op if that task already has a complete), and set `currentTask`/`status` coherently (`implementing` until all markers done).
- [x] T003 Relax the no-backward-clobber guard in `speckit-extension/scripts/write-context.py` for **same-step** implement writes: allow per-task/finish writes when `currentStep == "implement"` even if `status == "implemented"`; keep blocking genuinely cross-step terminal specs (`completed`/`archived`) via the existing `_is_more_advanced` cross-step path. (Depends on T002 — same file.)

**Checkpoint**: The writer can record a single, idempotent, same-step-safe per-task finish.

---

## Phase 3: User Story 1 - Honest per-task and per-substep timing (Priority: P1) 🎯 MVP

**Goal**: Per-task and per-substep entries become single finish events; durations derive from finish-to-finish deltas. No `0s` ticks, no inter-task gaps, no substep bursts.

**Independent Test**: Run a full pipeline (or fixture), run `check_capture.py` — one finish per task/substep, `task-cadence` source `live` with non-zero deltas, no two substeps sharing a timestamp.

- [x] T004 [US1] Rewrite the per-task + substep rules in `speckit-extension/presets/_shared/timing-partial.md` to finish-only: **implement** → after finishing each task, run `write-context.py --task <id> --kind complete` (script-stamped, live) instead of "do not journal timing"; **substeps** (plan `research`/`design`, tasks `generate`) → append a single `complete` finish each the moment it ends, never two at one timestamp; keep "do not self-close specify or implement at the step level." Document the `[P]` limitation (batch attributed to last finisher) in the partial.
- [x] T005 [US1] Mirror the identical finish-only model in the GUI preamble `src/ai-providers/promptBuilder.ts`: in `renderClosingInstruction` (implement branch, ~L168-171) replace "the hook stamps each task's start+complete / do NOT journal per-task timing" with the live `--task … --kind complete` script-call instruction; in `renderLifecycleBody` (~L219-222) change the per-task line and make substep entries single finishes. Keep the specify/implement step-level deterministic-close wording.
- [x] T006 [US1] Update duration derivation in `src/features/specs/stepHistoryDerivation.ts` (`buildSubsteps` + `deriveStepHistory`): derive each substep/task row from finish deltas — `startedAt = previous finish (or step start for the first)`, `completedAt = this finish` — for single `complete` (finish-only) entries; stay tolerant of legacy `start`+`complete` pairs on migrated specs.
- [x] T007 [P] [US1] Re-embed the updated timing partial **verbatim** into the standard preset command bodies that carry the marker: `speckit-extension/presets/companion-standard/commands/*.md`. (Depends on T004.)
- [x] T008 [P] [US1] Re-embed the updated timing partial **verbatim** into the lean preset command bodies: `speckit-extension/presets/companion-lean/commands/*.md`. (Depends on T004.)
- [x] T009 [P] [US1] Re-embed the updated timing partial **verbatim** into the namespaced `/speckit.companion.{specify,plan,tasks,implement}` command bodies that `check-shape-parity.py` guards. (Depends on T004.)
- [x] T010 [US1] Run `python3 speckit-extension/scripts/check-shape-parity.py` and confirm PASS — the timing partial is embedded verbatim in both presets and the namespaced bodies (no fork). (Depends on T007, T008, T009.)
- [x] T011 [US1] Update the eval `.claude/skills/eval-speckit-extension/check_capture.py` for finish-only: `per-task-substeps` / `per-task-no-duplicates` accept a single `complete` per task (no required `start`); `task-cadence` reports live non-zero deltas (script-stamped `by:extension` or `by:ai`) as the healthy signal — replace the "tight end-of-step window expected" framing. Keep `VALID_BY`/`CANONICAL_STEPS`/`CANONICAL_STATUSES` in sync with `src/core/types/spec-context.schema.json`.
- [x] T012 [P] [US1] Extend `src/features/specs/__tests__/stepHistoryDerivation.test.ts` for the finish-delta model: first finish anchored to step start, single-finish substeps yield non-zero durations, no `0s` rows; legacy pairs still derive.
- [x] T013 [P] [US1] Extend `src/ai-providers/__tests__/promptBuilder.test.ts` to assert the implement/lifecycle preamble now instructs the live `--task … --kind complete` finish and single-finish substeps (and no longer says "start+complete").
- [x] T014 [US1] Verify US1 per `quickstart.md`: run a pipeline (or apply a finish-only fixture) and `check_capture.py` → single finish per task/substep, `task-cadence` non-zero deltas, no `0s`/gaps/substep-burst.

**Checkpoint**: Timeline timing is honest end-to-end (MVP).

---

## Phase 4: User Story 2 - Template-profile setting activates the preset (Priority: P1)

**Goal**: Toggling `speckit.companion.templateProfile` activates the matching bundled preset with no manual command.

**Independent Test**: Set the setting to lean → `.specify/presets/companion-lean` exists, standard does not; next run produces the lean shape. Fully independent of US1/US3.

- [x] T015 [US2] In `src/features/settings/companionPresetReconciler.ts`, make the `add` op install from the bundled path — emit `specify preset add --dev .specify/extensions/companion/presets/<id>` (branch `presetCommandFor`, or compute the dev path for `action === 'add'`); leave `enable` and `remove` id-form. Removes-before-add ordering and mutual exclusivity unchanged.
- [x] T016 [US2] Update `src/features/settings/companionPresetReconciler.test.ts`: assert `add` → `specify preset add --dev .specify/extensions/companion/presets/<id>`; `enable`/`remove` still id-form; switching emits removes before the add; `off` removes both.
- [x] T017 [US2] Verify US2 per `quickstart.md`: toggle `templateProfile` lean → standard → off; confirm `.specify/presets/<id>` activates with mutual exclusivity, the lean run drops the standard-only artifacts, and no manual `specify preset` command was needed.

**Checkpoint**: The settings toggle is live.

---

## Phase 5: User Story 3 - Timeline stays complete regardless of AI behavior (Priority: P2)

**Goal**: The end-of-implement backstop journals every task (finish-only) even when implement was already closed; no lost or duplicated tasks.

**Independent Test**: Simulate a pre-closed implement step, run the backstop → every checked task gets one finish, totals match `tasks.md`, no duplicate `(task, kind)`.

- [x] T018 [US3] Convert `sync_tasks()` in `speckit-extension/scripts/write-context.py` to finish-only: append a single `complete` per fresh task (remove the `start`+`complete` pair at the current per-task loop) and rely on the relaxed same-step guard from T003 so it journals even after a self-closed implement; keep `_journaled_tasks` idempotency (no duplicates) and the step-level implement close once all markers are checked.
- [x] T019 [US3] Verify US3: with `status: "implemented"` already set and `tasks.md` markers checked, run the backstop (`write-context.py --tasks-file …`) → `check_capture.py` shows `per-task-matches-tasksmd` MISSING [], `per-task-no-duplicates` clean, and one finish per task.

**Checkpoint**: Journal is resilient to AI self-close.

---

## Phase 5b: Marker-format detection (FR-015, folded in)

**Goal**: Per-task capture reads both the bold (`**T001**`) and plain (`T001`) `tasks.md` formats, so standard-profile specs journal per-task and auto-close implement. Surfaced while dogfooding #215 — the standard tasks-template produces plain markers the bold-only regex missed.

- [x] T025 Make the `**` wrapper optional in the marker regexes: `COMPLETED_TASK_RE` + `PENDING_TASK_RE` in `speckit-extension/scripts/write-context.py` (propagates to `derive-from-files.py` / `status-context.py` via `parse_task_markers`), and `COMPLETED_TASK_RE` + `ALL_TASK_RE` in `.claude/skills/eval-speckit-extension/check_capture.py`. Keep the `T\d+` capture so non-task checkboxes don't false-match. (TS side already counts plain checkboxes — no change.)
- [x] T026 Add `speckit-extension/tests/test_context.py` cases: `parse_task_markers` detects plain + bold + ignores idless checkboxes; `sync_tasks` journals a plain-format `tasks.md` finish-only and closes the step.
- [x] T027 Re-journal spec 133's own implement step with the fixed parser (it is itself a plain-format spec) so its record honestly shows implement + 24 per-task finishes; verify with `check_capture.py specs/133-timing-fidelity-v2/`. Docs: note both formats in `docs/capture-and-timing.md` + spec-kit `CHANGELOG.md`.

**Checkpoint**: A standard-format `tasks.md` journals per-task and closes implement.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Docs on both extensions and the acceptance gate. (Per repo rule: do NOT commit `/install-local` version bumps in the PR — version bumps land at publish.)

- [x] T020 [P] Update `docs/capture-and-timing.md`: replace the "hook writes start+complete per task" model with finish-only + the live `--task … --kind complete` path; document the same-step backstop guard; move reconciler activation out of "known bug" (now fixed via bundled `--dev` install); note the `[P]` limitation.
- [x] T021 [P] Update `docs/template-profiles.md`: the reconciler now activates the selected profile from the bundled `--dev` path, so the `templateProfile` setting switch works without a manual command.
- [x] T022 [P] Update `speckit-extension/CHANGELOG.md` and `speckit-extension/README.md` for the spec-kit-side changes (timing partial finish-only, `write-context.py` per-task finish + same-step backstop). Leave `extension.yml` version to the `/publish-speckit-ext` flow — do not commit an `/install-local` bump.
- [x] T023 [P] Update root `CHANGELOG.md` for the VS Code-side changes (GUI preamble finish-only, reconciler bundled-path activation, finish-delta duration derivation). Leave `package.json` version to the `/publish` flow — do not commit an `/install-local` bump.
- [x] T024 Acceptance gate: run `python3 .claude/skills/eval-speckit-extension/check_capture.py --strict` on a fresh **standard** run AND a fresh **lean** run (both exit 0); run `/eval-speckit-extension` for the umbrella report; then restore fixtures with `git restore specs/_00_demo-specified specs/_01_demo-planned specs/_02_demo-tasked`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately.
- **Foundational (Phase 2)**: after Setup — BLOCKS US1 and US3 (both use the finish primitive + guard). US2 does NOT depend on it.
- **US1 (Phase 3)**: after Foundational.
- **US2 (Phase 4)**: after Setup only — fully independent (can run in parallel with everything).
- **US3 (Phase 5)**: after Foundational (needs T003 guard + the finish primitive).
- **Polish (Phase 6)**: after the stories whose behavior the docs/changelogs describe; T024 gate runs last.

### Story independence

- **US1** and **US2** are independent. **US3** shares `write-context.py` with Foundational (sequential on that file) but is otherwise independent of US1/US2.

### Within-file sequencing (no [P] across these)

- `write-context.py`: T002 → T003 → T018 (same file).
- `promptBuilder.ts`: T005 then its test T013.
- `stepHistoryDerivation.ts`: T006 then its test T012.

### Parallel Opportunities

- T007 / T008 / T009 (re-embed into three different body sets) run in parallel after T004.
- T012 / T013 (two different test files) run in parallel.
- T020 / T021 / T022 / T023 (four different doc/changelog files) run in parallel.
- US2 (T015–T017) can run as a whole in parallel with US1 — different files.

---

## Parallel Example: User Story 1

```bash
# After T004 (timing partial updated), re-embed into all body sets together:
Task: "Re-embed timing partial into companion-standard/commands/*.md"   # T007
Task: "Re-embed timing partial into companion-lean/commands/*.md"        # T008
Task: "Re-embed timing partial into the namespaced speckit.companion.* bodies"  # T009

# Unit tests for US1 in parallel (different files):
Task: "Extend stepHistoryDerivation.test.ts"   # T012
Task: "Extend promptBuilder.test.ts"           # T013
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational (the finish primitive).
2. Phase 3 US1 → **STOP and VALIDATE** with the eval (honest deltas, no `0s`/gaps/burst).
3. This alone delivers the headline timing fix — demoable on its own.

### Incremental Delivery

1. Foundational → US1 (honest timing) → demo.
2. US2 (settings toggle activates the preset) → demo — independent, can land before or after US1.
3. US3 (resilient backstop) → demo.
4. Polish: docs on both extensions + the standard+lean eval gate.

### Notes

- All behavior is invisible until the rebuilt extensions are installed (`/install-local`) — the deployed pre-#213 build overrides the new bodies. Verification tasks (T014/T017/T019/T024) assume the rebuild is installed.
- `check-shape-parity.py` (T010) is the gate that the timing instructions didn't fork across surfaces; `check_capture.py` (T014/T019/T024) is the gate that the capture is honest.
- Restore demo fixtures after any manual run; never commit incidental `.spec-context.json` churn from exercising the viewer.
