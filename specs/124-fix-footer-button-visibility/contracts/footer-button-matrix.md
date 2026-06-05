# Contract: Footer Button Matrix (validation oracle)

The authoritative true-state → button-set mapping. Derived from `src/features/spec-viewer/footerActions.ts` (`FOOTER_ACTIONS.visibleWhen`) and `docs/viewer-states.md`. Tests assert the live footer equals this table for each state (SC-001, SC-003, FR-004).

Zones: **Left** = `regenerate`. **Right** = `refine`, `approve`, `reactivate`, `archive`, `complete`.

| Status | Step / condition | Left | Right | Notes |
|--------|------------------|------|-------|-------|
| `specifying` | specify in flight, artifact not ready | Mark step complete | Generating chip | overlay state |
| `specified` | specify done, plan not started | Regenerate | Approve→**Plan** | forward action present (FR-004) |
| `planning` | plan in flight, artifact not ready | Mark step complete | Generating chip | overlay state |
| `planned` | plan done, tasks not started | Regenerate | Approve→**Tasks** | |
| `tasking` | tasks in flight, artifact not ready | Mark step complete | Generating chip | overlay state |
| `ready-to-implement` | tasks created, implement not started | Regenerate | Approve→**Implement** | |
| `implementing` | implement in flight, <100% tasks | Mark step complete | Generating chip | overlay state |
| `implemented` | final approval gate (implement `completedAt`) | Regenerate | **Mark Completed**, **Archive** | Approve hidden; closure controls appear (FR-004 #3) |
| `completed` | terminal-completed | — | **Reactivate**, **Archive** | Mark Completed hidden (already complete) |
| `archived` | terminal-archived | — | **Reactivate** | Archive hidden |

## Derivation rules (must hold for every row)

- **`Approve` visible** ⇔ not terminal AND `shouldShowApprove(ctx, currentStep, stepHistory)`:
  - step is `ctx.currentStep` and has `startedAt`,
  - no later step in `STEP_NAMES` has `startedAt`,
  - step in flight (no `completedAt`) OR a later step exists,
  - never on `implement`.
  - Label = next workflow step's label (`getApproveLabel`), falls back to `Approve`/`Complete`.
- **`Regenerate` visible** ⇔ not terminal AND current step has `startedAt`.
- **`Archive` visible** ⇔ `status !== archived` AND `isSpecDone` (`status ∈ {implemented, completed}`).
- **`Mark Completed` visible** ⇔ not terminal AND `isSpecDone`.
- **`Reactivate` visible** ⇔ `status ∈ {archived, completed}`.
- **Generating overlay** replaces the normal right/left zones while the running step's artifact is not ready and the recovery window has not elapsed.
- **Enhancement buttons** (Clarify/Checklist/Analyze per tab) appear in the Left zone only while the spec is still active (not at the closure gate), gated on the footer's own closure actions.

## Invariance checks (the bug this prevents)

For every row: re-render N times from the same true state ⇒ identical Left+Right sets (SC-001). Click any control whose action does not change the state ⇒ the set is unchanged afterward (SC-002, FR-002). Switch step tabs ⇒ the footer set still matches the **true workflow status** row, not the viewed tab (US1-3, Edge: "viewing an earlier completed step").
