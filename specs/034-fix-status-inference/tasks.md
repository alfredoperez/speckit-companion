# Tasks: Fix Status Inference Ignoring Explicit Status

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-02

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Respect explicit status field — `src/features/specs/specContextManager.ts` | R001, R002
  - **Do**: In `inferContextFromState`, after line 23, add: `if (state.status === 'completed' || state.status === 'archived' || state.status === 'active') { status = state.status as SpecStatus; }` — place this check before the heuristic block so explicit values take precedence
  - **Verify**: `npm test` passes; open a workspace with a spec that has explicit `"status": "completed"` and verify it shows under Completed group

- [x] **T002** Add test for explicit status override — `src/features/specs/__tests__/specContextManager.test.ts` | R001, R002
  - **Do**: Add test case: state with `{ step: "implement", substep: "commit-review", status: "completed" }` should return `status: 'completed'`. Add second test: state without `status` field still infers correctly via heuristics
  - **Verify**: `npm test` passes
  - **Leverage**: existing tests in `specContextManager.test.ts`

---

## Progress

- Phase 1: T001–T002 [ ]
