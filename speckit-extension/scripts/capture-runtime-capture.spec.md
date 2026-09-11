# Capture runtime capture — Living Spec

> [DRAFT] Re-adopted on 2026-09-07 from the single capture-runtime living spec, requirements moved verbatim, every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

A capture call has to land on the right spec, record what it was asked, and be readable afterwards by the status resolver and the trace. Without these rules a call that guessed wrong, or a reader that recognised only one storage form, would report a clean run over a record that was never written.

## Requirements

### An unresolvable pointer is named, not passed over

Resolution is best-effort and MUST NOT raise, but failing in silence is how a stale or misspelled pointer becomes an audit of the wrong spec — or of nothing at all — that still reports clean. Where the active-spec pointer exists and cannot be used, the runtime SHALL say which file, and whether it is stale or carries no key it recognises, then continue trying the remaining ways of finding the spec rather than stopping.

#### Scenario: the pointer names a directory that is gone
- **WHEN** the recorded active spec no longer exists
- **THEN** the run says the pointer is stale, names the file, and still resolves by other means where it can

#### Scenario: the pointer carries an unrecognised key
- **WHEN** the pointer file parses but holds no key the resolver reads
- **THEN** the run names the file, the keys that would have worked, and what it actually found

### The spec a write lands on is resolved by a fixed precedence, and a conflict refuses rather than guesses

Several signals can name the active spec, and they can disagree — especially when a later spec is "active" while an earlier one is being settled. The runtime SHALL apply one documented precedence, and where a caller supplies a signal that is authoritative for the operation (the task list being synced names its own spec), that signal MUST override the ambient pointers. When two explicit signals conflict, the writer MUST refuse to write and name the mismatch, rather than silently picking one and settling the wrong spec.

#### Scenario: two explicit signals disagree
- **WHEN** an explicit spec directory and an explicit task list point at different specs
- **THEN** nothing is written and the mismatch is reported

#### Scenario: an older spec settles while a newer one is active
- **WHEN** a task list belonging to an earlier spec is synced
- **THEN** the earlier spec settles, regardless of which spec the ambient pointers name

### Additive capture composes; lifecycle modes are exclusive

The runtime distinguishes two kinds of write. Additive capture — decisions, verifications, concerns, expectations, requirement coverage, step summaries, size classification — SHALL all take effect when passed together, each reporting itself, because they are independent facts about the same run. Lifecycle modes are alternative readings of one invocation and MUST stay first-match-wins. When a capture flag accompanies a lifecycle flag, the lifecycle write is skipped and named on stderr rather than half-performed. All additive capture is de-duplicated on its identity value, so re-running a command never doubles up.

#### Scenario: several capture facts arrive in one call
- **WHEN** a caller records a decision, a verification, and a summary together
- **THEN** all three are stored

#### Scenario: capture and a lifecycle transition are mixed
- **WHEN** a completion flag and a capture flag arrive in one call
- **THEN** the capture is applied and the skipped lifecycle write is reported

### Every handled call records itself, including the ones that fail

Every script in this runtime returns success on failure by design, printing its reason to stderr and discarding it — the contract that keeps a capture defect from halting a user's pipeline, and the reason capture failures are invisible. Each script SHALL therefore append one line per handled call to a local, per-spec, size-capped trace: which operation, whether it did what it was asked, and — when it did not — the reason verbatim from the message it already printed. The record MUST cost no additional call and add no instruction text to any command body, so it is written from inside the scripts the pipeline already runs. A call that could not resolve a spec at all MUST still be recorded, in a repository-level unattributed log, because that failure is the most common one there is and dropping it would hide exactly what the trace exists to catch. Writing a trace entry MUST NEVER raise: it runs on paths that are already failing, so a tracer that could raise would turn a recorded problem into a crash.

#### Scenario: a capture call is declined
- **WHEN** a call is refused and its reason printed to stderr
- **THEN** a trace entry records the call as not ok, carrying that reason verbatim

#### Scenario: the spec cannot be resolved
- **WHEN** a call cannot determine which spec it belongs to
- **THEN** the entry lands in the repository-level unattributed log rather than being dropped

#### Scenario: the trace cannot be written
- **WHEN** the trace file's directory is unwritable
- **THEN** the observed call completes exactly as it would have with no trace

### Status resolution dispatches commands from the family the spec has been running

A spec's context records which workflow drives it, and every next-step command that status and resume resolution emit MUST come from that workflow's command family: the companion commands when the context records `workflow: companion`, the stock commands otherwise. Handing a run a command from the other family mid-pipeline would silently switch its capture and completion behavior, so the recorded workflow is the single signal for the choice. Contexts written before the workflow field existed carried a retired marker instead (`profile: turbo`); resolution SHALL keep honoring that marker as meaning the companion workflow, so older specs resume on the flow they started rather than being demoted to the stock family.

A command name is held and emitted as its dotted id alone, with no leading slash. The slash is one assistant's way of invoking a command and not part of the name: on an assistant that registered another spelling it resolves to nothing, so a user told the next step was `/speckit.companion.plan` typed it and got nothing, and resume dispatched the same dead name on their behalf. These are the two commands whose whole job is naming what runs next, so the name they hand out has to be the one the install actually carries.

#### Scenario: status names the next step
- **WHEN** resolution emits the command for the next step
- **THEN** it is the dotted id with no leading slash, in both what is printed and what resume dispatches

#### Scenario: a companion spec resumes
- **WHEN** resolution computes the next command for a context recording the companion workflow
- **THEN** the command is drawn from the companion family

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

Capture writes decisions, verifications, and concerns as entries carrying an identity value plus supporting detail, while hand-authored and pre-coercion contexts carry bare strings for the same fields. Any reader of one of these lists SHALL accept both forms — a non-empty string reads as itself, an entry reads through its identity value, and its supporting detail stays reachable rather than being discarded at the boundary. A reader that recognizes only one form silently drops everything real runs record while continuing to pass on hand-authored fixtures, so its emptiness reads as a fact about the run rather than a defect in the reader. An entry with no usable identity value SHALL be skipped on its own, never taking the rest of the list with it. Widening such a reader MUST NOT change the shape of what it emits — only which entries reach it — because the machine-readable resolution other commands parse is part of that shape. Lists whose writer stores plain strings only are exempt: their readers are correct by construction, and a widened branch there would be unreachable.

#### Scenario: a real run's decisions are read back
- **WHEN** status resolves a spec whose decisions were recorded by the pipeline
- **THEN** every decision appears, in the order it was recorded
- **AND** hand-authored string decisions in the same list appear unchanged alongside them

#### Scenario: one entry in the list is unusable
- **WHEN** a captured list carries an entry with no identity value among well-formed ones
- **THEN** that entry is skipped and the remaining entries are still read
- **AND** the command still exits successfully

## Uncovered

- `status-context.py` — read its docstring and function list, not its resolution logic.
- The Python test suite under `speckit-extension/tests/` was not read.
