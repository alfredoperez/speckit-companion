# Capture runtime reports — Living Spec

## Purpose

Drift, coverage and the health check read the record after the fact and never gate a run by default. They say what they could not examine and never turn a failure to look into a clean verdict.

## Requirements

### A probe that cannot determine an answer MUST report "unknown", never the negative

The negative is usually also the keep-going branch, so a swallowed error would give a confident wrong answer. Only an error that genuinely means absence may return the negative.

#### Scenario: history is unreachable
- **WHEN** a shallow clone means a capability's baseline cannot be compared
- **THEN** that capability is reported as skipped with the reason, not as in sync

#### Scenario: a nested config is unreadable
- **WHEN** a boundary probe cannot read a directory's config
- **THEN** the directory is still treated as a boundary and not descended into

### A report MUST NOT claim success for work it did not do

The summary states what was examined and what was not, and each skip carries its reason. A run that skipped everything reports zero checked, not a clean verdict.

#### Scenario: some capabilities could not be checked
- **WHEN** a drift run examines part of the configured set
- **THEN** the summary names the checked and unchecked counts and the reason

### A count built from incomplete evidence is called a lower bound

Entries rolled off a capped log, or a call whose record could not be written, make a count incomplete. The report says so and raises the incompleteness as a finding.

#### Scenario: a call did work the trace could not record
- **WHEN** a capture succeeds but its trace entry cannot be written
- **THEN** the report calls its counts lower bounds and names the gap as a finding

### A strict verdict exits non-zero on a problem finding, and the default always succeeds

#### Scenario: a caller wants a gate
- **WHEN** a strict verdict is requested and a problem-severity finding is present
- **THEN** the command exits non-zero

#### Scenario: the same spec is checked without the strict flag
- **WHEN** the report runs
- **THEN** it exits successfully

### An unwritable trace is reported as unrecorded calls, not as a spec with no evidence

A run that cannot write into its spec directory leaves an unrecorded-calls marker and no trace file, even though its captures completed.

#### Scenario: the trace file was never created
- **WHEN** the health check runs on a spec with unrecorded-call entries and no trace file
- **THEN** it reports those calls at problem severity, naming at least one reason verbatim, and does not report the trace check as skipped

#### Scenario: neither a marker nor a trace exists
- **WHEN** the health check runs on a spec with no marker and no trace file
- **THEN** it reports the trace check as skipped and emits no finding

### The health check reports an implement step that closed having verified nothing

An absent, empty or malformed verification list counts as nothing verified.

#### Scenario: implement closed with an empty verification list
- **WHEN** the health check runs on a spec whose implement step completed with no verification
- **THEN** it emits exactly one problem finding saying the step closed with nothing verified

#### Scenario: the spec never reached implement
- **WHEN** the health check runs on a spec with no implement completion
- **THEN** the check reports no record, never a problem

### The health check reports a step that closed without a document it declared
<!-- touches: speckit-extension/scripts/doctor.py, speckit-extension/scripts/doctor_checks.py -->

The declarations come from the built manifest, and only unconditional ones are judged. Findings are warnings, never a gate, since the spec may come from an earlier pipeline.

#### Scenario: a closed step is missing one of the documents it declares
- **WHEN** the health check runs on a spec whose finished step wrote some but not all of its declared documents
- **THEN** it emits a warning naming the step, the missing document, and the node that declares it

#### Scenario: the spec was produced by a different pipeline
- **WHEN** no closed step produced any of the documents this pipeline declares
- **THEN** the check reports itself as skipped instead of flagging every declaration as missing

#### Scenario: this install's build declared nothing
- **WHEN** the manifest is absent or cannot be read
- **THEN** the check is reported as skipped with that reason, and no finding is emitted
