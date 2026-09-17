# Capture runtime living fold — Living Spec

> [DRAFT] Re-adopted on 2026-09-07 from the single capture-runtime living spec, requirements moved verbatim, every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

At completion a feature spec's requirement deltas are folded into the durable living specs. The fold must be idempotent, route each delta to its capability, account for every loaded capability, and refuse to write a shape the pipeline could not update later.

## Requirements

### Folding a feature spec's requirement deltas into a living spec is idempotent for every verb combination

Re-applying a delta set to its own output MUST be a byte-for-byte no-op for any single verb, ordered pair, or combination. Verbs SHALL apply in a fixed pipeline order regardless of document order, and an addition MUST resolve its heading through the set's own renames before checking whether the section exists. A rename chain that loops back on itself is dropped as unsatisfiable rather than applied.

#### Scenario: a delta set both adds and renames the same heading
- **WHEN** the set is folded a second time
- **THEN** the living spec is unchanged and no section is duplicated

#### Scenario: the same heading is both added and modified
- **WHEN** the fold resolves the conflict
- **THEN** the modified body wins over the added body

### The fold routes each capability's requirements to its own spec

A feature spec may declare one delta block per capability, marked `<!-- capability: <name> -->`. The fold applies to each capability only the units marked for it, plus unmarked units when that capability is the changed-files-matched default. A requirement marked for one capability never lands in another's spec.

#### Scenario: two blocks marked for different capabilities

- **WHEN** a completing feature's spec carries an `ADDED` block marked for capability A and another marked for capability B
- **THEN** A's spec receives only A's requirement, B's spec receives only B's, and both names are recorded on `livingSpecs.synced`

#### Scenario: an unmarked block on a multi-capability fold

- **WHEN** a block carries no capability marker
- **THEN** it folds into the capability the changed files resolved to, and not into any marker-routed capability

### Completion accounts for every loaded capability — fold it, or record a reasoned skip

Completion MUST settle each capability on `livingSpecs.loaded`: fold a delta into its spec, or record a skip saying why it was left untouched. The runtime SHALL provide `--living-spec-skip "<name>: <reason>"`, which appends `{name, reason}` to `livingSpecs.skipped`, de-duplicated by name with the first reason winning. A skip MUST name a capability and justify it; an entry with a blank reason is dropped with a stderr warning and the capability stays unaccounted. In both its no-delta and partial-fold branches, the fold's backstop SHALL report, loudly and actionably, every loaded capability that is neither folded (this run or a prior one) nor skipped, and say so explicitly when all are accounted for.

On a project with a registry, a fold that finds neither a delta block nor a loaded capability SHALL record a concern on the run, not a stderr line, so the doctor and the panel see it. It stays silent on a project that does not use living specs and never fails the host command.

#### Scenario: a configured project resolves no capability at all
- **WHEN** the fold runs with no delta block and nothing loaded
- **THEN** a concern is recorded on the run saying the change was briefed on nothing and folded nothing

#### Scenario: a loaded capability the change didn't alter
- **WHEN** completion records a reasoned skip for a loaded capability
- **THEN** the note lands on `livingSpecs.skipped` and the fold treats that capability as accounted

#### Scenario: a skip with no reason
- **WHEN** a skip note carries a name but a blank reason
- **THEN** it is not recorded, a warning goes to stderr, and the capability stays unaccounted

#### Scenario: a loaded capability is neither folded nor skipped
- **WHEN** the fold runs with a loaded capability that has no delta block and no skip note
- **THEN** the fold names it as unaccounted and points at the two ways to close the loop
- **AND** a partial fold that wrote a delta for one capability does not silence the gap for the others

#### Scenario: an already-synced spec is folded again
- **WHEN** a spec whose capabilities were folded on a prior run is re-folded and writes nothing new
- **THEN** the persisted `livingSpecs.synced` names keep those capabilities accounted and the backstop raises no false alarm

### An unmatched MODIFIED requirement is promoted to ADDED, not dropped

A requirement under `## MODIFIED Requirements` that matches no existing heading SHALL be appended as if ADDED, after resolving its heading through the set's renames, and counted separately from applied modifications. The promotion stays idempotent: a re-fold that finds it already present appends nothing.

#### Scenario: a MODIFIED heading matches nothing
- **WHEN** the fold applies a MODIFIED delta whose heading is absent from the living spec
- **THEN** the requirement is appended and reported as promoted, not skipped

#### Scenario: the promoted requirement is folded again
- **WHEN** the same delta set is folded a second time
- **THEN** the existing requirement stays in place and nothing is duplicated

### A fold carries a requirement's markers across, and clears the one the run has answered

A fold SHALL keep a requirement's existing markers when it replaces the body: the file marker, merged with any the delta brought, and any edge naming a rule under another capability. The one exception is the marker saying adoption transcribed the requirement unchecked: the fold SHALL drop it and report the requirement as confirmed, because the run has now built against it.

