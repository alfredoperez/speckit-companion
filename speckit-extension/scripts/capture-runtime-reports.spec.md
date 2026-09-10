# Capture runtime reports — Living Spec

> [DRAFT] Re-adopted on 2026-09-07 from the single capture-runtime living spec, requirements moved verbatim, every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Drift, coverage and the health check read the record after the fact and never gate a run. Their one obligation is honesty: a report must say what it could not examine, and must never turn a failure to look into a clean verdict.

## Requirements

### A probe that cannot determine an answer MUST report "unknown", never the negative

Boundary and capability probes throughout this runtime — is this a shallow clone, is this directory a separate project, does this file exist — MUST distinguish "no" from "I could not tell." Only the error that genuinely *means* absence may return the negative; every other failure MUST surface a third state so the caller can skip loudly. The failure shape this guards against is that the negative branch is usually also the keep-going branch, so a swallowed error silently produces a confident wrong answer.

#### Scenario: history is unreachable
- **WHEN** a shallow clone means a capability's baseline cannot be compared
- **THEN** that capability is reported as skipped with the reason, not as in sync

#### Scenario: a nested config is unreadable
- **WHEN** a boundary probe cannot read a directory's config
- **THEN** the directory is still treated as a boundary rather than descended into

### A report MUST NOT claim success for work it did not do

Summary output SHALL state both what was examined and what was not. A run that skipped every capability reports zero checked rather than a clean verdict, and a partly-skipped run states both counts so a success marker can never read as a verdict on the whole configuration. Skips carry their reason, and reasons that are actionable carry a hint. Reporting tools always exit successfully — a finding is a signal for a surrounding workflow to act on, not a gate these commands enforce.

#### Scenario: some capabilities could not be checked
- **WHEN** a drift run examines part of the configured set
- **THEN** the summary names both the checked and unchecked counts and the reason

A count SHALL be presented as a total only when it is one. Where the evidence a count is drawn from is known to be incomplete — entries rolled off a capped log, or a call whose record could not be written — the report SHALL say the figure is a lower bound and raise the incompleteness itself as a finding.

Reporting tools exit successfully by default, and that default does not change. But a constraint nobody can fail is a constraint nobody can demonstrate, so a caller MAY ask for a strict verdict that exits non-zero when a problem-severity finding is present, for use as a gate in a surrounding workflow.

#### Scenario: a call did work the trace could not record
- **WHEN** a capture succeeds but its trace entry cannot be written
- **THEN** the run says so, leaves evidence beside the trace, and the report calls its counts lower bounds rather than totals

#### Scenario: a caller wants a gate
- **WHEN** a strict verdict is requested and a problem-severity finding is present
- **THEN** the command exits non-zero, while the default invocation still succeeds

### The drift detector offers an opt-in working-tree mode

The drift script SHALL accept a working-tree mode that widens each capability's changed set from committed history to the baseline→worktree diff plus untracked files, de-duplicated, with the tracked-vs-unspeced scan widened the same way. The default invocation issues exactly the pre-existing git commands and renders identical human output; the machine-readable result names which mode produced it. The never-fails exit contract and the checked/skipped counts semantics hold in both modes.

#### Scenario: an uncommitted edit in a capability's area
- **WHEN** drift runs without the flag and then with it
- **THEN** the default run reads the capability as in sync and the working-tree run reports the file as drifted

### A file a run already accounted for is not drift

Drift is code that changed with nobody saying whether the spec still describes it, and a run that folded a delta into a capability, or recorded a reasoned skip for it, has said exactly that. The detector SHALL therefore drop from a capability's drifted set every file changed by such a run, read from the runs' own records rather than from anything the report keeps for itself. Reporting them anyway tells a developer to review work they finished on the run that changed the file, which is how a drift report becomes a list people scroll past. A file changed by hand, with no run behind it, is drift as before, and the accounting is per capability: a run that settled one capability vouches for nothing in another.

