# Protect the Run Record — Living Spec

## Purpose

The run record is written by several hands at once: lifecycle hooks, the assistant mid-step, parallel task workers, and the editor. A careless write from any of them can erase a spec's history or drag a shipped spec backward, and nothing else holds a copy. These are the guarantees every writer keeps.

## Requirements

### History only grows
<!-- touches: apps/speckit-extension/scripts/spec_context.py, apps/vscode/src/features/specs/specContextWriter.ts -->

No write SHALL remove or alter an existing history entry. A command-line write that would publish a shorter history keeps every entry already on disk and adds only the new ones, with a warning. The editor refuses a write that shrinks or edits history.

#### Scenario: a writer read a torn or stale copy
- **WHEN** a write carries 1 history entry while the file on disk holds 12
- **THEN** the file ends with all 12 plus the new one

#### Scenario: the history on disk is not a list
- **WHEN** a writer finds `history` holding something other than a list
- **THEN** it starts a fresh log and keeps the old value under `historyQuarantined`

### A write merges into the record and never replaces it
<!-- touches: apps/speckit-extension/scripts/spec_context.py, apps/speckit-extension/scripts/capture.py, apps/vscode/src/features/specs/specContextWriter.ts -->

Every writer SHALL read the record, change only its own fields, and keep every other top-level key, including keys it does not know. The legacy `transitions` log is carried forward into `history`, and `transitions` and `stepHistory` are dropped on the next write.

#### Scenario: a hook fires on a spec with review comments
- **WHEN** a lifecycle capture writes to a record that holds the editor's `reviewComments`
- **THEN** the comments are still there afterwards

### A spec is never dragged backward
<!-- touches: apps/speckit-extension/scripts/spec_context.py, apps/speckit-extension/scripts/write-context.py, apps/speckit-extension/scripts/derive-from-files.py -->

A write for an earlier step SHALL leave alone a spec already at a later step or at `implemented`, `completed` or `archived`. A spec at `completed` or `archived` is closed to every lifecycle and task write. Per-task finishes are still accepted at `implemented`, and a step the project added is not ranked against the built-in order.

#### Scenario: a late hook resolves to a shipped spec
- **WHEN** an after-specify capture lands on a spec whose status is `completed`
- **THEN** the record is unchanged and the capture says it did not regress it

#### Scenario: a finish arrives for a step the spec has passed
- **WHEN** a step is advanced on a spec already beyond it
- **THEN** the finish is journaled and `status` and `currentStep` stay where they were

### Only mark-complete sets a spec to completed
<!-- touches: apps/speckit-extension/scripts/write-context.py, apps/speckit-extension/scripts/capture.py -->

`status: completed` SHALL be written only by the mark-complete operation, and only for a spec at `implemented`, or at `implementing` with every task ticked, in which case the implement step is closed in the same write. `currentStep` stays `implement`. Free-form field writes SHALL refuse `history`, `status` and `currentStep`.

#### Scenario: mark-complete runs with tasks left
- **WHEN** mark-complete is called on a spec at `implementing` with unticked tasks
- **THEN** it refuses, says why, and the record is unchanged

#### Scenario: a free-form write names a lifecycle key
- **WHEN** a field write tries to set `status`
- **THEN** that key is refused and reported

### Two writers at once both land
<!-- touches: apps/speckit-extension/scripts/spec_context.py, apps/vscode/src/features/specs/specContextWriter.ts -->

Writers from the editor and the command line SHALL take turns on a record, so simultaneous writes never drop one another's fields. Their turn SHALL be claimed in one fixed place that neither process's environment can move, and never in whatever temporary directory each process happened to be handed, so two writers that never meet still queue on the same turn. A writer that crashed or went silent does not block the rest, and a writer that waits too long records anyway with a warning, because a capture must never hang. Reading never blocks and is never blocked.

#### Scenario: twelve captures fire together
- **WHEN** twelve capture calls hit one record at the same moment
- **THEN** all twelve are in the record afterwards

#### Scenario: the terminal's environment differs from the editor's
- **WHEN** a command runs from a terminal started over SSH, from a wrapper or inside a container, whose temporary directory the editor's environment never names
- **THEN** both halves still wait on the same turn, and neither write is lost in silence

### Parallel task workers record without touching the shared record
<!-- touches: apps/speckit-extension/scripts/task_sync.py -->

A fanned-out worker SHALL record its task finish by appending one line, with its own finish time, to `.spec-context.events.jsonl` beside the record. A single writer folds those lines into the record, producing the same entries a direct write would, and folding twice changes nothing. The events file is removed when the spec is marked complete.

#### Scenario: a worker finishes long before the fold
- **WHEN** a finish is appended at 10:00 and folded at 10:20
- **THEN** the history entry carries 10:00

### A record that cannot be read is never silently overwritten
<!-- touches: apps/vscode/src/features/specs/specContextWriter.ts, apps/vscode/src/features/specs/specContextReader.ts, apps/vscode/src/features/specs/specContextReset.ts -->

The editor SHALL treat "no record" and "record present but unreadable" differently: it writes a fresh record only when the file is missing, and refuses to write over one it cannot parse. Resetting a broken record moves it to a timestamped backup beside the original before writing a minimal new one. A write is published whole or not at all, so an interrupted write leaves the previous record intact.

#### Scenario: the record holds invalid JSON
- **WHEN** the editor tries to update a record that does not parse
- **THEN** the write fails with a message naming the file, and the broken bytes stay in place

#### Scenario: the user resets a broken record
- **WHEN** reset runs on an unparseable record
- **THEN** a `.spec-context.json.bak-<timestamp>` file holds the original and a fresh record takes its place
