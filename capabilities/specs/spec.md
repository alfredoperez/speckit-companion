# Specs — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This capability is the extension's system of record for what specs exist, where each one is in its lifecycle, and how that lifecycle is recorded and displayed. Without it the sidebar has nothing to list, the viewer has no state to render, and a spec's progress through specify → plan → tasks → implement is lost the moment the AI session ends.

## Requirements

### Specs are discovered from the workspace and grouped by lifecycle status

The tree MUST enumerate specs from the workspace's configured spec directories and partition them into active, completed, and archived groups based on each spec's recorded status. Discovery MUST tolerate a spec directory that has no recorded context, treating it as active rather than omitting or failing on it.

#### Scenario: A spec directory with no recorded context
- **WHEN** a spec folder exists but carries no `.spec-context.json`
- **THEN** the spec still appears in the tree
- **AND** it is grouped as active

#### Scenario: Grouping follows recorded status
- **WHEN** a spec's recorded status is a terminal one
- **THEN** it moves out of the active group into the matching completed or archived group
- **AND** the group's rendered count reflects the move

### Spec state is read from `.spec-context.json` and legacy shapes are coerced forward

Reading a spec's context MUST return a canonical in-memory shape regardless of which version of the writer produced the file, and MUST distinguish "no file" from "could not read the file". A read failure that is not a genuine absence MUST NOT be reported as an empty context, because a downstream write would then clobber real lifecycle history.

#### Scenario: A file written by an older version
- **WHEN** the file carries an older field name for the lifecycle log or an obsolete status value
- **THEN** the reader returns it under the canonical field with a canonical status
- **AND** obsolete fields are dropped from the in-memory shape so they are not written back

#### Scenario: The file is absent versus unreadable
- **WHEN** the file does not exist
- **THEN** the reader reports absence
- **AND** **WHEN** the file exists but cannot be parsed or read, the reader raises a distinguishable failure instead of reporting absence

### The lifecycle log is append-only and is never rewritten

`.spec-context.json` carries an append-only `history[]` of lifecycle entries. A write MUST preserve every previously recorded entry byte-for-byte and MUST refuse the write outright if the log would shrink or an existing entry would change. The extension MUST NOT synthesize entries to paper over a gap it detects — a visible warning is preferred over a dishonest backfill.

#### Scenario: A caller tries to rewrite history
- **WHEN** a write would drop or alter an already-recorded entry
- **THEN** the write is rejected and the file on disk is left untouched

#### Scenario: The current step ran ahead of the log
- **WHEN** the recorded current step disagrees with the most recent log entry
- **THEN** the discrepancy is reported to the user-visible output
- **AND** no entry is invented to close the gap

### Writes to `.spec-context.json` never leave a partial or clobbered file

Every persist MUST be a read-modify-write that preserves fields the extension does not own, and MUST land atomically so a crash mid-write cannot truncate the file. If the existing file is present but unparseable, the write MUST abort rather than overwrite it.

#### Scenario: Unknown fields written by another tool
- **WHEN** the file carries top-level fields the extension does not recognize
- **THEN** those fields survive the write unchanged

#### Scenario: The existing file is corrupt
- **WHEN** the file on disk is present but not valid JSON
- **THEN** the write is refused
- **AND** recovery moves the corrupt bytes aside to a timestamped backup before a fresh skeleton is written in its place

### Per-step timing is derived from the log rather than trusted from disk

The per-step view of when each step started and finished MUST be recomputed from the append-only log on every read. A previously persisted timing structure MUST NOT be read back, because AI-authored timing values are unreliable while the log's ordering is not.

#### Scenario: A step is still running
- **WHEN** the most recently logged step matches the recorded current step and the spec is not terminal
- **THEN** that step derives as in flight with no finish time

#### Scenario: Redundant repeated entries
- **WHEN** the log contains consecutive entries describing the same boundary
- **THEN** they collapse to one derived row so durations and substep lists are not distorted

### An elapsed duration is only shown when both of its boundaries were measured

A derived span MUST be marked as trusted only when the extension's own clock stamped both its start and its end. Timestamps written by the AI or the CLI record when the write ran, not when the work happened, so consumers MUST NOT render elapsed time for an untrusted span.

#### Scenario: A span closed by an AI-written entry
- **WHEN** a step opened on an extension-stamped entry but closed on an AI-stamped one
- **THEN** the derived span is marked untrusted
- **AND** its ordering is still honored

