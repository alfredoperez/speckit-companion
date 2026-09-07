# Task Progress — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Phase completion is derived from the task document and announced only when a phase newly completes.

## Requirements

### Task progress is derived from the task document and only reported on transitions

Phase completion SHALL be computed by parsing the task document into phases and counting only genuine task checkboxes — items inside code blocks are documentation, not work. A notification MUST fire only when a phase newly becomes complete relative to the last observed state, and the cache MUST be seeded on first sight of a file so opening an already-finished project announces nothing.

#### Scenario: an already-complete task file is opened
- **WHEN** its state is first observed
- **THEN** the cache is seeded and no completion is announced

#### Scenario: the final task of a phase is checked
- **WHEN** the file changes
- **THEN** that phase alone is reported as newly complete, and re-saving the file reports nothing further
