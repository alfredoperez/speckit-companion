# Specs State Record — Living Spec

<!-- reviewed: a9c0b02b -->

## Purpose

Owns the per-spec state file, `.spec-context.json`: read it tolerantly, write it whole, and never let a write shorten its history.

## Requirements

### A spec's lifecycle state is recorded, never inferred from files
<!-- touches: apps/vscode/src/features/specs/specContextReader.ts, apps/vscode/src/features/specs/specExplorerProvider.ts -->

A step SHALL count as done only when the state record says so, never because its document exists on disk, since an AI can write `plan.md` without finishing planning. A document's content may change how its row renders, never what the workflow believes.

#### Scenario: a spec has a plan document but no recorded plan step
- **WHEN** the sidebar or viewer asks whether planning is done
- **THEN** the spec still reads as planning

### A spec without a state record starts at the beginning
<!-- touches: apps/vscode/src/features/specs/specContextBackfill.ts -->

When a spec has no state record, the extension SHALL backfill only facts it can verify (workflow, name, branch) and never record a step as completed.

#### Scenario: a spec folder with documents but no record
- **WHEN** the extension first encounters it
- **THEN** no step is recorded as completed and the spec sits at its first step

### The lifecycle log is append-only and every write is atomic
<!-- touches: apps/vscode/src/features/specs/specContextWriter.ts -->

A write that removes or alters an existing history entry SHALL be refused with an append-only error and leave the file on disk unchanged.

#### Scenario: a caller submits a rewritten history
- **WHEN** the proposed log disagrees with an entry already on disk
- **THEN** the write is refused with an append-only error and the record is unchanged

### A reader never sees a half-written record
<!-- touches: apps/vscode/src/features/specs/specContextWriter.ts -->

Every write SHALL replace the file whole, so a reader sees either the old record or the new one.

#### Scenario: the record is read while a write is in flight
- **WHEN** the reader opens the file
- **THEN** it parses as either the previous or the new record

### An unreadable record is never overwritten as if it were absent
<!-- touches: apps/vscode/src/features/specs/specContextWriter.ts -->

When the file exists but cannot be read or parsed, a write SHALL be refused with the reason, and a reader SHALL report it as unreadable rather than missing.

#### Scenario: a transient read failure during a write
- **WHEN** the writer cannot read the existing record
- **THEN** it refuses instead of writing a fresh record over the old history

### Reading a record is tolerant; writing one is strict
<!-- touches: apps/vscode/src/features/specs/specContextReader.ts, apps/vscode/src/features/specs/specContextWriter.ts -->

The reader SHALL present legacy field names, superseded status values and loosely typed values in the current shape. A write SHALL lose nothing it read: legacy entries migrate on disk, and unknown top-level fields stay because another writer may own them.

#### Scenario: a record uses a retired field name for its log
- **WHEN** it is read and then written
- **THEN** it presents in the current shape and the file keeps every entry

#### Scenario: a field the extension does not know about is present
- **WHEN** the extension updates the record
- **THEN** that field is still there afterwards

### Concurrent writes to a spec's state record are serialized, never lost
<!-- touches: apps/vscode/src/features/specs/specContextWriter.ts -->

Writes to one spec's record SHALL run one at a time, whether they come from the editor or the command line, so both land. Writes to different specs stay independent, and a failed write releases the next one.

#### Scenario: the editor and a command-line hook write the same spec at once
- **WHEN** their writes overlap
- **THEN** both entries land in the log

#### Scenario: a queued write fails
- **WHEN** a serialized write throws
- **THEN** its caller gets the error and the next queued write for that spec still runs

#### Scenario: the two writers were given different temporary directories
- **WHEN** each takes the lock
- **THEN** both use the same lock, so they never silently stop excluding each other

### A write lock is reclaimed only from a holder that is provably gone
<!-- touches: apps/vscode/src/features/specs/specContextWriter.ts -->

A waiter SHALL take over another writer's lock only when that holder is provably dead or the lock is long abandoned.

#### Scenario: the lock's owner cannot be read
- **WHEN** a waiter would reclaim it
- **THEN** it does not, because the file may have been replaced or briefly unreadable

#### Scenario: the holder runs in a container that numbers processes differently
- **WHEN** a waiter cannot find the holder's process
- **THEN** it does not treat the holder as dead

### Recording state never blocks the user's work
<!-- touches: apps/vscode/src/features/specs/stepLifecycle.ts, apps/vscode/src/features/specs/stepProgress.ts, apps/vscode/src/features/specs/specCommands.ts -->

A failed lifecycle write SHALL be logged and swallowed. A dispatch, click or tree refresh never aborts because the record could not be updated.

#### Scenario: the state file is locked by another process during a dispatch
- **WHEN** the step-start write fails
- **THEN** the failure is logged and the command still dispatches

### A corrupt state record is preserved and replaced, never overwritten
<!-- touches: apps/vscode/src/features/specs/specContextReset.ts -->

Recovery SHALL move an unparseable record aside to a backup that never collides with an earlier one, then write a fresh minimal record in its place.

#### Scenario: the record is truncated to invalid JSON
- **WHEN** recovery runs twice in the same second
- **THEN** the broken file is kept as a timestamped backup beside it, the first backup is not clobbered, and a fresh minimal record takes its place

## Uncovered

- All files under `__tests__/` were listed but not read.
