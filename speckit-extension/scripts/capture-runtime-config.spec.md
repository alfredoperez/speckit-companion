# Capture runtime config — Living Spec

> [DRAFT] Re-adopted on 2026-09-07 from the single capture-runtime living spec, requirements moved verbatim, every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The configuration is a file people read and a panel edits, and the panel draws its board from what the builder resolves. Reading, writing back, repairing, and emitting it must all agree with the build, so what is drawn is what would run.

## Requirements

### Writing one key back into the configuration preserves everything else byte for byte

Writing a value back into `companion.yml` SHALL be a surgical text edit of that one key's lines. It SHALL NOT round-trip the file through a YAML emitter, which would reformat comments, blank lines, and quoting.

#### Scenario: the panel writes a command's node order
- **WHEN** the file is written back
- **THEN** every line outside that key is unchanged, comments and spacing included

#### Scenario: a key is written back off again
- **WHEN** an empty value is written for a key the file carries
- **THEN** that key's line is removed and everything around it is left byte for byte, so any selection can be undone

### A configuration too broken to read is repairable from the panel that reads it

Recovery from a broken configuration SHALL be offered as the panel's own named actions, not "open the YAML file". Each repair SHALL be a small, named retreat toward what ships, ordered narrowest first, and SHALL state what it will cost.

#### Scenario: a phase is left empty by dragging its last node out
- **WHEN** repairs are offered
- **THEN** dropping that empty phase is offered first, and every other edit is kept

### The pipeline's structure is emitted here and drawn elsewhere

The structure the builder draws (steps, phases, nodes, hook placement, decision routes, and each one's difference from the shipped default) SHALL be derived here from the project's configuration and emitted for the editor. The editor SHALL NOT derive it a second time.

#### Scenario: the builder renders a project's pipeline
- **WHEN** the structure is resolved
- **THEN** it reflects the project's configuration, not the shipped defaults with the project's changes imagined on top

### A bypassed configuration is resolved and drawn, and never allowed to fail the board

When a run selects the shipped pipeline, the emitted structure SHALL still resolve the project's bypassed file and carry its hooks at their anchors, marked as not running and excluded from every count of project changes. Resolving it SHALL NOT fail the board on any error, including a file that parses but has the wrong shape. Any crash of the emission that is not a refusal SHALL still reach the panel as a readable error with the repairs, naming the file and describing the shape instead of passing on the runtime's own message. This side SHALL NOT count parked hooks. It reports only a hook whose anchor the shipped shape lacks, and it SHALL carry any warning the bypassed resolve raised.

#### Scenario: the bypassed file is the wrong shape
- **WHEN** the structure is resolved
- **THEN** the board is emitted with nothing parked, instead of failing and leaving the panel unable to repair anything

#### Scenario: a bypassed hook attaches to something the shipped shape lacks
- **WHEN** the structure is emitted
- **THEN** it is reported as having nowhere to go, and no count of what was drawn is emitted here

#### Scenario: the bypassed resolve raises a warning
- **WHEN** the structure is emitted
- **THEN** the warning is carried, because a hook that resolved to nothing lands in no count and would otherwise be lost

#### Scenario: the configuration crashes the emission rather than refusing
- **WHEN** the panel asks for the structure
- **THEN** it receives a readable error naming the file and the shape, with the repairs

### A configuration the reader cannot fully read is rejected whole, never applied in part

A reader that meets unsupported syntax or stops before the end of the file for any reason MUST report the file as malformed and fall back to the shipped defaults. It MUST NOT return the portion it understood, because the author would believe all of it is live. The report SHALL name the line at fault and reach the caller as a warning, not an exception.

#### Scenario: the file uses syntax the reader does not support
- **WHEN** a configuration uses a YAML feature outside the supported subset
- **THEN** one warning reports the file as malformed and names the line
- **AND** the shipped defaults are used, with nothing from the file applied

#### Scenario: the reader stops before the last line
- **WHEN** parsing ends with part of the file unread, whatever the cause
- **THEN** the file is reported as malformed instead of returning what was understood so far

### What a project could attach is emitted with the pipeline it draws
<!-- touches: speckit-extension/scripts/build-pipeline.py, speckit-extension/scripts/pipeline-graph.py -->

The emitted structure SHALL carry every hook command the project's own registries hold (its registered spec-kit extensions and Companion's), each with its registry description, declaring extension, and lifecycle step. It travels with the structure, not as a second request, and is never a hard-coded list. A command SHALL be carried once however many steps register it, and SHALL name a usual placement only when registered at exactly one step. Reading a registry SHALL NOT fail the emission: an unreadable one contributes nothing.

#### Scenario: an extension is installed
- **WHEN** the structure is emitted
- **THEN** that extension's hook commands are carried in its own words, and a project without it is offered none of them

#### Scenario: a command is registered at several lifecycle steps
- **WHEN** the structure is emitted
- **THEN** it is carried once and names no usual placement, instead of whichever step was read first

#### Scenario: the registry cannot be read
- **WHEN** the structure is emitted
- **THEN** it carries what it could read and the panel still works

#### Scenario: one lifecycle key holds something that is not a list of hooks
- **WHEN** the structure is emitted
- **THEN** that key alone is skipped, both here and where the board reads the same registry, so the two always agree

### The registry's defaults hold for a real tree, and the layout is asked once

An exemption pattern in the living-specs registry defaults SHALL match at any depth, so tests below the root are exempt. Where a project keeps its specs SHALL be decided once at set-up, recorded in the registry, and read back from it instead of asked again. An unrecognised layout answer SHALL fall back to central.

#### Scenario: a project with tests below the root and no exempt list of its own
- **WHEN** the defaults are applied
- **THEN** those test files are exempt, not only ones at the repository root

#### Scenario: a project already recorded where its specs live
- **WHEN** adoption runs again
- **THEN** it reads the recorded layout instead of asking a second time

### A hook's anchor resolves to exactly one boundary, by one shared definition

When an anchor name matches several targets, the step's name SHALL win, then a node, then a phase. That precedence SHALL live in one place read by both body assembly and the panel's structure, so a hook is drawn where it runs. A name matching nothing SHALL be warned about and skipped, and a phase and a node MAY share a name.

#### Scenario: a hook is attached to a name that is both a phase and a node
- **WHEN** the pipeline structure is built
- **THEN** the hook is emitted once, on the boundary the assembled body places it at

## Uncovered

- `companion_config.py`: read its contract docstring and failure table, not its YAML reader.
- The Python test suite under `speckit-extension/tests/` was not read.
