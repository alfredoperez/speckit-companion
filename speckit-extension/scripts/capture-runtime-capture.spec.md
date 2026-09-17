# Capture runtime capture — Living Spec

> [DRAFT] Re-adopted on 2026-09-07 from the single capture-runtime living spec, requirements moved verbatim, every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

A capture call has to land on the right spec, record what it was asked, and stay readable by the status resolver and the trace. These rules stop a wrong guess or a narrow reader from reporting a clean run over a record that was never written.

## Requirements

### An unresolvable pointer is named, not passed over

Resolution MUST NOT raise, but it SHALL NOT fail silently either. When the active-spec pointer exists and cannot be used, the runtime SHALL name the file and say whether it is stale or carries no recognised key, then keep trying the other ways of finding the spec.

#### Scenario: the pointer names a directory that is gone
- **WHEN** the recorded active spec no longer exists
- **THEN** the run says the pointer is stale, names the file, and still resolves by other means where it can

#### Scenario: the pointer carries an unrecognised key
- **WHEN** the pointer file parses but holds no key the resolver reads
- **THEN** the run names the file, the keys that would have worked, and what it found

### The spec a write lands on is resolved by a fixed precedence, and a conflict refuses rather than guesses

The runtime SHALL apply one documented precedence to the signals that name the active spec. A signal authoritative for the operation, such as the task list being synced, MUST override the ambient pointers. When two explicit signals conflict, the writer MUST refuse to write and name the mismatch.

#### Scenario: two explicit signals disagree
- **WHEN** an explicit spec directory and an explicit task list point at different specs
- **THEN** nothing is written and the mismatch is reported

#### Scenario: an older spec settles while a newer one is active
- **WHEN** a task list belonging to an earlier spec is synced
- **THEN** the earlier spec settles, whichever spec the ambient pointers name

### Additive capture composes; lifecycle modes are exclusive

Additive capture (decisions, verifications, concerns, expectations, requirement coverage, step summaries, size classification) SHALL all take effect when passed together, each reporting itself. Lifecycle modes MUST stay first-match-wins. When a capture flag accompanies a lifecycle flag, the lifecycle write is skipped and named on stderr. All additive capture is de-duplicated on its identity value, so re-running a command never doubles up.

#### Scenario: several capture facts arrive in one call
- **WHEN** a caller records a decision, a verification, and a summary together
- **THEN** all three are stored

#### Scenario: capture and a lifecycle transition are mixed
- **WHEN** a completion flag and a capture flag arrive in one call
- **THEN** the capture is applied and the skipped lifecycle write is reported

### Every handled call records itself, including the ones that fail

Each script SHALL append one line per handled call to a local, per-spec, size-capped trace: the operation, whether it succeeded, and on failure the reason verbatim from its stderr message. The trace MUST cost no extra call and add no instruction text to any command body, so the scripts write it themselves. A call that could not resolve a spec MUST still be recorded, in a repository-level unattributed log. Writing a trace entry MUST NEVER raise, because it runs on paths that are already failing.

#### Scenario: a capture call is declined
- **WHEN** a call is refused and its reason printed to stderr
- **THEN** a trace entry records the call as not ok, with that reason verbatim

#### Scenario: the spec cannot be resolved
- **WHEN** a call cannot determine which spec it belongs to
- **THEN** the entry lands in the repository-level unattributed log instead of being dropped

#### Scenario: the trace cannot be written
- **WHEN** the trace file's directory is unwritable
- **THEN** the observed call completes exactly as it would with no trace

### Status resolution dispatches commands from the family the spec has been running

Every next-step command that status and resume resolution emit MUST come from the spec's recorded workflow: the companion commands for `workflow: companion`, the stock commands otherwise. Resolution SHALL treat the retired marker `profile: turbo` as the companion workflow, so older specs resume on the flow they started.

A command name SHALL be held and emitted as its dotted id alone, with no leading slash. The slash is one assistant's invocation syntax, and on other assistants a slashed name such as `/speckit.companion.plan` resolves to nothing.

#### Scenario: status names the next step
- **WHEN** resolution emits the command for the next step
- **THEN** it is the dotted id with no leading slash, in both what is printed and what resume dispatches

#### Scenario: a companion spec resumes
- **WHEN** resolution computes the next command for a context recording the companion workflow
- **THEN** the command comes from the companion family

#### Scenario: an older context carries only the retired marker
- **WHEN** a context predating the workflow field records the retired companion marker
- **THEN** resolution still selects the companion family

#### Scenario: no workflow is recorded
- **WHEN** a context names neither the workflow nor the retired marker
- **THEN** resolution emits the stock command family

### A check that can be run is run, not described

A verification records what was checked and how it came out, and everything in that record was the running agent's own account — including the command, which was a string it typed rather than evidence anything ran. The viewer then drew a checkmark beside it. A check the pipeline can execute SHALL therefore be executed by the capture script, which keeps the exit code, the duration and a short tail of the output, and marks the entry as derived. A non-zero exit is recorded rather than dropped: a run that could not prove its work must say so where the reader looks, not omit the row and read as though nothing was checked.

What genuinely cannot be run — a manual pass, a judgement about a warning — stays a claim and SHALL be recorded as one. Absence of provenance MUST keep meaning claimed, because every entry written before this existed was one, and only the exact derived marker may promote an entry, since the record is a file an agent writes into.

#### Scenario: a suite is recorded
- **WHEN** implement records it
- **THEN** the command was run, and the entry carries the exit code it returned

#### Scenario: the suite fails
- **WHEN** it is recorded
- **THEN** the entry is kept, carrying the failure

#### Scenario: an entry written before provenance existed
- **WHEN** it is read back
- **THEN** it reads as a claim

### A reader of a captured list MUST accept every form its writer stores

A reader of decisions, verifications, or concerns SHALL accept both stored forms: a non-empty string reads as itself, and an entry reads through its identity value with its supporting detail still reachable. An entry with no usable identity value SHALL be skipped alone, never dropping the rest of the list. Widening a reader MUST NOT change the shape of what it emits, because other commands parse that output. Lists whose writer stores plain strings only are exempt.

#### Scenario: a real run's decisions are read back
- **WHEN** status resolves a spec whose decisions the pipeline recorded
- **THEN** every decision appears, in recorded order
- **AND** hand-authored string decisions in the same list appear unchanged alongside them

#### Scenario: one entry in the list is unusable
- **WHEN** a captured list carries an entry with no identity value among well-formed ones
- **THEN** that entry is skipped and the rest are still read
- **AND** the command still exits successfully

## Uncovered

- `status-context.py`: read its docstring and function list, not its resolution logic.
- The Python test suite under `speckit-extension/tests/` was not read.
