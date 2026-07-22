# Feature Specification: Fast-path timing stays trusted when plan/tasks get a second start

**Feature Branch**: `519-fast-path-untrust-dedup`
**Status**: Completed
**Size**: simple (fast path)

The fast-path fold stamps exactly one extension step-level `start` per folded step, which is what the timing trust rule needs. But off-happy-path a second extension `start` could land on `plan`/`tasks` and flip those phases to untrusted (the viewer stops showing real durations). This closes those paths on the TypeScript writer, which — unlike the Python writer — did not dedup redundant starts.

## User Scenarios

### A re-clicked or re-dispatched phase keeps its trusted timing (Priority: P1)

A developer runs a small change through the fast path. Later they re-click the Plan phase button, or the workflow engine re-dispatches plan/tasks. Before this change, that second start made the timing panel drop plan/tasks from the measured phases. After this change, the second start is a no-op and the timing stays trusted, exactly like the Python capture script already behaved.

## Approach

Give the TypeScript lifecycle writer the same idempotent start-dedup the Python writer has. `setStepStarted` now skips appending a step-level `start` when the log already holds a step-level start for that `(step, substep=null)`, mirroring `write-context.py`'s `_has_step_start` (including the legacy kind-less inference). The redundant append becomes a no-op while `currentStep`/`status` still realign. The manual recovery path (`forceStatus`) opts out so it can still re-stamp an honest override boundary on a stranded step (#347).

## Requirements

- **FR-001**: `setStepStarted` does not append a second step-level start when one already exists for the same step; it still realigns `currentStep`/`status`.
- **FR-002**: The dedup mirrors `write-context.py`'s `_has_step_start` semantics, including legacy kind-less (`from`-based) entries, and is pinned by parity tests.
- **FR-003**: A re-started folded step keeps `durationTrusted === true` through `deriveStepHistory`.
- **FR-004**: The `forceStatus` recovery escape hatch is unchanged (still records an honest override boundary).

## Non-goals

- No change to the fast-path fold command bodies, the workflow definition, or the Python writer's start/complete logic (both already dedup).
- No change to the timing trust rule in `deriveStepHistory` — the fix is upstream at the writer.
