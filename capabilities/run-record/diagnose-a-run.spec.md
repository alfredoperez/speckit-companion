# Diagnose a Run — Living Spec

## Purpose

A run that looked fine can still have closed a step nobody finished, ticked tasks nobody journaled, or claimed a clean result nothing checked. The doctor command reads a finished or stalled run and says what actually happened, so "the pipeline will not advance" or "it never marked complete" gets an answer instead of a guess.

## Requirements

### Diagnosing a run changes nothing and never stops the person
<!-- touches: apps/speckit-extension/scripts/doctor.py, apps/speckit-extension/commands/speckit.companion.doctor.md -->

The doctor SHALL read only: it creates, changes and deletes nothing, and it always finishes successfully even when what it finds is bad. It runs on the active spec, on a named spec, or across every spec at once, and it prints for a person or for a machine. Acting on a finding is a separate decision, never part of running it.

#### Scenario: one check hits an error
- **WHEN** a check fails while examining the run
- **THEN** that check is reported as skipped with the error as its reason, the other checks still run, and the command still succeeds

#### Scenario: the spec predates the doctor
- **WHEN** the doctor runs on a spec built long before the command existed
- **THEN** it still reports, because every core check is derived from the run record and the spec's own documents

### A check that could not look never reads as clean
<!-- touches: apps/speckit-extension/scripts/doctor.py, apps/speckit-extension/scripts/run_trace.py -->

Each check SHALL report whether it ran, was skipped, or did not apply, and a skip SHALL always carry its reason, so "nothing found" is distinguishable from "nothing looked". Every recording call the run makes SHALL leave one line of evidence beside the spec: when it ran, what it was trying to do, whether it worked, the reason verbatim when it did not, which files it touched and how long it took. That evidence is capped and safe to delete, so a count taken from it SHALL be reported as a floor rather than a total, and evidence that could not be written reads as calls nobody recorded rather than as a spec with nothing to show.

#### Scenario: nothing was found
- **WHEN** a run comes back with no findings
- **THEN** the report also says which checks were skipped and why

#### Scenario: the run could not write its own evidence
- **WHEN** a run failed in a way that stopped it writing into the spec folder at all
- **THEN** the call it was watching still succeeded, and the report says the evidence is short rather than treating its absence as a clean run

### What the run claimed is recomputed, not believed
<!-- touches: apps/speckit-extension/scripts/doctor.py, apps/speckit-extension/scripts/doctor_drift.py -->

The doctor SHALL derive every verdict afresh from the record and the files, never from a result the run wrote down. Where a recomputation contradicts something the run claimed, both sides are reported with their times. A check of changed work says which capability and which files it looked at, and separates a real finding from one the run caused itself, one whose comparison point cannot be trusted, and one it could not reach at all.

#### Scenario: the run recorded that it was clean
- **WHEN** the record says a check passed and recomputing it does not
- **THEN** the report names it as a false claim and shows both sides

#### Scenario: the comparison point is unreachable
- **WHEN** the baseline for a comparison cannot be reached
- **THEN** the result is reported as unknown, never as clean

### The steps and tasks nobody closed are named
<!-- touches: apps/speckit-extension/scripts/doctor.py, apps/speckit-extension/scripts/doctor_checks.py -->

The doctor SHALL report steps that started and never finished, tasks ticked in the task list with nothing journaled against them, and steps closed by the wrong hand. Task finishes recorded all at once in one burst are reported too, because the per-task durations then mean nothing.

#### Scenario: journaling was batched at the end
- **WHEN** every task finish carries near enough the same time
- **THEN** the report says the timing is not evidence of how long the tasks took

### One verdict settles "the status and the pipeline disagree"
<!-- touches: apps/speckit-extension/scripts/doctor.py, apps/speckit-extension/scripts/doctor_checks.py -->

When a spec's status and the step it is offered next do not agree, the doctor SHALL resolve it into exactly one of two answers: the records disagree with each other, which is a recording defect, or the records agree and the display is at fault.

#### Scenario: a step finished but was never journaled as finished
- **WHEN** a step's work is done and no step-level finish was recorded
- **THEN** the report names the missing finish as why the pipeline will not advance

### Work done in the wrong step is named
<!-- touches: apps/speckit-extension/scripts/doctor.py, apps/speckit-extension/scripts/doctor_bleed.py -->

The doctor SHALL report where one step did another's work: planning inside the spec, a task list inside the plan, implementation inside the task list, the same task list in two documents, source changed before implement began, an earlier step that outlasted implement, and elapsed time belonging to no step at all. It also reports a task list whose generated shape was renamed or flattened, naming the headings at fault.

#### Scenario: code landed before implement started
- **WHEN** source files changed before the implement step began
- **THEN** the report names implement as having started earlier than the record says

### A step that closed with nothing to show for it is reported
<!-- touches: apps/speckit-extension/scripts/doctor.py, apps/speckit-extension/scripts/doctor_checks.py -->

The doctor SHALL report an implement step that closed with no check actually executed against the run, because writing code and ticking a task that names a test proves nothing on its own. It SHALL also report a step that closed without producing the document that step is meant to write. The document check is a warning and never a gate, since a spec on disk may have been produced by an earlier pipeline, and a spec that never reached the step in question is reported as having no record rather than as a problem.

#### Scenario: implement closed having run nothing
- **WHEN** implement finished and no executed verification is recorded
- **THEN** the report says the run proved nothing

#### Scenario: the spec never reached implement
- **WHEN** the run stopped before implement
- **THEN** the check reports no record instead of a finding

### Why completion did not land gets an answer
<!-- touches: apps/speckit-extension/scripts/doctor.py, apps/speckit-extension/scripts/doctor_checks.py -->

When a spec did not end up complete, the doctor SHALL say which of four things happened: the write was refused, with the refusal's own words; it reported success and never arrived; it landed and the display disagrees; or completion was never attempted.

#### Scenario: completion was refused
- **WHEN** the record shows a refused completion
- **THEN** the report quotes the reason the writer gave

## Uncovered

- The deep transcript audit is deliberately excluded. It depends on an AI session transcript whose format is not a stable contract, and on a provider that keeps one at all, so it is a builder's tool rather than a product promise.
- The debug timing switch in the project config is read only by build-time renderers that do not ship, so on an installed project it currently does nothing.
