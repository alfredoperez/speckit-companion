# Context Writer — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The shared spec context on disk: the never-fail contract every runtime script carries, and the append-only, atomic, locked read-merge-write that keeps the lifecycle log trustworthy across concurrent producers.

## Requirements

### Recording state MUST NOT be able to break the run it observes

Every script in this runtime is a passenger on the user's command. A missing interpreter, an unresolvable spec directory, a malformed config, a git repository that cannot answer a question — none of these MUST fail the host command. The scripts SHALL report the problem on stderr and exit successfully, so a capture defect degrades into a gap in the record rather than a halted pipeline. The read-side and report-side tools (status resolution, drift, coverage) carry the same contract and are documented as never raising and never exiting non-zero.

#### Scenario: the interpreter is absent
- **WHEN** a command reaches its capture step in an environment without `python3`
- **THEN** the command warns once and continues its real work
- **AND** the user's run completes normally with an incomplete record

#### Scenario: the spec directory cannot be resolved
- **WHEN** the writer cannot determine which spec a lifecycle write belongs to
- **THEN** it declines to write, names the problem on stderr, and exits successfully

### The context file is append-only, crash-safe, and tolerant of fields it does not own

The spec context is a shared document written by several independent producers — this runtime, the VS Code extension, and future readers. Writers SHALL read-merge-write rather than rebuild: unknown top-level keys and previously written history entries survive untouched, and the lifecycle log is only ever appended to, never rewritten or shrunk. Every write MUST be atomic (write a temporary file, then rename) so an interrupted run can never leave a half-written or truncated context behind.

#### Scenario: a newer writer adds a field this runtime does not know
- **WHEN** an older script updates a context file carrying an unfamiliar top-level key
- **THEN** that key is present and unchanged after the write

#### Scenario: the process dies mid-write
- **WHEN** a write is interrupted before it completes
- **THEN** the on-disk context is either the previous state or the new state, never a partial one

Atomicity is not isolation, and the append-only guarantee needs both. A writer SHALL hold a lock across its whole read-modify-write, not merely around the publish, so two captures issued at the same moment cannot each start from the same copy and have the second silently discard the first one's work. Readers never take that lock and are never blocked by it. The lock MUST NOT be kept inside the feature directory, which is the user's, and MUST NOT be the context file itself, which is replaced by rename on every publish.

Where the guarantee cannot be met, it MUST be defended rather than assumed: a write that would leave the lifecycle log shorter than the copy on disk SHALL keep every recorded entry and add only what is genuinely new, and a log that is present but unreadable SHALL be preserved beside the fresh one rather than overwritten. Both SHALL say so.

#### Scenario: two captures are issued at the same moment
- **WHEN** several writes to one feature overlap
- **THEN** every one of them is present afterwards, and the document is readable

#### Scenario: a writer would shorten the history
- **WHEN** a write publishes fewer entries than the file already holds
- **THEN** the recorded entries are kept, the new ones are added, and the refusal is reported

#### Scenario: the recorded history is not a list
- **WHEN** a context carries a history that cannot be read as a log
- **THEN** it is preserved under a separate key and a fresh log begins, with nothing discarded silently

### Both writers resolve the lock to one place, whatever environment they were given
<!-- touches: speckit-extension/scripts/spec_context.py -->

Where a spec's write lock lives SHALL NOT depend on the temporary directory the resolving process happens to have. Both halves read the same environment, so deriving it that way makes them agree only when their environments do, and stop sharing a lock silently when they do not — which is the lost write the lock exists to prevent, with nothing to say it happened. A terminal reached over a connection, from a wrapper, or inside a container is exactly the case that differs. A fixed root is the only way two processes that never meet can be sure they queue on one file, and it is what makes the directory's shared-host permissions load-bearing rather than decorative.

#### Scenario: the editor and a terminal were given different temporary directories
- **WHEN** each resolves where the lock lives
- **THEN** they resolve to the same file

### The write lock is released once, after the publish, on whichever path ran

A context write SHALL hold its lock until the publish has succeeded or failed, on every code path including the fallback one. A release attached to the first attempt let the fallback path publish unlocked, which is precisely the window the lock exists to close.

#### Scenario: the preferred writer is unavailable and the fallback path runs
- **WHEN** the fallback publishes the file
- **THEN** the lock is still held, and is released once afterwards

### Lifecycle status moves forward only, and the terminal state has exactly one writer

Any path that sets a spec's status MUST check that the spec has not already moved past the step being written, not merely that it is non-terminal. Re-running an earlier step, or a hook firing twice, records the finish but MUST NOT drag the spec backwards. Promotion to the terminal completed state is reserved to a single explicit writer (`--mark-complete`), which refuses a spec with work outstanding and is a no-op on a spec already shipped. Generic field-setting MUST refuse lifecycle keys outright, so no side door exists around this guard.

#### Scenario: an earlier step is re-advanced
- **WHEN** an already-advanced spec receives a completion for a step it passed
- **THEN** the finish is recorded in history
- **AND** the status and current step are left where they were

#### Scenario: a caller tries to set the terminal status through a generic setter
- **WHEN** a generic field write names a lifecycle key
- **THEN** the write is refused and the refusal is reported

### A step a project declared is a real step; only a typo is refused

The guard on step names exists to catch a MISSPELLED step, which would otherwise default to the first step and journal a junk completion against the wrong one. It SHALL NOT refuse a step that exists: a project that has written a step's node directory has declared a real step, and refusing to journal it leaves the run with no record of a phase that genuinely happened. Both the extension's own step directories and the project's SHALL be consulted, and the project SHALL be located even when the call carries no feature directory — the hook form of a step-start carries none, and deriving the project from that argument alone journaled a project step's finish while refusing its start, producing a history that ends in a completion that never began.

Ordering SHALL NOT be applied to a step outside the canonical order: the canonical order says nothing about where it belongs, and ranking it against the last canonical step refuses exactly the case people add one for — a review or verification that runs after the work. A spec that has genuinely shipped stays closed to everything.

#### Scenario: a project journals its own step
- **WHEN** the start arrives through the hook form, with no feature directory
- **THEN** the project's step directory is still found and the start is recorded

#### Scenario: a step name is misspelled
- **WHEN** the write is attempted
- **THEN** it is refused by name rather than defaulting to another step

## Uncovered

- The Python test suite under `speckit-extension/tests/` was not read.