#### Scenario: a fold rewrites a requirement carrying an edge to another capability's rule
- **WHEN** the delta is applied
- **THEN** the edge and the file marker are still under the heading afterwards

#### Scenario: a fold lands on a requirement adoption transcribed
- **WHEN** the delta is applied
- **THEN** the transcription marker is gone and the fold reports the requirement as confirmed

### A living spec's shape is checkable, and the fold refuses to write a break
<!-- touches: speckit-extension/scripts/living_validate.py, speckit-extension/scripts/living_spec_fold.py -->

The capture runtime SHALL provide a read-only check over every registered living spec and the delta sections of active feature specs. It reports a requirement with no scenario, a scenario missing its condition or outcome, duplicate headings within one capability, a delta block marked for an unregistered capability, a delta entry naming a heading the target lacks, and a file marker matching nothing on disk.

It SHALL also report a spec whose every file marker names code the capability does not claim, and a capability claiming code no requirement describes. Both SHALL be decided by expanding globs to real files through the resolver's own matcher, never by comparing patterns. Neither SHALL fire on code the registry's exemptions cover, on membership several capabilities share, or on a spec whose markers all miss.

A marker SHALL be found the way the resolver finds it: the first non-blank line under the heading, skipping sibling markers beside it.

Each finding SHALL carry a severity, a stable code, the path, the line, a sentence, and a one-line fix. The check SHALL always exit successfully. Severity SHALL mean only whether the fold stops: error means the durable record would be damaged, warning means untidy.

The fold SHALL run the same check in-process before writing and refuse, per capability, on any error-level finding, naming it. A refusal for one capability SHALL NOT block another's sound delta in the same run.

#### Scenario: a delta would fold in a scenario nobody can check
- **WHEN** the fold runs
- **THEN** that capability is refused, the finding is named, and its spec is left byte for byte unchanged

#### Scenario: a delta names a heading the target does not carry
- **WHEN** the fold runs
- **THEN** it applies, because promoting an unmatched modification to an addition is a defined outcome, and the finding is reported as a warning

#### Scenario: one capability is refused and another is sound
- **WHEN** the fold runs
- **THEN** the sound capability is written and only the broken one is refused

#### Scenario: the check itself fails
- **WHEN** it raises
- **THEN** the fold proceeds, because a broken check must never block a sound fold

#### Scenario: a block is marked for a capability nobody registered
- **WHEN** the fold runs
- **THEN** the refusal is reported under that capability's name, so the block is never dropped without telling the author

#### Scenario: a capability claims an area no requirement describes
- **WHEN** the check runs on a fully marked spec whose capability claims a second area none of the markers reach
- **THEN** it names that area, because a change there would load this capability and receive nothing

#### Scenario: a formatter separates a heading from its marker
- **WHEN** the check reads a spec whose markers sit under a blank line
- **THEN** it reads them as markers, exactly as the resolver does

#### Scenario: the check runs on a delta rather than on a whole spec
- **WHEN** the requirement shapes are checked
- **THEN** the file-marker check is skipped, because this path never keeps its result and indexing the tree costs every fold

### A fold cannot empty a spec unless the capability declared its retirement
<!-- touches: speckit-extension/scripts/living_spec_fold.py, speckit-extension/scripts/companion_config.py, speckit-extension/scripts/resolve-spec-paths.py -->

A fold that would leave a capability's spec with no requirements SHALL be refused, naming the capability, unless the registry declares that capability retired. The declaration SHALL be optional, SHALL default to false, and SHALL be carried through to the shape the fold reads.

#### Scenario: a fold would remove the last requirement and retirement is not declared
- **WHEN** the fold runs
- **THEN** it refuses, names the capability, and says how to declare the retirement

#### Scenario: the capability declared its retirement
- **WHEN** the same fold runs
- **THEN** it applies

#### Scenario: a fold removes some requirements but not all
- **WHEN** it runs
- **THEN** it applies whether or not retirement is declared

#### Scenario: the guard and the applier disagree about what a requirement is
- **WHEN** either counts
- **THEN** both count the same headings with the shared slicer every other reader uses

#### Scenario: the spec carries a fence that is never closed
- **WHEN** the guard counts
- **THEN** it refuses nothing, because it cannot trust a count that hides everything under the fence

## Uncovered

- The Python test suite under `speckit-extension/tests/` was not read.

### A requirement removed on purpose is not reported as a missing heading

Validation SHALL read the `requirement-removed` records beside each living spec, scoped to that capability, and SHALL NOT raise `delta-heading-not-found` for a heading so recorded. A record naming another capability in a shared file SHALL NOT suppress the finding.

#### Scenario: a delta names a heading with a removal record
- **WHEN** validation runs
- **THEN** no `delta-heading-not-found` is reported for it

#### Scenario: the record names another capability
- **WHEN** validation runs
- **THEN** `delta-heading-not-found` is still reported
