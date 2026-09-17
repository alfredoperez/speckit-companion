# Run Completion — Living Spec

<!-- reviewed: d589a63e -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

A run ends at one terminal step with one writer, validation is owned in exactly one place, and a diagnostic recomputes a run's health rather than trusting it. This keeps a finished-looking run from shipping broken code or claiming a state nobody checked.

## Requirements

### Completion is an explicit terminal step with exactly one writer

The Companion pipeline SHALL end at a dedicated completion command that writes the terminal status through the shared writer, refuses a spec with outstanding work, and is a no-op on a shipped spec. A second writer of that status MUST NOT be introduced anywhere. The stock pipeline has no terminal step.

#### Scenario: implementation finishes
- **WHEN** the terminal step runs
- **THEN** the spec is promoted to completed through the single writer
- **AND** the recorded current step stays at the last real step

#### Scenario: work remains
- **WHEN** the terminal step runs against an unfinished spec
- **THEN** it refuses and reports, without failing the host

"The work validates" SHALL mean the project's own checks ran and passed. A spec MUST NOT be marked complete over a failing suite the run introduced: the failure is fixed, or the spec stays at implemented with the reason stated. Checks that genuinely could not run SHALL be recorded as a concern before completing, because readers trust the completed status without opening anything.

A verification entry SHALL record the command that ran and its real outcome, never a restatement of intent. A check that could not run SHALL produce a concern and no verification entry.

#### Scenario: a test the run authored fails
- **WHEN** the implement step reaches its end
- **THEN** the failure is fixed before completion, or the spec stays at implemented with the reason stated

#### Scenario: the project has no runnable test script
- **WHEN** the run cannot execute its checks
- **THEN** it says so in the summary and records a concern
- **AND** it records no verification entry for the check it did not run

### Completion accounts for every loaded capability — a delta or an explicit skip, never silence

Both the implement-time close and `mark-complete` SHALL account for every name in `livingSpecs.loaded` before folding, with exactly one outcome each. A capability whose behavior changed gets a marked delta block in the feature spec, a capability only read for context gets a recorded skip (`write-context.py --living-spec-skip "<name>: <reason>"`), and one with neither is flagged loudly by the fold. A heading not already in that capability's living spec goes under `## ADDED Requirements`, even when it revises the same area, and `## MODIFIED Requirements` is only for editing the body of an existing matching heading.

#### Scenario: a feature changed a loaded capability

- **WHEN** the feature loaded a capability and changed its behavior
- **THEN** the completion step authors a delta block marked for that capability, and the fold writes the requirement into that capability's spec

#### Scenario: a capability was read but not changed

- **WHEN** the feature loaded a capability but did not change its behavior
- **THEN** an explicit skip is recorded for it, not silence, and its spec is left untouched

#### Scenario: a loaded capability is left unaccounted

- **WHEN** a name in `livingSpecs.loaded` gets neither a delta block nor a recorded skip
- **THEN** the fold flags it loudly as a hole


### A run that loaded nothing says so, because that is the one silence nothing else catches

On a project with living specs on, a run that loaded no capability SHALL record a concern on the run, where the doctor and panel read it, not only on the error stream. The note SHALL name both possible causes: the area belongs to no capability yet, or a capability claims it while no requirement describes it. A project not using living specs records nothing.

#### Scenario: a configured project resolves no capability for the change
- **WHEN** completion runs
- **THEN** the run carries a concern saying so, naming both causes

#### Scenario: the project does not use living specs
- **WHEN** completion runs
- **THEN** nothing is recorded

### The tasks Polish phase validates the spec's Success Criteria in exactly one place

The tasks command's Polish phase SHALL generate a task validating the result against the spec's Success Criteria, unless a hook under `commands.implement.hooks.after.implement-exec` in `.specify/companion.yml` carries `owns: validation`, in which case it MUST defer to that hook. An unmarked hook does not defer, because the same anchor also hosts review, PR and deploy hooks. Validation is owned in one place, so suites never run twice.

#### Scenario: a project marks a hook as owning validation
- **WHEN** the tasks command builds the Polish phase and a hook under `commands.implement.hooks.after.implement-exec` carries `owns: validation`
- **THEN** the Polish validation task defers to that hook and no second suite run is generated

#### Scenario: unmarked post-implement hooks are present (a ship tail)
- **WHEN** the tasks command builds the Polish phase and hooks exist under `commands.implement.hooks.after.implement-exec` but none carries `owns: validation`
- **THEN** the Polish phase generates and owns the validation run, and the unmarked hooks do not defer it

#### Scenario: no post-implement hook is declared
- **WHEN** the tasks command builds the Polish phase and no such hook is present (or `companion.yml` is absent or malformed)
- **THEN** the Polish phase generates and owns the validation run, as before

### A diagnostic command recomputes reality rather than trusting what a run recorded
<!-- touches: speckit-extension/commands/speckit.companion.doctor.md -->

A command reporting on a run's health MUST recompute its answer, never read back a verdict the run recorded. It SHALL be read-only, always exit successfully, and isolate each check so a failure becomes that check's skip reason. It MUST report every known check as ran, skipped with a reason, or not applicable, and its core checks MUST use only the durable record and on-disk documents, so it works on runs older than the command.

#### Scenario: a recorded claim contradicts the recomputation
- **WHEN** a run recorded that an area was clean and recomputing finds otherwise
- **THEN** the contradiction is reported as a false claim, showing both sides

#### Scenario: a check cannot run
- **WHEN** the input a check needs is missing
- **THEN** it is reported as skipped with the reason, never as clean

Where the build recorded what a run must produce, the command SHALL report a step that closed without a declared document as a warning, not a gate, since the spec may predate today's pipeline. A step that produced none of the declared documents SHALL be reported as no record rather than a fault.

#### Scenario: a step closed without the document its node declares
- **WHEN** the command compares what the build recorded against the spec on disk
- **THEN** the missing document is reported as a warning naming the step and the node that writes it
- **AND** a step that produced none of the declared documents is reported as no record rather than a fault

## Uncovered

_None. Re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
