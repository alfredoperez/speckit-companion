# Capture runtime context — Living Spec

> [DRAFT] Re-adopted on 2026-09-07 from the single capture-runtime living spec, requirements moved verbatim, every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The spec context file is the extension's only record of a run it cannot watch, and every script here writes into it from inside the user's pipeline. These rules keep those writes from breaking the host command or losing, rewinding, or hand-authoring anything already recorded.

## Requirements

### Recording state MUST NOT be able to break the run it observes

A missing interpreter, an unresolvable spec directory, a malformed config, or a git repository that cannot answer MUST NOT fail the host command. The scripts SHALL report the problem on stderr and exit successfully, so a capture defect leaves a gap in the record instead of a halted pipeline. The read-side and report-side tools (status resolution, drift, coverage) carry the same contract: they never raise and never exit non-zero.

#### Scenario: the interpreter is absent
- **WHEN** a command reaches its capture step without `python3`
- **THEN** the command warns once and continues its real work
- **AND** the run completes normally with an incomplete record

#### Scenario: the spec directory cannot be resolved
- **WHEN** the writer cannot tell which spec a lifecycle write belongs to
- **THEN** it declines to write, names the problem on stderr, and exits successfully

### The context file is append-only, crash-safe, and tolerant of fields it does not own

Writers SHALL read-merge-write rather than rebuild, because this runtime, the VS Code extension, and future readers all share the file. Unknown top-level keys and existing history entries survive untouched, and the lifecycle log is only appended to, never rewritten or shrunk. Every write MUST be atomic (temporary file, then rename), so an interrupted run never leaves a partial context.

#### Scenario: a newer writer adds a field this runtime does not know
- **WHEN** an older script updates a context carrying an unfamiliar top-level key
- **THEN** that key is present and unchanged after the write

#### Scenario: the process dies mid-write
- **WHEN** a write is interrupted before it completes
- **THEN** the context on disk is either the previous state or the new state, never a partial one

A writer SHALL hold a lock across its whole read-modify-write, not only around the publish, so two simultaneous captures cannot start from the same copy and lose the first one's work. Readers never take the lock and are never blocked by it. The lock MUST NOT live inside the feature directory, which is the user's, and MUST NOT be the context file itself, which is replaced by rename on every publish.

Where the guarantee cannot be met, it MUST be defended. A write that would leave the lifecycle log shorter than the copy on disk SHALL keep every recorded entry and add only what is new. A log that is present but unreadable SHALL be preserved beside the fresh one rather than overwritten. Both cases SHALL be reported.

#### Scenario: two captures are issued at the same moment
- **WHEN** several writes to one feature overlap
- **THEN** every one of them is present afterwards and the document is readable

#### Scenario: a writer would shorten the history
- **WHEN** a write publishes fewer entries than the file already holds
- **THEN** the recorded entries are kept, the new ones are added, and the refusal is reported

#### Scenario: the recorded history is not a list
- **WHEN** a context carries a history that cannot be read as a log
- **THEN** it is preserved under a separate key and a fresh log begins, with nothing discarded silently

### Both writers resolve the lock to one place, whatever environment they were given
<!-- touches: speckit-extension/scripts/spec_context.py -->

A spec's write lock SHALL live under a fixed root, not the resolving process's temporary directory. Two halves with different environments (a remote terminal, a wrapper, a container) would otherwise stop sharing a lock silently and lose writes with no sign of it.

#### Scenario: the editor and a terminal were given different temporary directories
- **WHEN** each resolves where the lock lives
- **THEN** they resolve to the same file

### The write lock is released once, after the publish, on whichever path ran

A context write SHALL hold its lock until the publish has succeeded or failed, on every code path including the fallback. Releasing it after the first attempt would let the fallback publish unlocked.

#### Scenario: the preferred writer is unavailable and the fallback path runs
- **WHEN** the fallback publishes the file
- **THEN** the lock is still held, and is released once afterwards

### Lifecycle status moves forward only, and the terminal state has exactly one writer

Any path that sets a spec's status MUST check that the spec has not already moved past the step being written, not merely that it is non-terminal. Re-running an earlier step or a duplicate hook records the finish but MUST NOT move the spec backwards. Only `--mark-complete` promotes a spec to completed: it refuses a spec with work outstanding and is a no-op on one already shipped. Generic field-setting MUST refuse lifecycle keys, so nothing bypasses this guard.

#### Scenario: an earlier step is re-advanced
- **WHEN** an advanced spec receives a completion for a step it already passed
- **THEN** the finish is recorded in history
- **AND** the status and current step stay where they were

#### Scenario: a caller tries to set the terminal status through a generic setter
- **WHEN** a generic field write names a lifecycle key
- **THEN** the write is refused and the refusal is reported

### The order a spec's statuses run in is published, not copied

The runtime SHALL hold the status order once, beside the statuses, with each step's in-progress form before its completed form. It SHALL expose that order outside the module, so callers in other languages rank statuses against the same list instead of keeping a copy that goes stale.

#### Scenario: a caller needs to rank two statuses
- **WHEN** it asks the runtime for the status order
- **THEN** it gets every status in run order, with no copy of its own to maintain

### Timing is stamped by a script, never hand-authored

Every timing entry SHALL be written by a writer script that reads the real clock at write time. No caller, human or AI, writes timing by editing the file. An AI runs a command faithfully but does not reliably hand-author timestamped JSON, and hand-editing is what corrupted the file in practice. Where a check can be executed, the writer SHALL take the check and its command and run it, not a sentence describing the outcome. A pair it cannot read SHALL be named and skipped, never recorded as a check nobody ran.

#### Scenario: a step's work finishes
- **WHEN** a step's work ends and its completion must be recorded
- **THEN** the writer script runs and stamps the entry from its own clock

#### Scenario: an entry is de-duplicated
- **WHEN** the same step completion is recorded twice
- **THEN** history carries it once

#### Scenario: a check is recorded with its command
- **WHEN** the writer is given both
- **THEN** it runs the command and records what came back, not what it was told

### A step a project declared is a real step; only a typo is refused

The step-name guard SHALL refuse only a misspelled step, which would otherwise default to the first step and journal a junk completion. It SHALL NOT refuse a step whose node directory exists, checking both the extension's step directories and the project's. The project SHALL be located even when the call has no feature directory, as in the hook form of a step-start, so a project step's start is never refused while its finish is journaled.

Ordering SHALL NOT be applied to a step outside the canonical order, so a review or verification step added after the work is not refused. A spec that has shipped stays closed to everything.

#### Scenario: a project journals its own step
- **WHEN** the start arrives through the hook form, with no feature directory
- **THEN** the project's step directory is still found and the start is recorded

#### Scenario: a step name is misspelled
- **WHEN** the write is attempted
- **THEN** it is refused by name instead of defaulting to another step

## Uncovered

- `derive-from-files.py`: read its docstring only.
- The Python test suite under `speckit-extension/tests/` was not read.
