# Fold a finished change back — Living Spec

## Purpose

A feature spec is a proposal that ends when the feature ships. Folding writes what the feature changed into the durable spec of each capability it touched, at the moment the feature is marked complete, so the living spec stays the record. A fold that writes to the wrong spec, writes twice, or quietly writes nothing is how a living spec stops being trusted.

## Requirements

### Delta sections in the feature spec say what changed
<!-- touches: apps/speckit-extension/scripts/spec_deltas.py, apps/speckit-extension/scripts/living_spec_fold.py -->

The feature's spec file MAY carry top-level `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements` and `## RENAMED Requirements` sections, each holding `###` requirements, with a rename written `### Old name -> New name`. At completion, adds SHALL append to the living spec, modifies replace the requirement with the same heading, removes delete it, and renames rewrite the heading. A modify whose heading does not exist is added instead, and the summary says so.

#### Scenario: a feature adds one requirement
- **WHEN** a completed feature's spec has an ADDED section with `### Users can set a due date on a todo`
- **THEN** that requirement and its scenarios appear in the capability's living spec

#### Scenario: a modify names a heading that is not there
- **WHEN** a MODIFIED entry's heading matches nothing in the living spec
- **THEN** it is appended as a new requirement and reported as added from a modify with no match

### Each capability receives only its own requirements
<!-- touches: apps/speckit-extension/scripts/living_spec_fold.py, apps/speckit-extension/scripts/spec_deltas.py -->

A delta section marked `<!-- capability: <name> -->` SHALL fold into that capability, and an unmarked section folds into the most specific capability the feature's changed files resolve to. When the changed files cannot be determined, only marked sections fold. A section marked for a capability that is not registered is not folded, and the fold names it and the command that would register it.

#### Scenario: one feature, two capabilities
- **WHEN** a feature carries one section marked `checkout` and one marked `billing`
- **THEN** each living spec receives only the requirements from its own section

### The first fold creates the spec file
<!-- touches: apps/speckit-extension/scripts/living_spec_fold.py -->

When a registered capability has no spec file yet, the fold SHALL create one with a title made from the capability name and a `## Requirements` section, then apply the deltas to it.

#### Scenario: a newly registered capability
- **WHEN** a feature adds a requirement to a capability whose spec file does not exist
- **THEN** the file is created at the registered path holding that requirement

### Folding twice changes nothing
<!-- touches: apps/speckit-extension/scripts/living_spec_fold.py, apps/speckit-extension/scripts/check_living_spec.py -->

Running completion again on the same feature SHALL leave every living spec byte for byte unchanged, including when the deltas carry a rename and an add for the same requirement. A feature spec with no delta section writes nothing.

#### Scenario: completion is re-run
- **WHEN** a feature whose deltas were already folded is completed again
- **THEN** the fold reports the capability as already up to date and writes nothing

### A broken delta stops only its own capability
<!-- touches: apps/speckit-extension/scripts/living_spec_fold.py, apps/speckit-extension/scripts/living_validate.py -->

Before writing, the fold SHALL run the shape checks on the feature's deltas and refuse any capability whose deltas carry an error-level finding, naming the finding, the file and the line. The other capabilities in the same feature still fold, and a warning never stops a fold. A shape check that fails outright SHALL be treated as having found nothing, so the checker breaking never blocks a sound fold.

#### Scenario: one scenario is missing its outcome
- **WHEN** the section for `billing` has a scenario with a WHEN and no THEN, and the section for `checkout` is sound
- **THEN** `billing` is refused with the finding named and `checkout` is folded

#### Scenario: the check itself breaks
- **WHEN** the shape check fails while reading the feature's deltas
- **THEN** every capability still folds and nothing is refused

### A fold never empties a spec unless the capability is retired
<!-- touches: apps/speckit-extension/scripts/living_spec_fold.py, apps/speckit-extension/scripts/companion_config.py -->

A fold that would leave a living spec with no requirements at all SHALL be refused, naming the capability, unless its registry entry says `retire: true`.

#### Scenario: removing the last requirement
- **WHEN** a feature removes the only requirement of a capability that is not marked retired
- **THEN** the spec is left untouched and the message says to set `retire: true` if that was intended

### A folded requirement keeps its edges and loses its draft marker
<!-- touches: apps/speckit-extension/scripts/living_spec_fold.py -->

When a fold replaces a requirement, its file marker SHALL become the union of the old globs and any the delta names, never fewer. Its `aligns` edge is carried across, and an `adopted` marker is cleared because a run that built against the requirement is what confirms it.

#### Scenario: modifying an adopted requirement
- **WHEN** a feature modifies a requirement that carries `touches`, `aligns` and `adopted` markers
- **THEN** the folded requirement keeps the `touches` globs and the `aligns` edge and has no `adopted` marker

### A fold that does nothing says exactly why
<!-- touches: apps/speckit-extension/scripts/living_spec_fold.py -->

The fold SHALL never fail completion, and when it writes nothing it names the one reason: living specs off, no capability resolved, no delta section, nothing matched, or already up to date. Every capability the feature loaded must end up folded, folded on an earlier run, or recorded as skipped with a reason, and any that is none of these is named as unaccounted. The names folded are recorded under `livingSpecs.synced`, and a feature on a configured project that loaded nothing and folded nothing leaves a concern on the feature saying so.

#### Scenario: a loaded capability was forgotten
- **WHEN** a feature loaded `checkout` and `billing`, folds a delta for `checkout`, and records no skip for `billing`
- **THEN** `checkout` is folded and the output names `billing` as neither folded nor skipped
