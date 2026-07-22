# Tasks: Fast-path timing stays trusted when plan/tasks get a second start

- [x] **T001** Add a `hasStepStart` helper (TS twin of `_has_step_start`, legacy kind-less aware) in `historyHelpers.ts`
- [x] **T002** Dedup step-level starts in `setStepStarted`; keep `forceStatus` opted out (#347)
- [x] **T003** Cover the writer dedup + the derivation-stays-trusted end-to-end, plus a Python fold-then-re-dispatch parity test
