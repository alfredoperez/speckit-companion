# Capture runtime config — Living Spec

<!-- reviewed: e14af436 -->

## Purpose

`companion.yml` is a file people read and a panel edits. Reading, writing back, repairing and drawing it must agree with the build, so what the board shows is what would run.

## Requirements

### Writing one key back into the configuration preserves everything else byte for byte

#### Scenario: the panel writes a command's node order
- **WHEN** the file is written back
- **THEN** every line outside that key is unchanged, comments and spacing included

### Writing an empty value removes that key and nothing else

#### Scenario: a key is written back off again
- **WHEN** an empty value is written for a key the file carries
- **THEN** that key's lines are removed and everything around them is unchanged byte for byte

### A configuration too broken to read is repairable from the panel that reads it

Recovery is offered as the panel's own named actions, never as "open the YAML file".

#### Scenario: a phase is left empty by dragging its last node out
- **WHEN** the panel shows the broken configuration
- **THEN** it offers a named repair that drops the empty phase

### Repairs are offered narrowest first, each stating what it will cost

#### Scenario: several repairs apply
- **WHEN** repairs are offered
- **THEN** the one that keeps the most of the project's edits comes first, and each says what it discards

### The board draws the structure resolved from the project's configuration

Steps, phases, nodes, hook placement, decision routes and each one's difference from the shipped default are resolved once from the configuration and emitted for the panel, which does not derive them again.

#### Scenario: the builder renders a project's pipeline
- **WHEN** the structure is resolved
- **THEN** it reflects the project's configuration, not the shipped defaults with the project's changes imagined on top

### A bypassed configuration is resolved and drawn, and never allowed to fail the board

When a run selects the shipped pipeline, the project's own hooks are still drawn at their anchors, marked as not running and left out of every count of project changes.

#### Scenario: the project's file is bypassed
- **WHEN** the structure is emitted
- **THEN** the project's hooks appear at their anchors, marked as not running

#### Scenario: the bypassed file is the wrong shape
- **WHEN** the structure is resolved
- **THEN** the board is emitted with nothing parked, and the panel can still offer repairs

### A crash while emitting the structure reaches the panel as a readable error

The error names the file and describes the shape at fault, with the repairs, instead of passing on the runtime's own message.

#### Scenario: the configuration crashes the emission rather than refusing
- **WHEN** the panel asks for the structure
- **THEN** it receives a readable error naming the file and the shape, with the repairs

### Bypassed hooks the shipped shape cannot place are reported, not lost

#### Scenario: a bypassed hook attaches to something the shipped shape lacks
- **WHEN** the structure is emitted
- **THEN** the hook is reported as having nowhere to go

#### Scenario: resolving the bypassed file raises a warning
- **WHEN** the structure is emitted
- **THEN** the warning is carried with it

### A configuration the reader cannot fully read is rejected whole, never applied in part

A reader that meets unsupported syntax, or stops before the end of the file for any reason, reports the file as malformed and falls back to the shipped defaults, because an author would believe a partly applied file is all live. The report names the line and reaches the caller as a warning, not an exception.

#### Scenario: the file uses syntax the reader does not support
- **WHEN** a configuration uses a YAML feature outside the supported subset
- **THEN** one warning reports the file as malformed and names the line
- **AND** the shipped defaults are used, with nothing from the file applied

#### Scenario: the reader stops before the last line
- **WHEN** parsing ends with part of the file unread
- **THEN** the file is reported as malformed instead of returning what was understood so far

### What a project could attach is emitted with the pipeline it draws
<!-- touches: apps/speckit-extension/scripts/build-pipeline.py, apps/speckit-extension/scripts/pipeline-graph.py -->

The structure carries every hook command the project's registries hold, its installed spec-kit extensions and Companion's, each with its registry description, declaring extension and lifecycle step. It is never a hard-coded list.

#### Scenario: an extension is installed
- **WHEN** the structure is emitted
- **THEN** that extension's hook commands are carried in its own words, and a project without it is offered none of them

### A hook command registered at several steps is offered once, with no usual placement
<!-- touches: apps/speckit-extension/scripts/build-pipeline.py, apps/speckit-extension/scripts/pipeline-graph.py -->

#### Scenario: a command is registered at two lifecycle steps
- **WHEN** the structure is emitted
- **THEN** it is carried once and names no usual placement, instead of whichever step was read first

### An unreadable hook registry never fails the emission
<!-- touches: apps/speckit-extension/scripts/build-pipeline.py, apps/speckit-extension/scripts/pipeline-graph.py -->

#### Scenario: the registry cannot be read
- **WHEN** the structure is emitted
- **THEN** it carries nothing from that registry and the panel still works

#### Scenario: one lifecycle key holds something that is not a list of hooks
- **WHEN** the structure is emitted
- **THEN** that key alone is skipped, both here and where the board reads the same registry

### Default exemption patterns match at any depth

#### Scenario: a project with tests below the root and no exempt list of its own
- **WHEN** the living-specs registry defaults are applied
- **THEN** those test files are exempt, not only ones at the repository root

### Where specs live is asked once and read back from the registry

#### Scenario: a project already recorded where its specs live
- **WHEN** adoption runs again
- **THEN** it reads the recorded layout instead of asking a second time

#### Scenario: the registry records an unknown layout
- **WHEN** the registry is read
- **THEN** the layout is central

### A hook's anchor resolves to exactly one boundary, by one shared definition

When an anchor name matches several targets, the step wins, then a node, then a phase. Body assembly and the panel read the same precedence, so a hook is drawn where it runs.

#### Scenario: a hook is attached to a name that is both a phase and a node
- **WHEN** the pipeline structure is built
- **THEN** the hook is emitted once, on the boundary the assembled body places it at

### An anchor that names nothing is warned about and skipped

#### Scenario: a hook names a node the command does not have
- **WHEN** the body is assembled
- **THEN** a warning names the anchor and the hook is left out
