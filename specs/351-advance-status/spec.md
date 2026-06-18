# Feature Specification: Single-call finish-and-advance verb for the capture script

**Branch**: `351-advance-status` | **Issue**: #351

## Problem

Advancing a spec step's lifecycle status after the step finishes is clumsy. A bare status write is rejected by the no-regress guard. The paired step+status write works but logs a stray start entry, and the model then re-reads the history to confirm nothing broke. That's several calls plus a verification round-trip per transition.

## Goal

Add one verb that, in a single atomic write, finishes the step (records its completion, never a duplicate) and advances the spec's status to the canonical completed-status for that step — with no stray start entry and no need for a follow-up read.

## User Stories

### US1 — Advance a canonical step in one call (Priority: P1)

As the model driving the pipeline, after I finish a step I want to call one verb that both records the step's finish and flips the status to that step's completed-status, so I don't issue several calls and a verification read per transition.

**Acceptance scenarios**

1. Given a spec mid-`specify`, when I advance the `specify` step, then status becomes `specified` and exactly one `specify` completion is appended, with no start entry added.
2. Same for `plan` → `planned`, `tasks` → `ready-to-implement`, `implement` → `implemented`.
3. Given I advance a step a second time, when nothing changed since, then no second completion is appended and the status stays put (idempotent).

### US2 — Steps with no status advance still record a finish (Priority: P2)

As the model, when I advance `clarify` or `analyze` (which have no canonical completed-status), I want the call to just record the finish and leave status untouched, mirroring how the plain finish verb already treats non-canonical steps.

**Acceptance scenarios**

1. Given a spec mid-`plan` with a `clarify`/`analyze` finish to record, when I advance that step, then a single completion is appended and status is unchanged.

### US3 — A shipped spec is never re-opened (Priority: P1)

As a safety guarantee, advancing a spec that's already completed or archived must be refused, so a stray or out-of-order call can never re-open finished work.

**Acceptance scenarios**

1. Given a spec at status `completed` (or `archived`), when I advance any step, then nothing is written.

## Functional Requirements

- **FR1**: The new verb finishes the named step (idempotent completion, never a duplicate) AND sets status to the canonical completed-status for that step, in one atomic write.
- **FR2**: No bare status-write path is used and no start entry is emitted by this verb.
- **FR3**: The step → canonical-completed-status map lives in exactly one place: `specify`→`specified`, `plan`→`planned`, `tasks`→`ready-to-implement`, `implement`→`implemented`.
- **FR4**: For a step with no canonical completed-status (`clarify`, `analyze`), the verb records the finish and leaves status untouched.
- **FR5**: The existing no-regress guard on direct status writes is unchanged; the new verb is the sanctioned forward flip that does not trip it.
- **FR6**: The verb refuses to act on a terminal spec (status `completed`/`archived`), matching the other journal writers.

## Success Criteria

- A single call performs what previously took several calls plus a verification read.
- Re-running the call is a no-op (no duplicate completion, status stable).
- A completed/archived spec is left byte-for-byte untouched.
