# Tasks: Close the implement step when all tasks are checked

Dependency-ordered checklist. Traceability is to files and `FR-…` requirements.

## Foundational

- [x] **T001** Add a pure decision helper `shouldCloseImplement(ctx, progress)` to `src/features/specs/historyHelpers.ts` (or a new `src/features/specs/implementCloseGuard.ts`) that returns true only when: `progress.totalTasks > 0 && progress.completedTasks === progress.totalTasks` (all done, FR-001/FR-009), the spec is not already terminal (FR-007), the implement step is underway — `currentStep === 'implement'` OR `status === 'implementing'` OR an implement entry exists in `history[]` (FR-008), and the implement step is not already closed — no step-level implement complete in `history[]` (FR-005). + `src/features/specs/implementCloseGuard.ts`

## Core work

- [x] **T002** Wire the guard into the always-on tasks watcher in `src/core/fileWatchers.ts` `handleTasksChange`: resolve `specDir` from the `tasks.md` uri parent, read recorded context via `readSpecContextSync`, and when `shouldCloseImplement(ctx, progress)` is true, `await completeStep(specDir, 'implement', 'extension')` (FR-001/FR-002/FR-003/FR-004). Keep the existing phase-completion notification path intact. + `src/core/fileWatchers.ts`

## Integration

- [x] **T003** Ensure the close is best-effort: it runs inside the handler's existing try/catch so a write failure is logged to the output channel and never throws (FR-010). Verify no new import of `.claude/**` or `.specify/**` is introduced (isolation). + `src/core/fileWatchers.ts`

## Polish

- [x] **T004** [P] Add unit tests for `shouldCloseImplement` in `src/features/specs/__tests__/implementCloseGuard.test.ts` covering: all-done + underway → close; all-done + fast-path parked at `ready-to-implement` (no implement, no implement history) → no close (FR-008/SC-004); one task unchecked → no close (FR-006/SC-003); already-terminal (`implemented`/`completed`/`archived`) → no close (FR-007); zero markers → no close (FR-009); already-closed implement (step-level complete present) → no close, idempotent (FR-005/SC-002). + `src/features/specs/__tests__/implementCloseGuard.test.ts`
- [x] **T005** [P] Run `npm run compile`, `npm test`, the capture eval (`python3 .claude/skills/eval-speckit-extension/check_capture.py`), and `python3 speckit-extension/scripts/check-shape-parity.py`; confirm all green (SC-005). + (validation, no file)

## Dependencies

- T001 (the pure guard) blocks T002 (wiring) and T004 (tests for the guard).
- T002 blocks T003 (both edit `fileWatchers.ts`).
- T005 runs last (validates everything).

## Parallel

- T004 and T005 are `[P]`-eligible relative to each other once T001–T003 land, but T005's validation should run after T004's tests exist.
