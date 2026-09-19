# Living-Spec Shape Check — Living Spec

## Purpose

A read-only check reports where a living spec or a feature spec's deltas would break the fold or read as untidy, each finding with a severity, a code, a line and a fix.

## Requirements

### A living spec's shape is checkable, and the fold refuses to write a break
<!-- touches: speckit-extension/scripts/living_validate.py, speckit-extension/scripts/living_spec_fold.py -->

A read-only check covers every registered living spec and the delta sections of active feature specs. Each finding carries a severity, a stable code, the path, the line and a one-line fix. Error means the fold would damage the record; warning means untidy. The check always exits successfully.

#### Scenario: a requirement has no scenario
- **WHEN** the check runs
- **THEN** it reports an error-level finding at that heading's line with a fix

#### Scenario: a marker names a file that does not exist
- **WHEN** the check runs
- **THEN** it reports the marker's line

### Code a capability claims but no requirement describes is reported
<!-- touches: speckit-extension/scripts/living_validate.py -->

Claims are compared by expanding globs to real files, so the check never fires on code the registry exempts or several capabilities share.

#### Scenario: a capability claims an area no requirement describes
- **WHEN** the check runs on a spec whose markers never reach a second area the capability claims
- **THEN** it names that area, because a change there would load this capability and receive nothing

### The check reads markers exactly as the resolver does
<!-- touches: speckit-extension/scripts/living_validate.py -->

#### Scenario: a formatter separates a heading from its marker
- **WHEN** the check reads a spec whose markers sit under a blank line
- **THEN** it reads them as markers

### A requirement removed on purpose is not reported as a missing heading

A `requirement-removed` record beside a living spec suppresses `delta-heading-not-found` for that heading, and only for its own capability.

#### Scenario: a delta names a heading with a removal record
- **WHEN** validation runs
- **THEN** no `delta-heading-not-found` is reported for it

#### Scenario: the record names another capability in a shared file
- **WHEN** validation runs
- **THEN** `delta-heading-not-found` is still reported
