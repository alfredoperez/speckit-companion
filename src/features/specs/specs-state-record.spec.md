# Specs State Record — Living Spec

<!-- reviewed: a9c0b02b -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Owns the per-spec state file, `.spec-context.json`: read it tolerantly, write it atomically, and never let a write shorten its history. Every surface reads a spec's progress from this record instead of guessing from files on disk.

## Requirements

### A spec's lifecycle state is recorded, never inferred from files

Each spec directory SHALL carry one state record holding its workflow, current step, canonical status, and an ordered event log. Step completion MUST NOT be inferred from a document existing on disk, because an AI can write `plan.md` without finishing planning. A document's content (stub or real) may refine how its document row renders, never what the workflow believes.

#### Scenario: a spec has a plan document but no recorded plan step
- **WHEN** the sidebar or viewer asks whether planning is done
- **THEN** the answer comes from the recorded log, not the file listing
- **AND** the spec still reads as planning

#### Scenario: a spec has no state record at all
- **WHEN** the extension first encounters it
- **THEN** it backfills only verifiable facts (workflow, name, branch) and starts the spec at the beginning
- **AND** it never fabricates completed steps

### The lifecycle log is append-only and every write is atomic

The event log SHALL only grow: a write that shortens it or alters an existing entry MUST be rejected. Every write MUST land whole, so a reader mid-write sees either the old record or the new one, never a partial one. This lets a hook, a watcher, and a user action share one record without destroying each other's history.

#### Scenario: a caller submits a rewritten history
- **WHEN** the proposed log disagrees with an entry already on disk
- **THEN** the write is refused with an explicit append-only error
- **AND** the on-disk record is unchanged

#### Scenario: the file exists but cannot be read or parsed
- **WHEN** a write is attempted
- **THEN** the writer refuses instead of treating the file as absent
- **AND** the caller is told why, so a transient read failure is never mistaken for a first write

### Reading a record is tolerant; writing one is strict

The reader SHALL normalize legacy field names, superseded status vocabulary, and loosely typed values into the canonical shape in memory, whether written by older versions, other tools, or an AI. Unknown top-level fields MUST survive a read/write round-trip, because another writer may own them. The caller MUST be able to tell an absent record from one that could not be read.

#### Scenario: a record uses a retired field name for its log
- **WHEN** it is read
- **THEN** it presents in the canonical shape
- **AND** the next write migrates it on disk without losing entries

#### Scenario: a field the extension does not know about is present
- **WHEN** the extension updates the record
- **THEN** that field is still there afterwards

### Concurrent writes to a spec's state record are serialized, never lost

Writes to one spec's `.spec-context.json` SHALL run one at a time, so two concurrent updates both land and neither overwrites the other. Writes to different specs MUST stay independent. A failed write MUST release the queue for the next one.

#### Scenario: two updates race on the same spec
- **WHEN** a step-progress update and another write to the same spec overlap
- **THEN** both entries land in the log and neither change is lost

#### Scenario: a queued write fails
- **WHEN** a serialized write throws
- **THEN** its error reaches its caller and the next queued write for that spec still runs

#### Scenario: a holder's process cannot be found
- **WHEN** a waiter checks whether the lock's owner is still alive
- **THEN** the answer counts only when the token shows both number processes the same way, since containers sharing one temporary directory read every live holder as dead

#### Scenario: the two writers were given different temporary directories
- **WHEN** each resolves where the lock lives
- **THEN** both resolve to the same place, so they never silently stop sharing a lock because their environments differ

#### Scenario: the lock's owner cannot be read
- **WHEN** a waiter would reclaim it
- **THEN** it does not, because an unreadable owner means the file was replaced or briefly unreadable, not that nobody holds it

### Recording state never blocks the user's work

Every lifecycle write SHALL be best-effort: a failure is logged where a maintainer can find it, then swallowed. A dispatch, click, or tree refresh MUST NOT abort because the record could not be updated.

#### Scenario: the state file is locked by another process during a dispatch
- **WHEN** the step-start write fails
- **THEN** the failure is logged
- **AND** the command still dispatches

### A corrupt state record is preserved and replaced, never overwritten

Recovery MUST move an unparseable record aside to a non-colliding backup, then write a fresh minimal record in its place. The user keeps the original for salvage and gets a working spec in one action.

#### Scenario: the record is truncated to invalid JSON
- **WHEN** recovery runs
- **THEN** the broken file is renamed to a timestamped backup beside it
- **AND** a fresh minimal record takes its place
- **AND** a second recovery in the same second does not clobber the first backup

## Uncovered

- All files under `__tests__/` were listed but not read.
