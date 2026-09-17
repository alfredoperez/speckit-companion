# Specs Pipeline Build — Living Spec

<!-- reviewed: a9c0b02b -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Builds the project's pipeline configuration into the command bodies the assistant reads, and tells the user when that build no longer matches its inputs.

## Requirements

### One answer about whether a config is usable

A configuration file read by several readers MUST get one verdict: the editor SHALL refuse exactly what the runtime refuses. Where the two are implemented separately, they SHALL be pinned against shared fixtures. The rejection reason, with the line at fault, SHALL be visible in the editor, not only in a terminal.

#### Scenario: a config the runtime cannot read
- **WHEN** a registry uses syntax outside the runtime's supported subset
- **THEN** the editor rejects it too, naming the line

#### Scenario: a config both readers accept
- **WHEN** a file is inside the supported subset
- **THEN** it behaves exactly as before

### A built pipeline reports when it is older than what it was built from

The built output SHALL be reported out of date whenever any input is newer: the configuration file, a node, a workflow, a fragment, or a template. Checking `companion.yml` alone misses the most common edit, a node file.

#### Scenario: a node is edited and nothing is rebuilt
- **WHEN** the build state is read
- **THEN** it reports the build as stale, naming that the inputs are newer

### A build is previewable, and its log is kept rather than summarized

Running a build from the editor SHALL offer a preview that writes nothing alongside the build that writes. The full output SHALL go to the log, not a notification. The log SHALL take focus only when the build failed, and a hung build SHALL be abandoned.

#### Scenario: a build succeeds
- **WHEN** it finishes
- **THEN** the full output is in the log and the editor keeps focus

#### Scenario: a build fails
- **WHEN** it reports an error
- **THEN** the log is surfaced with the whole output

### The pipeline structure shown is the one a build would produce

The pipeline builder SHALL draw the structure derived by the build itself from the same configuration, not a second derivation on the editor side.

#### Scenario: the builder renders a pipeline
- **WHEN** its structure is resolved
- **THEN** it comes from the build's own derivation, so what is drawn is what a build would produce

## Uncovered

- All files under `__tests__/` were listed but not read.
