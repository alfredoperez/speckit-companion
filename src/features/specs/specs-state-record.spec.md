# Specs State Record — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The durable per-spec state file: how it is read, how it is written, and what a writer may never do to it. Reading is tolerant, writing is strict, append-only, atomic, serialized, and never in the user's way.

## Requirements

### A spec's lifecycle state is recorded, never inferred from files

Each spec directory SHALL carry one state record holding the workflow it runs, the step it is on, its canonical status, and an ordered log of lifecycle events. Step completion MUST NOT be inferred from the presence of a document on disk: an AI can write `plan.md` and never finish planning, and a finished step can leave no new file at all. Where a document's own content matters (a stub vs. a real document), it refines what a *document row* renders, never what the *workflow* believes.

#### Scenario: a spec has a plan document but no recorded plan step
- **WHEN** the sidebar or viewer asks whether planning is done
- **THEN** the answer comes from the recorded log, not from the file listing
- **AND** the spec continues to read as still planning

#### Scenario: a spec has no state record at all
- **WHEN** the extension first encounters it
- **THEN** it backfills only facts it can verify — the workflow, the name, the branch — and starts the spec at the beginning
- **AND** it never fabricates completed steps to make the record look further along

### The lifecycle log is append-only and every write is atomic

The event log SHALL only grow. A write that would shorten it, or that would alter any entry already in it, MUST be rejected outright rather than silently accepted. Every write MUST land whole — a reader that opens the file mid-write must see either the old record or the new one, never a partial one. This is what lets a hook, a watcher, and a user action all write to the same record without one of them destroying another's history.

#### Scenario: a caller submits a rewritten history
- **WHEN** the proposed record's log disagrees with an entry already on disk
- **THEN** the write is refused with an explicit append-only error
- **AND** the on-disk record is unchanged

#### Scenario: the file exists but cannot be read or parsed
- **WHEN** a write is attempted
- **THEN** the writer refuses rather than treating the unreadable file as absent
- **AND** the caller is told why, so a transient read failure can never be mistaken for a first write

### Reading a record is tolerant; writing one is strict

The reader SHALL accept records written by older versions, by other tools, and by an AI that got a field's shape slightly wrong — normalizing legacy field names, superseded status vocabulary, and loosely-typed values into the canonical shape in memory. Unknown top-level fields MUST survive a read/write round-trip, because another writer may own them. A genuinely absent record and a record that could not be read MUST be distinguishable to the caller, so a transient read failure is never mistaken for "no record here."

#### Scenario: a record uses a retired field name for its log
- **WHEN** it is read
- **THEN** it presents in the canonical shape
- **AND** the next write migrates it on disk without losing entries

#### Scenario: a field the extension does not know about is present
- **WHEN** the extension updates the record
- **THEN** that field is still there afterwards

### Recording state never blocks the user's work

Every lifecycle write SHALL be best-effort with respect to the user's action: a failure is logged where a maintainer can find it and then swallowed, so a dispatch, a click, or a tree refresh is never aborted because the record could not be updated. Losing one entry costs fidelity; failing the action costs the user their work.

#### Scenario: the state file is locked by another process during a dispatch
- **WHEN** the step-start write fails
- **THEN** the failure is logged
- **AND** the command still dispatches

### A corrupt state record is preserved and replaced, never overwritten

Because the writer refuses to overwrite an unparseable record, recovery MUST move the broken bytes aside to a non-colliding backup before writing a fresh minimal record in its place. The user keeps the original for manual salvage and gets a working spec back in one action.

#### Scenario: the record is truncated to invalid JSON
- **WHEN** recovery runs
- **THEN** the broken file is renamed to a timestamped backup beside it
- **AND** a fresh minimal record takes its place
- **AND** a second recovery in the same second does not clobber the first backup

### Concurrent writes to a spec's state record are serialized, never lost

Two updates to the same spec's state record that arrive at the same time both land: writes to a single spec's `.spec-context.json` run one at a time, so a concurrent read-modify-write can never overwrite another writer's entry. Writes to different specs stay independent and never wait on each other, and a failed write releases the queue for the next one instead of wedging it.

#### Scenario: two updates race on the same spec
- **WHEN** a step-progress update and another write to the same spec overlap
- **THEN** both entries land in the lifecycle log and neither writer's change is lost

#### Scenario: a queued write fails
- **WHEN** a serialized write throws
- **THEN** its error reaches its caller and the next queued write for that spec still runs

#### Scenario: a holder's process cannot be found
- **WHEN** a waiter checks whether the lock's owner is still alive
- **THEN** its answer counts only when the token says the two number processes the same way, since two containers sharing one temporary directory read every live holder as dead, and taking the lock on that basis is the lost write the lock exists to prevent

#### Scenario: the two writers were given different temporary directories
- **WHEN** each resolves where the lock lives
- **THEN** they resolve to the same place, because reading the environment means they agree only when their environments do and stop sharing a lock silently when they do not

#### Scenario: the lock's owner cannot be read
- **WHEN** a waiter would reclaim it
- **THEN** it does not, because an unreadable owner means the file was replaced or was momentarily unreadable, not that nobody holds it
