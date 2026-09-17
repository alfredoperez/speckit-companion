# Capture runtime reports — Living Spec

> [DRAFT] Re-adopted on 2026-09-07 from the single capture-runtime living spec, requirements moved verbatim, every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Drift, coverage, and the health check read the record after the fact and never gate a run by default. They must say what they could not examine and never turn a failure to look into a clean verdict.

## Requirements

### A probe that cannot determine an answer MUST report "unknown", never the negative

Boundary and capability probes (shallow clone, separate project, file exists) MUST distinguish "no" from "could not tell". Only an error that genuinely means absence may return the negative; every other failure MUST surface a third state so the caller can skip loudly. The negative branch is usually also the keep-going branch, so a swallowed error would yield a confident wrong answer.

#### Scenario: history is unreachable
- **WHEN** a shallow clone means a capability's baseline cannot be compared
- **THEN** that capability is reported as skipped with the reason, not as in sync

#### Scenario: a nested config is unreadable
- **WHEN** a boundary probe cannot read a directory's config
- **THEN** the directory is still treated as a boundary and not descended into

### A report MUST NOT claim success for work it did not do

Summary output SHALL state what was examined and what was not. A run that skipped every capability reports zero checked, not a clean verdict, and a partly-skipped run states both counts. Skips carry their reason, and actionable reasons carry a hint. Reporting tools always exit successfully.

#### Scenario: some capabilities could not be checked
- **WHEN** a drift run examines part of the configured set
- **THEN** the summary names the checked and unchecked counts and the reason

A count SHALL be presented as a total only when it is one. When its evidence is known to be incomplete, such as entries rolled off a capped log or a call whose record could not be written, the report SHALL call the figure a lower bound and raise the incompleteness as a finding.

Reporting tools exit successfully by default. A caller MAY request a strict verdict that exits non-zero when a problem-severity finding is present, for use as a gate.

#### Scenario: a call did work the trace could not record
- **WHEN** a capture succeeds but its trace entry cannot be written
- **THEN** the run says so, leaves evidence beside the trace, and the report calls its counts lower bounds

#### Scenario: a caller wants a gate
- **WHEN** a strict verdict is requested and a problem-severity finding is present
- **THEN** the command exits non-zero, while the default invocation still succeeds

### The health check MUST consult the unrecorded-calls marker before concluding a spec has no trace evidence

A run that cannot write into its spec directory leaves a marker and no trace file, even though its captures completed. The check SHALL read that marker first, so this failure is reported instead of looking like a spec that has captured nothing yet.

#### Scenario: the trace file was never created
- **WHEN** the health check runs on a spec with unrecorded-call entries and no trace file
- **THEN** it reports those calls at problem severity, naming at least one reason verbatim
- **AND** it does not report the trace check as skipped

#### Scenario: neither a marker nor a trace exists
- **WHEN** the health check runs on a spec with no marker and no trace file
- **THEN** it reports the trace check as skipped with its existing wording and emits no finding

### The health check MUST report an implement step that closed having executed nothing

The check SHALL judge whether the run recorded any verification it actually executed before implement closed. An absent, empty, or malformed list counts as nothing verified.

#### Scenario: implement closed with an empty verification list
- **WHEN** the health check runs on a spec whose implement step recorded a step-level completion and no verification
- **THEN** it emits exactly one problem finding saying the step closed with nothing verified

#### Scenario: the spec never reached implement
- **WHEN** the health check runs on a spec with no implement completion recorded
- **THEN** the check reports itself as having no record, never as a problem

### The health check MUST report a step that closed without the document it declared it writes
<!-- touches: speckit-extension/scripts/doctor.py, speckit-extension/scripts/doctor_checks.py -->

The check SHALL read the built manifest and, for each step the run recorded as finished, report any declared document missing from disk. Only unconditional declarations are judged, and findings are warnings, never a gate, since the spec may come from an earlier pipeline. A step that produced none of the declared documents SHALL be reported as no record, and an absent, unreadable, or misshapen manifest SHALL be reported as a skip with its reason.

#### Scenario: a closed step is missing one of the documents it declares
- **WHEN** the health check runs on a spec whose finished step wrote some but not all of its declared documents
- **THEN** it emits a warning naming the step, the missing document, and the node that declares it

#### Scenario: the spec was produced by a different pipeline
- **WHEN** no closed step produced any of the documents this pipeline declares
- **THEN** the check reports itself as skipped instead of flagging every declaration as missing

#### Scenario: this install's build declared nothing
- **WHEN** the manifest is absent or cannot be read
- **THEN** the check is reported as skipped with that reason, and no finding is emitted

## Uncovered

- `check-coverage.py`: read only its contract docstring, not its matching logic.
- The Python test suite under `speckit-extension/tests/` was not read.
