# Steering Companion — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The Companion node shows the installed Companion extension's configuration, commands, and preset templates in the steering tree, read live from the installed files. These rules keep that read path-confined and tolerant of broken configuration.

## Requirements

### The Companion node reports install state and reads the installed extension live
<!-- touches: src/features/steering/companionSteering.ts -->

The node SHALL tell installed from not installed by the extension's presence on disk, and offer the install action when absent. When present, it SHALL derive its configuration groups, command list, and preset templates from the installed manifest and configuration, not a compiled-in list.

#### Scenario: the Companion adds a command in a later release
- **WHEN** the installed manifest lists a command this extension has never heard of
- **THEN** it appears under the Companion node with its own description
- **AND** clicking it opens that command's body file

#### Scenario: the Companion is installed while the view is open
- **WHEN** the install completes
- **THEN** the node switches to its installed presentation and populates its children without a window reload

### Every path the tree opens is confined to the root that owns it
<!-- touches: src/features/steering/companionSteering.ts, src/features/steering/steeringExplorerProvider.ts -->

A path built from user- or manifest-supplied text SHALL be rejected unless it resolves inside its owning root: the workspace for configuration and reference sources, the installed extension directory for command bodies and templates. Otherwise a relative escape in editable text turns a tree click into an arbitrary-file open.

#### Scenario: a manifest points a command body outside the extension directory
- **WHEN** the declared path traverses out of the extension root
- **THEN** the row renders without an open action

#### Scenario: a workflow declares a reference folder outside the workspace
- **WHEN** the declared path resolves outside the workspace root
- **THEN** that source is skipped and no reference row is created

### Unreadable or malformed configuration degrades to an empty section
<!-- touches: src/features/steering/companionSteering.ts -->

Any parse or read failure while assembling a section SHALL yield an empty section, not an error dialog or failed render.

#### Scenario: the Companion configuration file is not valid YAML
- **WHEN** the configuration group list is requested
- **THEN** no group entries are produced
- **AND** the rest of the tree renders normally

Configuration the tree can parse but the runtime cannot SHALL be treated as unparseable. The local YAML library accepts anchors, block scalars, and tab indentation that the runtime rejects and replaces with shipped defaults.

#### Scenario: the configuration uses YAML the runtime cannot read
- **WHEN** the file parses locally but contains a construct the runtime reader rejects
- **THEN** no group entries are produced
- **AND** the tree does not advertise settings the runtime will ignore

## Uncovered

_None: every file in the area was read._
