# Tasks: Green-Baseline Stale Capture Tests + CI Gate

**Feature**: `154-stale-capture-tests` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

All file paths are relative to the repo root.

## Phase 1: Verify baseline

- [x] T001 Reproduce the 6 failures on the branch: run `python3 -m unittest discover -s speckit-extension/tests -p "test_*.py"` and confirm 4 failures + 2 errors with the exact 6 test names.

## Phase 2: User Story 1 — Green capture suite (P1)

Re-derive each stale assertion from the current contract in `speckit-extension/scripts/write-context.py` / `derive-from-files.py`. Keep each assertion's intent strong.

- [x] T002 [US1] Update `test_history_is_append_only` in `speckit-extension/tests/test_context.py` — drop the removed `from` assertion; verify append-only via the preserved+appended `step` sequence (`["specify","plan"]`) and the tail entry being `plan`/`start`.
- [x] T003 [US1] Update `test_next_step_start_still_appends_after_a_deduped_start` in `speckit-extension/tests/test_context.py` — drop the `from` assertion; verify exactly one deduped specify start plus the appended `plan`/`start` tail.
- [x] T004 [US1] Update `test_per_task_entries_are_substeps_not_step_completions` in `speckit-extension/tests/test_context.py` — per-task entries carry `task` with `substep` None; assert `task` is set, `substep` is None, and `wc._is_step_level(entry)` is False (not the old `substep == task`).
- [x] T005 [US1] Update `test_step_complete_only_when_all_tasks_done` in `speckit-extension/tests/test_context.py` — exclude per-task completes (`task is None`) from the step-level-complete filter so a per-task finish isn't miscounted; assert no step-level complete while a task remains.
- [x] T006 [US1] Update `test_per_task_completes_when_all_checked` in `speckit-extension/tests/test_context.py` — same filter fix (`task is None`); assert exactly one step-level complete once all tasks are checked.
- [x] T007 [US1] Update `test_derive_all_tasks_done` in `speckit-extension/tests/test_context.py` — derive is finish-only; assert each task has `["complete"]` (not the paired `["complete","start"]`).
- [x] T008 [US1] Run the full suite: `python3 -m unittest discover -s speckit-extension/tests -p "test_*.py"` → 0 failures, 0 errors. Run `python3 speckit-extension/scripts/check-shape-parity.py` → green.

## Phase 3: User Story 2 — CI gate (P1)

- [x] T009 [US2] Add a Python capture step/job to `.github/workflows/ci.yml`: set up Python 3, run `python3 -m unittest discover -s speckit-extension/tests -p "test_*.py"` and `python3 speckit-extension/scripts/check-shape-parity.py`, on the existing push + PR-to-main triggers, matching the workflow's style. Stdlib only (no pip install).
- [x] T010 [US2] Validate the workflow YAML is well-formed (parses cleanly).

## Phase 4: Polish / no-regression

- [x] T011 Confirm no TS regression: `npm run compile && npm test` stay green.

## Dependencies

- T001 → T002–T007 (parallel-ish, same file so serialize) → T008 → T009 → T010 → T011.

## MVP

User Story 1 (green suite) is the MVP; User Story 2 (CI gate) makes it durable.
