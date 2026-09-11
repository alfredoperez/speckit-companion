# Command Nodes — Living Spec

<!-- reviewed: d589a63e -->

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

A command is an ordered list of nodes with declared boundaries, phases, routing and outputs, so a project can attach work at a known point and the build can say what a run must produce. Without it, customizing a command means editing a generated body that the next build overwrites.

## Requirements

### Projects extend commands at node boundaries, never by editing bodies

Because a body is generated, a project customizing it would be overwritten. Instead, a project SHALL declare its own work against a command's node boundaries in a configuration file, and the assembled body carries the prose that makes the agent the runtime for those declarations — running each boundary's attachments in declared order. A recipe may also override which nodes a command runs. Attachments referencing a boundary the active node set does not contain MUST warn and be skipped rather than silently doing nothing, and the whole mechanism inherits the never-fail-the-host contract.

#### Scenario: a project attaches work to a node boundary
- **WHEN** the command reaches that node
- **THEN** the project's attachments run in declared order at that boundary

#### Scenario: an attachment names a boundary that is not in the active node set
- **WHEN** the configuration is merged
- **THEN** it warns and skips rather than failing or silently ignoring

An assembled body SHALL carry an explicit marker at each node's start and end, and a coarser marker around each phase — a named group of consecutive nodes in the same order — so an attachment lands at a known point rather than being placed by guessing at surrounding prose, and so a project has somewhere coarser than a single node to attach to. A step's node order SHALL declare its phases over exactly those same node ids, in that same order, with the flat order remaining the authority on sequence.

Each node SHALL carry a human-readable name for the panel, and a step's declaration SHALL name the nodes it ships but does not run by default, along with which default node each of them stands in for — so swapping the spec draft for a delta draft or a bugfix draft is a pick rather than a rewrite. A node whose output the size budget may fold away SHALL declare that output as one it *may* write, not one it must, so a folded run is not reported as an incomplete one.

#### Scenario: a project attaches work to a phase
- **WHEN** the command reaches that phase's first node
- **THEN** the attachment runs there, without the project naming an individual node

#### Scenario: a run folds the design side files into the plan
- **WHEN** the run is checked against what it should have produced
- **THEN** the folded documents are not counted as missing

### A node can ship without running, so a project can be offered it rather than told about it

A step's order SHALL be able to name nodes it does not run by default. Those nodes stay in the tree, assemble like any other once a recipe names them, and are what the builder can offer from a list instead of a free-text box. This is how a behaviour whose value is not yet settled ships without being imposed: the alternative is either forcing it on every project or leaving it out of the tree, and the second means the decision has to be made before anyone can try it.

A node listed this way is off, not absent, and the distinction matters in both directions: it must not run unasked, and it must not quietly rot either, since it assembles with the rest and the same gates hold it to the same shape.

#### Scenario: a step declares a node it does not run
- **WHEN** the command is assembled with the default order
- **THEN** that node contributes nothing to the body

#### Scenario: a recipe names it
- **WHEN** the command is assembled
- **THEN** it assembles in like any other node

### A step's branch points are declared as data beside its node order

Where a step's node makes a routing decision, that decision SHALL be declared alongside the step's node order: which node decides, the verdicts it can reach, the steps each verdict folds away, and the notice each verdict prints. Stated only as prose — in the routing part, the workflow file, and the classifier's own instructions — the routing was changeable in none of them and drawable from none of them.

#### Scenario: a step declares its routing
- **WHEN** the pipeline is built or drawn
- **THEN** both read the same declaration rather than re-reading the prose

### The command inventory records what each command's run must produce

Alongside the command list, the shipped inventory SHALL record, per command, the artifacts a run is expected to produce and which node produces each — derived from the same node order the bodies were assembled from, and marking the ones a fold may legitimately skip. Without it, a step that quietly stopped writing its document is indistinguishable from one that wrote it.

#### Scenario: a run is checked against what it claimed
- **WHEN** the expected artifacts are read
- **THEN** they describe the pipeline that was actually assembled

## Uncovered

_None — re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
