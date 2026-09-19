# Capture runtime living fold — Living Spec

## Purpose

At completion a feature spec's requirement deltas are folded into the living specs. The fold must be repeatable, route each delta to its capability, account for every loaded capability, and refuse to write a result a later run could not update.

## Requirements

### Folding the same delta set twice changes nothing

Re-applying a delta set to its own output is a byte-for-byte no-op for any verb or combination of verbs.

#### Scenario: a delta set both adds and renames the same heading
- **WHEN** the set is folded a second time
- **THEN** the living spec is unchanged and no section is duplicated

### A heading both added and modified in one set takes the modified body

#### Scenario: the same heading is both added and modified
- **WHEN** the fold applies the set
- **THEN** the living spec carries the modified body once

### The fold routes each capability's requirements to its own spec

A delta block marked `<!-- capability: <name> -->` folds only into that capability's spec. An unmarked block folds into the capability the changed files resolved to.

#### Scenario: two blocks marked for different capabilities
- **WHEN** a completing spec carries an `ADDED` block marked for capability A and another marked for B
- **THEN** A's spec receives only A's requirement, B's receives only B's, and both names are recorded on `livingSpecs.synced`

#### Scenario: an unmarked block on a multi-capability fold
- **WHEN** a block carries no capability marker
- **THEN** it folds into the capability the changed files resolved to, and into no marker-routed one

### Completion accounts for every loaded capability by folding it or recording a reasoned skip

A capability on `livingSpecs.loaded` is accounted for once a delta folds into its spec, this run or a prior one, or `--living-spec-skip "<name>: <reason>"` records why it was left alone. The fold names every capability still unaccounted, and says so when all are accounted for. It never fails the host command.

#### Scenario: a loaded capability is neither folded nor skipped
- **WHEN** the fold runs with a loaded capability that has no delta block and no skip
- **THEN** the fold names it as unaccounted and points at both ways to close it
- **AND** a delta folded for another capability in the same run does not silence it

#### Scenario: an already-synced spec is folded again
- **WHEN** a spec whose capabilities were folded on a prior run is re-folded and writes nothing new
- **THEN** those capabilities stay accounted and nothing is flagged

### A skip without a reason is not recorded

#### Scenario: a skip names a capability with a blank reason
- **WHEN** it is recorded
- **THEN** it is dropped with a stderr warning and the capability stays unaccounted

### A change that resolves no capability on a living-specs project leaves a concern on the run

The concern lands on the run, where the doctor and the panel see it. A project that does not use living specs hears nothing.

#### Scenario: a configured project resolves no capability at all
- **WHEN** the fold runs with no delta block and nothing loaded
- **THEN** a concern is recorded saying the change was briefed on nothing and folded nothing

### An unmatched MODIFIED requirement is promoted to ADDED, not dropped

#### Scenario: a MODIFIED heading matches nothing
- **WHEN** the fold applies a MODIFIED delta whose heading is absent from the living spec
- **THEN** the requirement is appended and reported as promoted, not skipped

### A fold keeps a requirement's markers when it replaces the body

The `touches` marker is kept, merged with any the delta brought, and so is any `aligns` edge to another capability's rule.

#### Scenario: a fold rewrites a requirement carrying an edge to another capability's rule
- **WHEN** the delta is applied
- **THEN** the edge and the `touches` marker are still under the heading afterwards

### A fold clears the adopted marker and reports the requirement confirmed

The run has built against the requirement, so it is no longer an unchecked transcription.

#### Scenario: a fold lands on a requirement adoption transcribed
- **WHEN** the delta is applied
- **THEN** the `adopted` marker is gone and the fold reports the requirement as confirmed

### The fold refuses only the capability whose delta has an error-level finding
<!-- touches: speckit-extension/scripts/living_validate.py, speckit-extension/scripts/living_spec_fold.py -->

#### Scenario: one capability is refused and another is sound
- **WHEN** the fold runs
- **THEN** the sound capability is written, the broken one is left byte for byte unchanged, and its finding is named

#### Scenario: a delta names a heading the target does not carry
- **WHEN** the fold runs
- **THEN** it applies and the finding is reported as a warning

#### Scenario: a block is marked for a capability nobody registered
- **WHEN** the fold runs
- **THEN** the refusal is reported under that capability's name, never dropped silently

### A shape check that crashes never blocks a fold
<!-- touches: speckit-extension/scripts/living_spec_fold.py -->

#### Scenario: the check raises
- **WHEN** the fold runs
- **THEN** the fold proceeds

### A fold cannot empty a spec unless the capability declared its retirement
<!-- touches: speckit-extension/scripts/living_spec_fold.py, speckit-extension/scripts/companion_config.py, speckit-extension/scripts/resolve-spec-paths.py -->

Retirement is `retire: true` on the capability's registry entry, false by default.

#### Scenario: a fold would remove the last requirement and retirement is not declared
- **WHEN** the fold runs
- **THEN** it refuses, names the capability, and says how to declare the retirement

#### Scenario: the capability declared its retirement
- **WHEN** the same fold runs
- **THEN** it applies

#### Scenario: a fold removes some requirements but not all
- **WHEN** it runs
- **THEN** it applies whether or not retirement is declared
