# Feature Specification: Serialize `.spec-context.json` writes

**Feature Branch**: `527-serialize-context-writes`
**Created**: 2026-07-22
**Status**: Specified
**Source**: [#527](https://github.com/alfredoperez/speckit-companion/issues/527) (follow-up from #519)

## Overview

When a spec advances a step, the extension records the change into that spec's `.spec-context.json`. Today two of those recordings can run at the same time and each reads the file, changes its own copy, and writes it back. Whichever finishes last wins, so the other one's change is silently lost. When the loser was the step's real "start" marker, the timing for that phase becomes untrusted. The earlier fix (#519) stopped the *sequential* double-writes but left this rarer *simultaneous* one open. This feature closes it by making writes to a single spec's context file happen one at a time.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A step's timing stays trustworthy when it advances (Priority: P1)

A developer advances a spec to the next step (for example, from spec to plan). Behind the scenes the extension writes a couple of context updates for that transition. No matter how those writes are timed relative to each other, both land, and the step's start marker is never overwritten — so the viewer shows a real, trusted duration for the phase instead of an "untrusted timing" flag.

**Why this priority**: This is the whole point of the change. The observed symptom — a phase intermittently flipping to untrusted timing — comes directly from a lost start-write, and this story fixes it.

**Independent Test**: Drive two context updates for the same spec so they overlap in time, then read the resulting `.spec-context.json`. Both updates are present in `history`, and no earlier entry was dropped. This can be exercised on its own without any UI.

**Acceptance Scenarios**:

1. **Given** a spec whose step is being advanced, **When** the progress update and the step-start update are both issued for that spec at effectively the same moment, **Then** the final `.spec-context.json` contains both changes and the step-start entry survives.
2. **Given** the same overlapping writes, **When** the file is read afterward, **Then** `history` is still append-only (nothing earlier was shrunk or modified) and the phase reads as trusted timing.

### User Story 2 - Concurrent writes to different specs stay independent (Priority: P2)

A developer has more than one spec being touched around the same time. Serializing writes for one spec must not make writes for a *different* spec wait on it. Each spec's context file is guarded on its own, so unrelated specs keep updating without added delay.

**Why this priority**: Correctness for the racing case must not come at the cost of throttling everything through one global gate. It protects performance and keeps the fix scoped to the actual hazard (same-file writes).

**Independent Test**: Issue overlapping writes to two different spec directories and confirm both complete correctly and neither is blocked waiting on the other's file.

**Acceptance Scenarios**:

1. **Given** two different specs each receiving an update at the same time, **When** both writes run, **Then** each spec's `.spec-context.json` reflects its own update and neither result is lost.
2. **Given** a slow write in progress for spec A, **When** a write for spec B is issued, **Then** spec B's write proceeds without waiting for spec A to finish.

### User Story 3 - Existing failure and safety behavior is preserved (Priority: P3)

The write path already refuses to clobber a corrupt file and enforces append-only history. Serializing writes must keep those guarantees intact: a failed write still surfaces its error, still frees the lock so later writes are not stuck, and never turns a lost-update bug into a deadlock.

**Why this priority**: The fix touches a hot, shared code path. It has value only if it doesn't regress the protections already relied on.

**Independent Test**: Force one queued write to throw, then confirm a subsequent write for the same spec still runs (the queue advanced) and the error from the failed write was not swallowed.

**Acceptance Scenarios**:

1. **Given** a queued write that throws, **When** the next write for the same spec is issued, **Then** that next write still executes (the serialization released after the failure).
2. **Given** an existing on-disk file that is not valid JSON, **When** a write is attempted, **Then** it still refuses rather than overwriting, exactly as before.

## Edge Cases

- Two writes for the **same** spec issued in the same tick — both must land, in a defined order, with append-only history preserved.
- A write that **throws** while holding the per-spec turn — the turn must be released so following writes for that spec are not permanently blocked.
- Writes for **different** specs at the same time — must not serialize against each other.
- The **first-ever** write for a spec (file does not exist yet) — serialization must handle the "no prior lock for this spec" case without a race on creating the lock itself.
- A large backlog of queued writes for one spec — must drain in order without unbounded growth beyond the work actually issued.

## Requirements

### Functional Requirements

- **FR-001**: Writes to a single spec's `.spec-context.json` MUST be serialized so that at most one read-modify-write for that file is in flight at a time, and a later write reads the state left by the previous write.
- **FR-002**: Serialization MUST be scoped per spec (keyed by the spec directory / target file), so writes to different specs run concurrently and never block one another.
- **FR-003**: When two writes for the same spec are issued concurrently, both MUST be applied and the resulting `history` MUST remain append-only with no earlier entry dropped or modified.
- **FR-004**: A write that fails MUST release its place in the per-spec queue so subsequent writes for that spec still run, and MUST still propagate its error to the caller rather than swallowing it.
- **FR-005**: The change MUST preserve existing write-path guarantees: refusal to overwrite a non-JSON existing file, atomic replacement of the file, append-only enforcement, and the profile back-fill behavior.
- **FR-006**: The redundant/racing extension start-writes that motivate this fix (the fire-and-forget progress update and the awaited step-start during a step advance) MUST no longer be able to overwrite each other's result.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In a stress test issuing many overlapping writes to the same spec, 100% of issued updates are present in the final `history` and 0 earlier entries are lost or mutated.
- **SC-002**: A phase advanced under concurrent writes reports trusted timing in 100% of repeated runs (no intermittent untrusted-timing flips attributable to a lost start-write).
- **SC-003**: Overlapping writes to two different specs both complete, and the second spec's write does not wait on the first spec's write to finish.
- **SC-004**: A forced write failure never blocks the next write for the same spec (no deadlock) and the error is observable to the caller.

## Assumptions

- The race is confined to writes going through the shared context-write path; direct file edits by other tools are out of scope (and already discouraged by the "never hand-edit" rule).
- Per-spec serialization within a single extension host process is sufficient; cross-process file locking is not required, since the extension host is the single writer for its workspace.
- The two constants of the timing model (finish-only recording, append-only history) are unchanged — this feature is purely about *ordering* writes, not changing what is written.

## Approach

The fix is a per-target write queue on the shared write path, plus removing the redundant unawaited start-write that creates the race.

- Add per-spec-file serialization inside the shared write helper `updateSpecContext` in `src/features/specs/specContextWriter.ts`, keyed by the resolved target path. Chain each write onto a promise stored per key so the read-modify-write for one file runs strictly one at a time; make the chain self-clean and failure-safe so a throwing write still releases the next one. Different keys (different specs) keep independent chains and run concurrently.
- Close the specific caller-side race in `executeWorkflowStep` in `src/features/specs/specCommands.ts`: today `updateStepProgress` is fire-and-forget (~line 695) while `startStep` is awaited (~line 776), and both read `history` before either writes. Either `await updateStepProgress` before `startStep`, or drop the now-redundant `startStep` (progress-update already starts the step). Prefer the change that keeps a single start-write for the step.
- Keep `writeSpecContext`, `atomicWrite`, `assertAppendOnly`, and the profile back-fill untouched in behavior — the queue wraps them, it does not replace them.

Dependencies: none beyond the two files above; no schema change, no new setting.

## Verbatim Constraints

- Target file name: `.spec-context.json`
- Race site (caller): `executeWorkflowStep` in `src/features/specs/specCommands.ts`
- Serialization site (write path): `updateSpecContext` in `src/features/specs/specContextWriter.ts`

## ADDED Requirements
<!-- capability: specs -->

### Concurrent writes to a spec's state record are serialized, never lost

Two updates to the same spec's state record that arrive at the same time both land: writes to a single spec's `.spec-context.json` run one at a time, so a concurrent read-modify-write can never overwrite another writer's entry. Writes to different specs stay independent and never wait on each other, and a failed write releases the queue for the next one instead of wedging it.

#### Scenario: two updates race on the same spec
- **WHEN** a step-progress update and another write to the same spec overlap
- **THEN** both entries land in the lifecycle log and neither writer's change is lost

#### Scenario: a queued write fails
- **WHEN** a serialized write throws
- **THEN** its error reaches its caller and the next queued write for that spec still runs
