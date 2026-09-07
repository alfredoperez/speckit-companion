# Specs Pipeline Build — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Turning the pipeline configuration into command bodies: one verdict on whether a config is usable, staleness reported against every input, a build that is previewable and logged, and a drawn structure that is the build's own.

## Requirements

### One answer about whether a config is usable

A configuration file read by more than one reader MUST get one verdict. The editor SHALL refuse exactly what the runtime refuses, so a file every command rejects cannot render as a healthy tree in the sidebar while the terminal reports it unreadable. Where the two must be implemented separately, they SHALL be pinned against a shared set of fixtures so they cannot drift apart again, and the reason a config was rejected — with the line at fault — SHALL be visible from the editor rather than only from a terminal the user may never open.

#### Scenario: a config the runtime cannot read
- **WHEN** a registry uses syntax outside the runtime's supported subset
- **THEN** the editor rejects it too, naming the line, rather than showing it as working

#### Scenario: a config both readers accept
- **WHEN** a file is inside the supported subset
- **THEN** it behaves exactly as before — this narrows nothing that already works

### A built pipeline reports when it is older than what it was built from

Turning the configuration into the command bodies the assistant reads is a build, so the built output SHALL be reported as out of date whenever anything it was built from is newer — the configuration file, a node, a workflow, a fragment, or a template. Comparing against the configuration file alone reports "current" in exactly the case the editor makes easiest: editing a node writes a file that is not `companion.yml`. Nothing about a run looks wrong when the two disagree; the file says one thing and the assistant is handed another.

#### Scenario: a node is edited and nothing is rebuilt
- **WHEN** the build state is read
- **THEN** it reports the build as stale, naming that the inputs are newer

### A build is previewable, and its log is kept rather than summarized

Running a build from the editor SHALL offer a preview that writes nothing alongside the build that writes, and SHALL keep the full output in the log rather than reducing it to a notification — a build's output is the change it is about to make, which does not fit in a toast. The log SHALL take the screen only when the build failed, and a build that hangs SHALL be abandoned rather than left running.

#### Scenario: a build succeeds
- **WHEN** it finishes
- **THEN** the full output is in the log and the editor is not stolen to say so

#### Scenario: a build fails
- **WHEN** it reports an error
- **THEN** the log is surfaced with the whole output

### The pipeline structure shown is the one a build would produce

The structure the pipeline builder draws SHALL be derived by the same half of the product that performs the build, from the same configuration, rather than re-derived on the editor side. A second derivation of the same structure drifts from the first within a release, and the drawing then describes a pipeline that would not be built.

#### Scenario: the builder renders a pipeline
- **WHEN** its structure is resolved
- **THEN** it comes from the build's own derivation, so what is drawn is what a build would produce
