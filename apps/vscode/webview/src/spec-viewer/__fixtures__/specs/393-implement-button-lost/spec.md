# Feature Specification: Recover the Implement button after an interrupted run

**Feature Branch**: `393-implement-button-lost`
**Created**: 2026-07-10
**Status**: Draft
**Source**: [Issue #414](https://github.com/alfredoperez/speckit-companion/issues/414) — "[BUG] Implement button disappears permanently after interrupted implementation in v0.26.0"

## The bug, reproduced

When a user clicks Implement and the AI run dies partway (network drop, closed terminal), the run's "implement started" record stays in the spec's history with no matching completion. The history log is append-only, so nothing the user does afterward can remove it — and the viewer's rule for showing the forward-motion button ("hide it if any later step ever started") reads that dead record as "the workflow already moved past this point." Forcing the status back with the sidebar gear realigns the current step but cannot erase the record, so the Implement button never returns. Two side effects make it worse: the interrupted implement step falsely displays as **completed** (its end time gets back-filled from the forced-status write), and the only recovery users have found is deleting `.spec-context.json`, which destroys their whole history.

Reproduced in an automated test on current `main`: after the sequence *implement started → interrupted → status forced to ready-to-implement*, the tasks-tab footer offers only Regenerate; Approve/Implement is gone and the implement badge reads completed.

## User Scenarios & Testing

### User Story 1 - Forcing the status back actually brings the button back (Priority: P1)

A user's implementation run gets interrupted. They use the sidebar gear to force the spec's status back to "ready to implement." The Implement button reappears in the viewer footer, and clicking it starts a fresh implementation run.

**Why this priority**: This is the exact recovery path we already tell users to take (it's the first suggestion in the issue thread), and today it silently does nothing. Fixing it turns the existing escape hatch into a real one.

**Independent Test**: Interrupt an implement run on a demo spec, force the status via the gear, and confirm the Implement button is visible and dispatches.

**Acceptance Scenarios**:

1. **Given** a spec whose implement run started but never completed, **When** the user forces the status to "ready to implement", **Then** the tasks tab shows the Implement button again.
2. **Given** the same stranded spec, **When** the user forces the status to "planned", **Then** the plan tab shows the Tasks button again.
3. **Given** a recovered spec, **When** the user clicks Implement, **Then** a new implementation run starts and is recorded as a fresh attempt.

### User Story 2 - The viewer tells the truth about an interrupted step (Priority: P2)

After the rollback, the user looks at the step indicators. The implement step must not claim it finished — it should read as not done, so the user understands where the workflow actually stands.

**Why this priority**: A "completed" badge on a step that died halfway misleads the user into thinking the work is done, compounding the stuck-button confusion.

**Independent Test**: In the stranded-then-forced state, inspect the step badges: implement must not show as completed.

**Acceptance Scenarios**:

1. **Given** an implement run that started but never completed, **When** the user forces the status back to an earlier stage, **Then** the implement step is not displayed as completed.
2. **Given** the same state, **When** the viewer derives per-step timing, **Then** the interrupted attempt's end time is not invented from a later unrelated write.

### User Story 3 - Recovery never requires deleting files (Priority: P3)

A user hits the interruption but doesn't know about the gear. The state they're left in must still offer a path forward from the viewer itself, and no recovery step may require hand-deleting `.spec-context.json` or losing history.

**Why this priority**: File deletion is the community's current workaround; it loses history and telemetry identity and signals the product can't recover itself.

**Independent Test**: From the stranded state (before any forcing), confirm the viewer still offers at least one working forward action, and that the full recovery flow touches no files by hand.

**Acceptance Scenarios**:

1. **Given** a freshly interrupted implement run (no forcing yet), **When** the user opens the viewer, **Then** at least one visible action can restart or resume the run.
2. **Given** a spec recovered via the gear, **When** the user inspects the history afterward, **Then** the interrupted attempt is still recorded (nothing was erased).

## Edge Cases

- A run is interrupted, recovered, re-dispatched, and interrupted again — recovery must work repeatedly, with multiple dead start records in history.
- The user forces a status *forward* (e.g. to "implementing") instead of backward — the viewer must stay coherent, not resurrect a phantom running state.
- Legacy context files written before the current history schema (entries missing kind/task fields) must keep rendering as they do today.
- Task-level finish records were journaled during the interrupted run — they must not change the recovery behavior or double-count on the retry.
- The spec is completed or archived — forced-status recovery rules must not alter terminal-state behavior.

## Requirements

### Functional Requirements

- **FR-001**: When a user forces a spec's status back to a settled earlier stage, the viewer MUST show that stage's forward-motion button again (e.g. "ready to implement" → Implement on the tasks tab; "planned" → Tasks on the plan tab).
- **FR-002**: A step-start record left behind by an interrupted, rolled-back run MUST NOT suppress the current step's forward-motion button. The workflow's position is its most recent step-level boundary, not the furthest step ever started.
- **FR-003**: An interrupted step MUST NOT display as completed after a rollback; its badge and derived timing MUST reflect that it did not finish.
- **FR-004**: Recovery MUST work without deleting or hand-editing `.spec-context.json`; the history log remains append-only and the interrupted attempt stays visible in it.
- **FR-005**: The normal forward flow MUST be unchanged: when the workflow has genuinely advanced, past tabs still hide the forward-motion button exactly as documented today.
- **FR-006**: Re-dispatching a step after recovery MUST record a fresh attempt, distinguishable in history from the interrupted one.

## Key Entities

- **Spec context**: the per-spec record of workflow position — current step, status, and the append-only history log the viewer derives everything from.
- **History entry**: one lifecycle event (which step, start or complete, who wrote it, when). The dangling implement start with no matching complete is the artifact this feature must tolerate.
- **Footer action**: a viewer button whose visibility is derived from spec context; the Approve/Implement button is the one that gets stranded.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In the reproduced #414 sequence (implement started, no completion, status forced to "ready to implement"), the Implement button is visible — asserted by an automated regression test that fails on today's build and passes after the fix.
- **SC-002**: The interrupted implement step reports as not-completed in the same scenario — asserted by automated test.
- **SC-003**: All existing footer-matrix and state-derivation tests continue to pass (zero regressions in the documented button matrix).
- **SC-004**: A user following the documented gear recovery reaches a working Implement button in at most 2 actions, deleting zero files.

## Assumptions

- The history log stays append-only; the fix lives in how state is *derived* from history, not in rewriting or migrating stored data.
- The sidebar gear (force status) remains the sanctioned manual recovery surface; this feature makes it work rather than adding a new recovery UI.
- The forced-status write already realigns the current step correctly (verified in reproduction); only the derivation layers that ignore that realignment need to change.

## Approach

Root cause is confirmed by a failing test on `main`, in two derivation-layer spots:

- `src/features/spec-viewer/footerActions.ts` — `shouldShowApprove`'s "any later step has `startedAt` → hide" loop treats a dead, rolled-back implement start as the workflow frontier. Replace it with a rollback-aware frontier: a later step blocks Approve only if its step-level activity is *newer* than the current step's latest step-level boundary (the newest step-level entry in history — which `forceStatus` already appends — defines the position).
- `src/features/specs/stepHistoryDerivation.ts` — `deriveStepHistory` back-fills a step's `completedAt` from the *next step's first transition* even when that "next" transition is a rollback boundary belonging to an **earlier** step. Don't finalize an interrupted step from an earlier step's boundary; leave it not-completed so badges/timing tell the truth (FR-003).
- Regression tests in `src/features/spec-viewer/__tests__/` covering the full #414 sequence (button back after forcing ready-to-implement and planned; implement badge not completed; genuine forward flow unchanged; repeat-interruption).
- `docs/viewer-states.md` — document the rollback/recovery behavior in the footer matrix section.

Dependencies: none beyond existing modules; both changes are pure-derivation and test-covered. See [tasks](./tasks.md).
