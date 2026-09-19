## Purpose

One marker points at files that exist; the other points at nothing.

## Requirements

### A rule whose marker matches
<!-- touches: speckit-extension/scripts/living_spec_fold.py -->

It MUST do the thing.

#### Scenario: the ordinary case
- **WHEN** asked
- **THEN** it does it

### A rule whose marker matches nothing
<!-- touches: src/does-not-exist/**, src/also-not-here.ts -->

It MUST do the other thing.

#### Scenario: the ordinary case
- **WHEN** asked
- **THEN** it does it
