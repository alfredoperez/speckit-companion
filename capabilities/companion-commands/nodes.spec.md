# Command Nodes — Living Spec

<!-- reviewed: d589a63e -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

A command is an ordered list of nodes with declared boundaries, phases, routing and outputs, so a project can attach work at a known point and the build can say what a run must produce. Otherwise a customization means editing a generated body the next build overwrites.

## Requirements

### Projects extend commands at node boundaries, never by editing bodies

A project SHALL declare its own work against a command's node boundaries in a configuration file, and the assembled body SHALL make the agent run each boundary's attachments in declared order. A recipe may also override which nodes a command runs. An attachment naming a boundary missing from the active node set MUST warn and be skipped, and the mechanism never fails the host.

#### Scenario: a project attaches work to a node boundary
- **WHEN** the command reaches that node
- **THEN** the project's attachments run in declared order at that boundary

#### Scenario: an attachment names a boundary that is not in the active node set
- **WHEN** the configuration is merged
- **THEN** it warns and skips rather than failing or silently ignoring

An assembled body SHALL carry an explicit marker at each node's start and end, and a coarser marker around each phase, a named group of consecutive nodes. A step's node order SHALL declare its phases over exactly those node ids in the same order, and the flat order stays the authority on sequence.

Each node SHALL carry a human-readable name for the panel. A step's declaration SHALL name the nodes it ships but does not run by default, and which default node each stands in for, so swapping in a delta or bugfix draft is a pick. A node whose output the size budget may fold away SHALL declare that output as one it may write, so a folded run is not reported as incomplete.

#### Scenario: a project attaches work to a phase
- **WHEN** the command reaches that phase's first node
- **THEN** the attachment runs there, without the project naming an individual node

#### Scenario: a run folds the design side files into the plan
- **WHEN** the run is checked against what it should have produced
- **THEN** the folded documents are not counted as missing

### A node can ship without running, so a project can be offered it rather than told about it

A step's order SHALL be able to name nodes it does not run by default. Those nodes stay in the tree, assemble like any other once a recipe names them, and are what the builder offers from a list. Such a node MUST NOT run unasked, and the same gates SHALL hold it to the same shape so it does not rot.

#### Scenario: a step declares a node it does not run
- **WHEN** the command is assembled with the default order
- **THEN** that node contributes nothing to the body

#### Scenario: a recipe names it
- **WHEN** the command is assembled
- **THEN** it assembles in like any other node

### A step's branch points are declared as data beside its node order

Where a step's node makes a routing decision, the step's node order SHALL declare which node decides, the verdicts it can reach, the steps each verdict folds away, and the notice each verdict prints. Prose alone left the routing neither changeable nor drawable.

#### Scenario: a step declares its routing
- **WHEN** the pipeline is built or drawn
- **THEN** both read the same declaration rather than re-reading the prose

### The command inventory records what each command's run must produce

The shipped inventory SHALL record, per command, the artifacts a run must produce and the node that produces each, derived from the node order the bodies were assembled from and marking the ones a fold may skip. Without it, a step that stopped writing its document looks the same as one that wrote it.

#### Scenario: a run is checked against what it claimed
- **WHEN** the expected artifacts are read
- **THEN** they describe the pipeline that was actually assembled

## Uncovered

_None. Re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