### The extension records lifecycle boundaries without depending on AI cooperation

Step and substep starts and finishes MUST be recorded by the extension itself when it dispatches or observes work, so a spec's progress survives an assistant that never writes the file. A failure to record MUST be logged and swallowed, never allowed to block dispatch.

#### Scenario: The assistant never wrote anything
- **WHEN** a step is dispatched through a terminal and the terminal closes without the assistant recording a finish
- **THEN** the extension records the step's finish itself

#### Scenario: The user advances to the next step
- **WHEN** the user moves to a different lifecycle step while the previous one has no recorded finish
- **THEN** the previous step's finish is recorded before the new step's start

#### Scenario: The write fails
- **WHEN** recording a boundary throws
- **THEN** the error is logged and the dispatch proceeds

### Finishing implement is not the same as completing the spec

Finishing the implement step MUST leave the spec in an implemented-but-not-closed state; only an explicit user action advances it to completed. Terminal statuses MUST NOT be re-applied or regressed by automatic paths.

#### Scenario: All tasks are checked off
- **WHEN** every task in the spec's task list is complete and the implement step is genuinely underway
- **THEN** the implement step is closed once
- **AND** a repeat of the same condition adds nothing further

#### Scenario: A spec parked before implement
- **WHEN** every task is checked but the spec has never entered implement
- **THEN** nothing is closed automatically [inferred: this preserves an intentional pause point before implementation, described in the guard's own rationale rather than observable from the signature alone]

### Destructive and status-overriding actions require explicit confirmation

Deleting a spec, forcing a lifecycle status, or applying a status change across a whole group MUST prompt the user before taking effect, and a bulk action MUST skip specs already in the target state. A forced status MUST leave the current step, the status, and the log mutually coherent so the viewer recovers instead of stranding.

#### Scenario: Forcing a non-terminal status
- **WHEN** the user forces a spec to an in-progress or settled mid-pipeline status
- **THEN** the current step is realigned to the step that status belongs to
- **AND** a matching boundary is appended, attributed to the user

#### Scenario: A group-wide status change
- **WHEN** the user applies a status change to a whole group
- **THEN** they confirm the count of affected specs first
- **AND** specs already in the target status are excluded

### Companion-namespaced commands are never dispatched unresolvably

When a command belongs to the Companion namespace and the companion spec-kit extension is not installed in the workspace, the extension MUST either substitute the equivalent stock command or suppress the dispatch entirely. It MUST NOT send text the assistant cannot resolve, and it MUST tell the user why.

#### Scenario: A pipeline command with a stock equivalent
- **WHEN** the extension is missing and the command has a stock counterpart
- **THEN** the stock command is dispatched instead and the substitution is surfaced

#### Scenario: A Companion-only command
- **WHEN** the extension is missing and the command has no stock counterpart
- **THEN** nothing is dispatched
- **AND** the user is offered a way to install the missing extension

### A custom workflow progresses from its output files when it records nothing

A workflow whose steps fall outside the built-in lifecycle produces no lifecycle recording of its own, so progression MUST be reconstructed from the step outputs present on disk. This reconstruction MUST NOT apply to built-in workflows and MUST NOT move a spec backward or override genuinely recorded progress.

#### Scenario: A custom workflow left files but no record
- **WHEN** the files on disk are further along than the recorded position
- **THEN** the derived position advances to the furthest step that produced output
- **AND** the forward action targets the step after it

#### Scenario: A workflow that does record its own progress
- **WHEN** the recorded position is already at or past what the files show
- **THEN** the recorded progress is left untouched

### Living specs are listed read-only from the workspace configuration

The living-specs view MUST resolve capabilities and their companion tiers from the workspace's own configuration without invoking any workspace tooling, and MUST render a friendly empty state when the configuration is absent or disabled rather than an error. Every action it offers MUST be a one-way dispatch to the assistant; the extension MUST NOT perform the analysis itself.

#### Scenario: Living specs are not configured
- **WHEN** the workspace has no living-specs configuration
- **THEN** the view renders an empty state instead of failing

#### Scenario: The user asks for a drift or coverage check
- **WHEN** the action is invoked on a capability row
- **THEN** the corresponding slash command is dispatched to the configured AI provider, scoped to that capability

## Uncovered

_None — every file in the area was read._
