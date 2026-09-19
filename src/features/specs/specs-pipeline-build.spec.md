# Specs Pipeline Build — Living Spec

<!-- reviewed: a9c0b02b -->

## Purpose

Builds the project's pipeline configuration into the command bodies the assistant reads, and tells the user when that build no longer matches its inputs.

## Requirements

### A built pipeline reports when it is older than what it was built from

The build SHALL be reported out of date whenever any input is newer than it: the configuration file, a node, a workflow, a fragment or a template. Checking the configuration file alone misses the most common edit, a node.

#### Scenario: a node is edited and nothing is rebuilt
- **WHEN** the build state is read
- **THEN** it reports the build as stale

### A build is previewable, and its log is kept rather than summarized

Running a build from the editor SHALL offer a preview that writes nothing alongside the build that writes.

#### Scenario: the reader previews a build
- **WHEN** the preview finishes
- **THEN** it lists the commands that would change and no file on disk has changed

### A build's full output goes to the log, which takes focus only on failure

The full output of a build SHALL go to the log, not a notification, and the log SHALL come forward only when the build failed.

#### Scenario: a build succeeds
- **WHEN** it finishes
- **THEN** the full output is in the log and the editor keeps focus

#### Scenario: a build fails
- **WHEN** it reports an error
- **THEN** the log is brought forward with the whole output

### A hung build is abandoned

A build that has not finished within a minute SHALL be stopped and reported as failed.

#### Scenario: the build script never exits
- **WHEN** a minute passes
- **THEN** the build is abandoned and the failure is shown

### The pipeline structure shown is the one a build would produce

The pipeline builder SHALL draw the structure the build itself derives from the same configuration, never a second derivation in the editor.

#### Scenario: the configuration adds a step
- **WHEN** the builder renders the pipeline
- **THEN** it shows the step where a build would place it

## Uncovered

- All files under `__tests__/` were listed but not read.
