# Tasks: Fold plan and tasks in one writer call

- [x] **T001** Add `--fold plan,tasks` to the writer: one read, missing boundaries only, strictly increasing stamps, forward-only status, one publish + `apps/speckit-extension/scripts/write-context.py`
- [x] **T002** Test order, stamps, idempotence, partial repair, no backward move, bad value + `apps/speckit-extension/tests/test_fold_plan_tasks.py`
- [x] **T003** Replace the four fold lines with the one fold line, rebuild the assembled command + `apps/speckit-extension/nodes/specify/finalize.md`, `apps/speckit-extension/commands/speckit.companion.specify.md`
- [x] **T004** [P] Add the `[Unreleased]` line + `apps/speckit-extension/CHANGELOG.md`
- [x] **T005** Run build check, shape parity and the speckit-extension tests + `apps/speckit-extension/`
