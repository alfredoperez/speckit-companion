# Capture runtime context — Living Spec

## Purpose

The spec context file is the extension's only record of a run it cannot watch. These rules keep writes into it from breaking the host command or losing, rewinding or hand-authoring what is already recorded.

## Requirements

### Recording state MUST NOT be able to break the run it observes

A missing interpreter, an unresolvable spec directory, a malformed config or a git repository that cannot answer is reported on stderr and the script exits successfully, so a capture defect leaves a gap in the record instead of a halted pipeline.

#### Scenario: the interpreter is absent
- **WHEN** a command reaches its capture step without `python3`
- **THEN** the command warns once, continues its real work and completes with an incomplete record

#### Scenario: the spec directory cannot be resolved
- **WHEN** the writer cannot tell which spec a lifecycle write belongs to
- **THEN** it declines to write, names the problem on stderr, and exits successfully

### The context file is append-only, crash-safe, and tolerant of fields it does not own

The runtime, the VS Code extension and future readers share the file, so a write merges into what is there: unknown keys and recorded history survive, and history is only appended to. Every write is atomic.

#### Scenario: a newer writer adds a field this runtime does not know
- **WHEN** an older script updates a context carrying an unfamiliar top-level key
- **THEN** that key is present and unchanged after the write

#### Scenario: the process dies mid-write
- **WHEN** a write is interrupted before it completes
- **THEN** the context on disk is either the previous state or the new state, never a partial one

### Overlapping captures to one spec all land

A writer holds the spec's lock across its whole read-modify-write. Readers never take it. The lock lives outside the feature directory, which is the user's.

#### Scenario: two captures are issued at the same moment
- **WHEN** several writes to one feature overlap
- **THEN** every one of them is present afterwards and the document is readable

### A write that would shorten the history keeps every recorded entry

#### Scenario: a writer publishes fewer entries than the file holds
- **WHEN** the write lands
- **THEN** the recorded entries are kept, the new ones are added, and the refusal is reported

### An unreadable history is preserved beside a fresh one

#### Scenario: the recorded history is not a list
- **WHEN** a context carries a history that cannot be read as a log
- **THEN** it is preserved under a separate key, a fresh log begins, and this is reported

### Both writers resolve the lock to one place, whatever environment they were given
<!-- touches: speckit-extension/scripts/spec_context.py -->

The lock lives under a fixed root, not the process's temporary directory, because the editor and a terminal with different environments would otherwise stop sharing a lock and lose writes silently.

#### Scenario: the editor and a terminal were given different temporary directories
- **WHEN** each resolves where the lock lives
- **THEN** they resolve to the same file

### Re-running an earlier step never moves a spec backwards

A status write checks that the spec has not already moved past the step being written, not merely that it is non-terminal.

#### Scenario: an earlier step is re-advanced
- **WHEN** an advanced spec receives a completion for a step it already passed
- **THEN** the finish is recorded in history and the status and current step stay where they were

### Only mark-complete promotes a spec to completed

#### Scenario: work is still outstanding
- **WHEN** `--mark-complete` runs on a spec with unfinished tasks
- **THEN** it refuses and the spec keeps its status

#### Scenario: the spec has already shipped
- **WHEN** `--mark-complete` runs again
- **THEN** nothing changes

### A generic field write refuses lifecycle keys

Otherwise a generic setter would bypass the forward-only and mark-complete guards.

#### Scenario: a caller sets the status through the generic setter
- **WHEN** a generic field write names a lifecycle key
- **THEN** the write is refused and the refusal is reported

### The status order is readable from outside the runtime

Callers in other languages rank statuses against the runtime's own order, with each step's in-progress form before its completed form, instead of keeping a copy that goes stale.

#### Scenario: a caller needs to rank two statuses
- **WHEN** it asks the runtime for the status order
- **THEN** it gets every status in run order

### Timing is stamped by a script, never hand-authored

Every timing entry is written by a writer script reading the real clock, because an AI does not reliably hand-author timestamped JSON and hand edits have corrupted the file in practice.

#### Scenario: a step's work finishes
- **WHEN** a step's completion must be recorded
- **THEN** the writer script runs and stamps the entry from its own clock

### A step a project declared is a real step; only a typo is refused

A step whose node directory exists in the extension or the project is accepted. The project is found even when the call has no feature directory, so a step's start is never refused while its finish is journaled.

#### Scenario: a project journals its own step
- **WHEN** the start arrives through the hook form, with no feature directory
- **THEN** the project's step directory is still found and the start is recorded

#### Scenario: a step name is misspelled
- **WHEN** the write is attempted
- **THEN** it is refused by name instead of defaulting to another step

### A step outside the canonical order is never refused for ordering

#### Scenario: a review step runs after implement
- **WHEN** its completion is written on an implemented spec
- **THEN** it is recorded
