# Steering Companion — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The Companion node shows the installed Companion extension's configuration, commands and preset templates inside the steering tree, read from the installed files rather than a list compiled into this extension. Without it a user cannot see what the Companion actually ships, and a stale compiled list would tell them the wrong thing. This file holds the rules for reading that installation safely: live, path-confined, and tolerant of broken configuration.

## Requirements

### The Companion node reports install state and reads the installed extension live
<!-- touches: src/features/steering/companionSteering.ts -->

The node SHALL distinguish "installed" from "not installed" from the extension's on-disk presence, offer the install action when absent, and when present derive its configuration groups, command list, and preset templates by reading the installed manifest and configuration rather than a list compiled into this extension. A compiled-in list goes stale the moment the Companion ships a new command.

#### Scenario: the Companion adds a command in a later release
- **WHEN** the installed manifest lists a command this extension has never heard of
- **THEN** it appears under the Companion node with its own description
- **AND** clicking it opens that command's body file

#### Scenario: the Companion is installed while the view is open
- **WHEN** the install completes
- **THEN** the node switches to its installed presentation and populates its children with no window reload

### Every path the tree opens is confined to the root that owns it
<!-- touches: src/features/steering/companionSteering.ts, src/features/steering/steeringExplorerProvider.ts -->

A path assembled from user- or manifest-supplied text SHALL be rejected unless it resolves inside its owning root — the workspace for configuration and reference sources, the installed extension directory for command bodies and templates. Manifests and settings are editable text, so a relative escape must not turn a tree click into an arbitrary-file open.

#### Scenario: a manifest points a command body outside the extension directory
- **WHEN** the declared path traverses out of the extension root
- **THEN** the row renders without an open action rather than opening the escaped path

#### Scenario: a workflow declares a reference folder outside the workspace
- **WHEN** the declared path resolves outside the workspace root
- **THEN** that source is skipped and no reference row is created for it

### Unreadable or malformed configuration degrades to an empty section
<!-- touches: src/features/steering/companionSteering.ts -->

Any parse or read failure while assembling a section SHALL yield an empty result for that section rather than an error dialog or a failed render. The steering view is ambient context, so one broken YAML file must not take the tree down.

#### Scenario: the Companion configuration file is not valid YAML
- **WHEN** the configuration group list is requested
- **THEN** no group entries are produced
- **AND** the rest of the tree renders normally

Configuration the tree can parse but the runtime cannot SHALL be treated the same as unparseable. The YAML library used here accepts anchors, block scalars and tab indentation that the runtime reader rejects and replaces with the shipped defaults, so reading the file more permissively than the thing that acts on it would list groups from a configuration that is never going to be applied.

#### Scenario: the configuration uses YAML the runtime cannot read
- **WHEN** the file parses locally but contains a construct the runtime reader rejects
- **THEN** no group entries are produced
- **AND** the tree does not advertise settings the runtime will ignore

## Uncovered

_None — every file in the area was read._
