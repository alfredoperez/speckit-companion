# Tasks: Serialize `.spec-context.json` writes

Dependency-ordered. `[P]` marks tasks that can run in parallel.

- [x] **T001** Add a per-target write queue (mutex keyed by resolved target path) inside `updateSpecContext` so each spec's read-modify-write runs one at a time; the chain must be self-cleaning and release on failure + `src/features/specs/specContextWriter.ts`
- [x] **T002** Verify different spec keys keep independent chains (writes to different specs run concurrently, never block each other) + `src/features/specs/specContextWriter.ts`
- [x] **T003** Close the caller-side race in `executeWorkflowStep`: await `updateStepProgress` before `startStep`, or drop the redundant `startStep` so only one start-write occurs + `src/features/specs/specCommands.ts`
- [x] **T004** [P] Test: overlapping same-spec writes both land, history stays append-only, start entry survives (FR-001, FR-003, FR-006) + `tests/features/specs/specContextWriter.test.ts`
- [x] **T005** [P] Test: overlapping writes to two different specs both complete and do not serialize against each other (FR-002) + `tests/features/specs/specContextWriter.test.ts`
- [x] **T006** [P] Test: a throwing queued write releases the lock (next same-spec write still runs) and its error still propagates; non-JSON existing file still refused (FR-004, FR-005) + `tests/features/specs/specContextWriter.test.ts`
- [x] **T007** Run `npm test` and `npm run compile`; confirm no regressions in the context-write path
