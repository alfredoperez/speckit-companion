# Capture runtime capture — Living Spec

## Purpose

A capture call has to land on the right spec, record what it was asked, and stay readable by status and the trace, so a wrong guess never reports a clean run over a record that was never written.

## Requirements

### An unresolvable pointer is named, not passed over

When the active-spec pointer exists but cannot be used, the run names the file, says whether it is stale or has no recognised key, and keeps trying the other ways of finding the spec. Resolution never raises.

#### Scenario: the pointer names a directory that is gone
- **WHEN** the recorded active spec no longer exists
- **THEN** the run says the pointer is stale, names the file, and still resolves by other means where it can

#### Scenario: the pointer carries an unrecognised key
- **WHEN** the pointer file parses but holds no key the resolver reads
- **THEN** the run names the file, the keys that would have worked, and what it found

### A signal the operation owns outranks the ambient pointers

A signal authoritative for the operation, such as the task list being synced, decides the spec whatever the active-spec pointers say.

#### Scenario: an older spec settles while a newer one is active
- **WHEN** a task list belonging to an earlier spec is synced
- **THEN** the earlier spec settles

### Two explicit spec signals that disagree refuse the write

#### Scenario: an explicit directory and task list point at different specs
- **WHEN** the writer is called with both
- **THEN** nothing is written and the mismatch is reported

### Capture facts passed together are all stored

#### Scenario: several capture facts arrive in one call
- **WHEN** a caller records a decision, a verification and a summary together
- **THEN** all three are stored and each is reported

### A lifecycle flag mixed with a capture flag is skipped and named

Lifecycle modes stay first-match-wins, so a call carrying both applies the capture and skips the lifecycle write.

#### Scenario: a completion flag arrives with a capture flag
- **WHEN** the call runs
- **THEN** the capture is applied and stderr names the skipped lifecycle write

### Re-running a capture never duplicates an entry

Captured entries are de-duplicated on their identity value.

#### Scenario: a command records the same decision twice
- **WHEN** the second call lands
- **THEN** the decision appears once

### Every handled call is traced, including the ones that fail

Each call appends one line to a per-spec, size-capped trace: the operation, whether it succeeded, and on failure the reason verbatim from its stderr message. A call that cannot resolve a spec lands in the repository-level unattributed log.

#### Scenario: a capture call is declined
- **WHEN** a call is refused and its reason printed to stderr
- **THEN** a trace entry records the call as not ok, with that reason verbatim

#### Scenario: the spec cannot be resolved
- **WHEN** a call cannot determine which spec it belongs to
- **THEN** the entry lands in the unattributed log instead of being dropped

### A trace write never breaks the call it observes

#### Scenario: the trace cannot be written
- **WHEN** the trace file's directory is unwritable
- **THEN** the call completes exactly as it would with no trace

### Status and resume dispatch commands from the spec's recorded workflow

A spec recording `workflow: companion`, or the retired `profile: turbo`, gets the companion commands. Any other spec gets the stock commands.

#### Scenario: an older context carries only the retired marker
- **WHEN** resolution computes the next command for a context with `profile: turbo` and no workflow
- **THEN** the command comes from the companion family

#### Scenario: no workflow is recorded
- **WHEN** a context names neither the workflow nor the retired marker
- **THEN** resolution emits the stock command

### Command names are emitted as dotted ids with no leading slash

A slashed name such as `/speckit.companion.plan` resolves to nothing on assistants that do not use slash syntax.

#### Scenario: status names the next step
- **WHEN** resolution emits the command for the next step
- **THEN** it is the dotted id with no leading slash, in both what is printed and what resume dispatches

### A check that can be run is run, not described

The capture script runs an executable check itself and records its exit code, duration and output tail as a derived entry. A non-zero exit is recorded, never dropped. What cannot be run, such as a manual pass, is recorded as a claim.

#### Scenario: a suite is recorded
- **WHEN** implement records it
- **THEN** the command was run, and the entry carries the exit code it returned

#### Scenario: the suite fails
- **WHEN** it is recorded
- **THEN** the entry is kept, carrying the failure

### An entry without the exact derived marker reads as a claim

The record is a file an agent writes into, so only the exact derived marker promotes an entry.

#### Scenario: an entry written before provenance existed
- **WHEN** it is read back
- **THEN** it reads as a claim

### A captured-list reader reads every usable entry, whatever form it was stored in

Decisions, verifications and concerns are read whether stored as a plain string or as an entry with an identity value. An entry with no usable identity value is skipped alone.

#### Scenario: a list mixes recorded and hand-written decisions
- **WHEN** status resolves the spec
- **THEN** every decision appears, in recorded order

#### Scenario: one entry in the list is unusable
- **WHEN** a list carries an entry with no identity value among well-formed ones
- **THEN** that entry is skipped, the rest are read, and the command still exits successfully