#### Scenario: a completed run folded into this capability
- **WHEN** drift runs afterwards
- **THEN** the files that run changed are not reported, while a hand edit since is

#### Scenario: a run recorded a reasoned skip
- **WHEN** drift runs afterwards
- **THEN** that run's files are not reported either, because a skip is the run saying the spec still holds


### A living spec is not code that drifts, whoever wrote it

A capability's own spec documents are already excluded from its drift. That is not enough where capabilities sit beside the code they describe: one capability's membership routinely claims the directory its siblings keep their specs in, so writing one spec reports every neighbour as having drifted code. Any registered capability's spec documents SHALL therefore be excluded from every capability's drift, not only from its own.

#### Scenario: two colocated capabilities share a directory
- **WHEN** one of their specs is written
- **THEN** the other reports no drift from it

### The health check MUST consult the unrecorded-calls marker before concluding a spec has no trace evidence

A run that cannot write into its spec directory can still complete captures while the trace line recording them fails to append. That run leaves a marker and no trace file. The check SHALL read the marker first, so the single failure mode that produces no trace at all is reportable rather than indistinguishable from a spec that has simply captured nothing yet.

#### Scenario: the trace file was never created
- **WHEN** the health check runs on a spec with unrecorded-call entries and no trace file
- **THEN** it reports those calls at problem severity, naming at least one reason verbatim
- **AND** it does not report the trace check as skipped

#### Scenario: neither a marker nor a trace exists
- **WHEN** the health check runs on a spec with no marker and no trace file
- **THEN** it reports the trace check as skipped with its existing wording, and emits no finding

### The health check MUST report an implement step that closed having executed nothing

Running the project's own checks is an instruction with no observer, so a run can write code, check off a task naming a test, and close having proven nothing. The check SHALL judge whether the run recorded any verification it actually executed before implement closed, treating an absent, empty, or malformed list alike as nothing verified.

#### Scenario: implement closed with an empty verification list
- **WHEN** the health check runs on a spec whose implement step recorded a step-level completion and no verification
- **THEN** it emits exactly one problem finding naming that the step closed with nothing verified

#### Scenario: the spec never reached implement
- **WHEN** the health check runs on a spec with no implement completion recorded
- **THEN** the check reports itself as having no record, never as a problem

### The health check MUST report a step that closed without the document it declared it writes
<!-- touches: speckit-extension/scripts/doctor.py, speckit-extension/scripts/doctor_checks.py -->

Every author node declares the document it writes, and a build collects those declarations into a manifest; until something compared that manifest against the disk, a step that quietly stopped writing its document closed exactly like one that wrote it. The check SHALL read the built manifest and, for each step the run recorded as finished, report a declared document that is not on disk. Only unconditional declarations are judged — an artifact the size budget is allowed to fold away is not a fault — and findings are raised at warning severity, never as a gate, because the manifest describes the pipeline as it is built today while the spec on disk may have been produced by an earlier one. A step that produced none of what this pipeline declares SHALL be read as a run of some other pipeline and reported as no record rather than as a fault, and an absent, unreadable, or misshapen manifest SHALL be reported as a skip with its reason, since there is then nothing to hold the run to.

#### Scenario: a closed step is missing one of the documents it declares
- **WHEN** the health check runs on a spec whose finished step wrote some but not all of its declared documents
- **THEN** it emits a warning naming the step, the missing document, and the node that declares it

#### Scenario: the spec was produced by a different pipeline
- **WHEN** no closed step produced any of the documents this pipeline declares
- **THEN** the check reports itself as skipped rather than flagging every declaration as missing

#### Scenario: this install's build declared nothing
- **WHEN** the manifest is absent or cannot be read
- **THEN** the check is reported as skipped with that reason, and no finding is emitted

## Uncovered

- `check-coverage.py` — read only its contract docstring, not its matching logic.
- The Python test suite under `speckit-extension/tests/` was not read.
