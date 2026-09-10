# Run Completion — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

A run ends at one terminal step with one writer, validation is owned in exactly one place, and a diagnostic recomputes the run's health rather than trusting it. Without this, a run that looks finished ships broken code and a spec claims a clean state nobody checked.

## Requirements

### Completion is an explicit terminal step with exactly one writer

The Companion pipeline ends at a dedicated completion command; the stock pipeline has no terminal step and simply stops. That command writes the terminal status through the shared writer and never by hand, refuses a spec whose work is outstanding, and is a no-op on a spec already shipped. This is the pipeline's completion gate — a second writer of that status MUST NOT be introduced anywhere.

#### Scenario: implementation finishes
- **WHEN** the terminal step runs
- **THEN** the spec is promoted to completed through the single writer
- **AND** the recorded current step stays at the last real step

#### Scenario: work remains
- **WHEN** the terminal step runs against an unfinished spec
- **THEN** it refuses and reports, without failing the host

"The work validates" SHALL mean the project's own checks ran and passed, not that the result was read against the spec. A spec MUST NOT be marked complete over a failing suite the run introduced: the failure is fixed, or the spec is left at the implemented status with the reason stated. Where the checks genuinely could not be run, that SHALL be recorded as a concern before completing, so the record says "finished, unverified" rather than implying "finished, verified". Completing on red is how a run that looks finished ships broken code, and the completed status is the one signal a reader trusts without opening anything.

A verification entry SHALL record the command that ran and its real outcome, never a restatement of intent, and a check that could not be run SHALL produce a concern and no verification entry at all — an entry for a check that never happened is worse than no entry, because every later reader trusts it.

#### Scenario: a test the run authored fails
- **WHEN** the implement step reaches its end
- **THEN** the failure is fixed before completion, or the spec stays at implemented with the reason stated

#### Scenario: the project has no runnable test script
- **WHEN** the run cannot execute its checks
- **THEN** it says so in the summary and records a concern
- **AND** it records no verification entry for the check it did not run

### Completion accounts for every loaded capability — a delta or an explicit skip, never silence

The completion step (both the implement-time close and the terminal `mark-complete`) instructs the AI to read `livingSpecs.loaded` and account for **every** name in it before folding — each gets exactly one of two outcomes. A loaded capability whose *behavior* the feature changed gets a marked delta block appended to the feature spec capturing the real requirement. A loaded capability merely read for context gets an explicit recorded skip (`write-context.py --living-spec-skip "<name>: <reason>"`), so "correctly nothing" stays distinguishable from "silently nothing." A loaded capability that is neither is a hole the fold flags loudly. The delta verb is chosen by whether the requirement's heading already exists in that capability's living spec: a heading not already there goes under `## ADDED Requirements` even when it revises the same behavior area, and `## MODIFIED Requirements` is reserved for editing the body of a heading that already matches one in the living spec.

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

Accounting for every loaded capability answers nothing when none was loaded, and returns "all accounted for" by definition. On a project with living specs turned on, loading nothing means the change was briefed on nothing and wrote nothing back, which is the state living specs exist to prevent. Completion SHALL record that outcome as a concern on the run, where the doctor reads it and the panel shows it, rather than only on the error stream. The note SHALL name both causes, because they look identical from here and their fixes differ: the area may belong to no capability yet, or a capability may claim it while no requirement describes it. A project not using living specs records nothing.

#### Scenario: a configured project resolves no capability for the change
- **WHEN** completion runs
- **THEN** the run carries a concern saying so, naming both causes

#### Scenario: the project does not use living specs
- **WHEN** completion runs
- **THEN** nothing is recorded

### The tasks Polish phase validates the spec's Success Criteria in exactly one place

The tasks command's final Polish phase generates a task to validate the result against the spec's Success Criteria. The deferral is gated on an explicit marker, not the mere presence of a hook: only when a hook entry under `commands.implement.hooks.after.implement-exec` (in `.specify/companion.yml`) carries `owns: validation` does that hook own the run, so the Polish phase MUST defer to it rather than generate a second suite run. Presence of an unmarked hook does not defer — the same anchor also hosts review, PR, and deploy hooks, so keying on presence would silently drop validation for any project with a ship tail. With no marked hook the Polish phase owns validation and generates the run itself. Validation ownership therefore lives in exactly one place, and a project that owns its own run never executes the suites twice.

#### Scenario: a project marks a hook as owning validation
- **WHEN** the tasks command builds the Polish phase and a hook under `commands.implement.hooks.after.implement-exec` carries `owns: validation`
- **THEN** the Polish validation task defers to that hook and no second suite run is generated

#### Scenario: unmarked post-implement hooks are present (a ship tail)
- **WHEN** the tasks command builds the Polish phase and hooks exist under `commands.implement.hooks.after.implement-exec` but none carries `owns: validation`
- **THEN** the Polish phase generates and owns the validation run — the unmarked hooks do not defer it

#### Scenario: no post-implement hook is declared
- **WHEN** the tasks command builds the Polish phase and no such hook is present (or `companion.yml` is absent or malformed)
- **THEN** the Polish phase generates and owns the validation run, as before

### A diagnostic command recomputes reality rather than trusting what a run recorded
<!-- touches: speckit-extension/commands/speckit.companion.doctor.md -->

Where a command reports on the health of a run, it MUST derive its answer by recomputing, never by reading back a verdict the run recorded about itself — a run that claimed it was clean is precisely the case worth checking. Such a command SHALL be read-only, SHALL always exit successfully, and SHALL isolate each of its checks so that one failing becomes that check's stated skip reason rather than taking the report down. It MUST report, for every check it knows about, whether that check ran, was skipped with a reason, or did not apply, so that "found nothing" and "could not look" can never print the same way. Its core checks MUST derive from the durable record and the on-disk documents alone, so that it produces a meaningful verdict on a run that finished long before the command existed.

#### Scenario: a recorded claim contradicts the recomputation
- **WHEN** a run recorded that an area was clean and recomputing finds otherwise
- **THEN** the contradiction is reported as a false claim, showing both sides

#### Scenario: a check cannot run
- **WHEN** the input a check needs is missing
- **THEN** it is reported as skipped with the reason, never as clean

Where the build has recorded what a run of this pipeline must produce, the command SHALL also hold the run to that record and report a step that closed without a document it declared. That finding is a warning rather than a gate, because the record describes the pipeline as it is built today while the spec on disk may have been produced by an earlier one, and a step that produced none of the declared documents SHALL be read as a run of some other pipeline and reported as no record rather than as a fault.

#### Scenario: a step closed without the document its node declares
- **WHEN** the command compares what the build recorded against the spec on disk
- **THEN** the missing document is reported as a warning naming the step and the node that writes it
- **AND** a step that produced none of the declared documents is reported as no record rather than a fault

## Uncovered

_None — re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
