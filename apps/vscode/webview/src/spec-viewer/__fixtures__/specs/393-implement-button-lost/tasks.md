# Tasks: Recover the Implement button after an interrupted run

**Input**: [spec.md](./spec.md) (Approach section) — root cause confirmed by reproduction on `main`

- [x] **T001** Add failing regression tests for the #414 sequence: implement started → no completion → status forced to `ready-to-implement` shows Approve/Implement on the tasks tab, and forced to `planned` shows Tasks on the plan tab (FR-001, FR-002, SC-001) + `src/features/spec-viewer/__tests__/footerMatrix.test.ts`
- [x] **T002** Add failing regression test: interrupted implement step derives as not-completed after a rollback — no back-filled `completedAt` from an earlier step's boundary, badge not `completed` (FR-003, SC-002) + `src/features/spec-viewer/__tests__/stateDerivation.test.ts`
- [x] **T003** Make `shouldShowApprove`'s later-step check rollback-aware: a later step blocks Approve only when its step-level activity is newer than the current step's latest step-level boundary (FR-002, FR-005) + `src/features/spec-viewer/footerActions.ts`
- [x] **T004** Stop `deriveStepHistory` finalizing a step's `completedAt` from a chronologically-later boundary that belongs to an earlier step (rollback); leave the interrupted step not-completed (FR-003) + `src/features/specs/stepHistoryDerivation.ts`
- [x] **T005** Cover the guard rails: genuine forward flow still hides Approve on past tabs, repeat interruption recovers repeatedly, terminal statuses unaffected, legacy entries render unchanged (FR-004, FR-005, FR-006, SC-003) + `src/features/spec-viewer/__tests__/footerMatrix.test.ts`
- [x] **T006** Update the viewer state machine doc with the rollback/recovery behavior (footer matrix + interrupted-run note) and run the full test suite (SC-003) + `docs/viewer-states.md`
