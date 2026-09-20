# Capture runtime build — Living Spec

<!-- reviewed: a9c0b02b -->

## Purpose

The build renders a project's `companion.yml` into the command bodies the assistant reads, all-or-nothing, and reaches every agent's copy. A command is an ordered list of nodes with declared boundaries and phases, so a project attaches work at a known point.

## Requirements

### Each product ships every module its own entry points reach

A sibling module a shipped script imports MUST be on the packing list of every product that ships that script. The packing gate blocks a release when the declared list and the closure it derives from the shipped commands disagree in either direction.

#### Scenario: a script gains an import that is not listed
- **WHEN** a shipped script starts importing a sibling that is not on the packing list
- **THEN** the packing gate fails and names the missing module

#### Scenario: a listed script nothing reaches
- **WHEN** the packing list carries a script no shipped command reaches
- **THEN** the packing gate fails and names it as unreachable

### A capability left out of a build says so instead of reporting success

When a build lacks a module a step needs, the step MUST report that the capability is unavailable and that it did nothing.

#### Scenario: the fold runs without the resolver
- **WHEN** the living-spec fold runs where the capability resolver is missing
- **THEN** it prints that the resolver is unavailable and nothing was folded

### A build makes the assistant run the order and hooks companion.yml declares

#### Scenario: a project reorders a command's nodes and builds
- **WHEN** the build runs
- **THEN** the command body the assistant reads carries the project's order

### A build is all-or-nothing

Nothing is written until every command has assembled, so a failed build leaves the previous pipeline exactly as it was.

#### Scenario: one command fails to assemble
- **WHEN** the build stops
- **THEN** no command body on disk has changed

### A built body reaches the assistant only once it is carried out to the agent's own copy

The build MUST replace the body in each agent's installed copy, because the assistant loads those and not the extension's copy. The agent's frontmatter header stays untouched.

#### Scenario: a build finishes
- **WHEN** the emissions are synced
- **THEN** each agent's copy carries the new body under its unchanged frontmatter

### An agent file with no assembled body is never rewritten

The sync rewrites a file only when its current body carries the node markers of an assembled body, so a pointer file is not corrupted.

#### Scenario: an agent's copy is a pointer file
- **WHEN** the emissions are synced
- **THEN** the pointer file is byte-for-byte unchanged

### A hook is rendered at the node boundary it names

#### Scenario: a project attaches two hooks after a node
- **WHEN** the command body is assembled
- **THEN** both hooks' text appears at that node's boundary, in the order the configuration declares

### A skill hook invokes the skill by name instead of copying its text

#### Scenario: a project attaches a skill hook
- **WHEN** the command body is assembled
- **THEN** the body tells the assistant to invoke that skill and does not contain the skill's instructions

### The build manifest describes the node order that was assembled

The manifest of each author node's declared document is derived from the same order the build assembled, never from a hand-kept list.

#### Scenario: the node order changes
- **WHEN** the build runs
- **THEN** the manifest lists the documents of the pipeline that was assembled

### A project can reroute a classifier verdict and the body says so

#### Scenario: a project changes where a verdict routes
- **WHEN** the build resolves the routing
- **THEN** it applies the project's route and the body carries a note that the project changed it

### A template section is replaced by its heading

A step can use its template as is, replace one section addressed by its heading, or write something the template does not describe. No marker syntax is needed, so hand-edited templates keep working.

#### Scenario: a project replaces one section of the spec template
- **WHEN** the build resolves templates
- **THEN** the resolved copy carries the replacement under that heading and every other section unchanged

### The stock templates are never edited

The build writes resolved templates into the project's built output and leaves the stock copies alone.

#### Scenario: a project customizes a template and builds
- **WHEN** the build finishes
- **THEN** the stock template on disk is unchanged

### Projects extend commands at node boundaries, never by editing bodies

A project SHALL attach its own work to a command's node boundaries in its configuration, and the built body SHALL run each boundary's attachments in declared order. An attachment naming a boundary missing from the active node set MUST warn and be skipped, never fail the host.

#### Scenario: a project attaches work to a node boundary
- **WHEN** the command reaches that node
- **THEN** the project's attachments run there in declared order

#### Scenario: an attachment names a node the active order does not run
- **WHEN** the configuration is merged
- **THEN** a warning names the anchor and its attachments are skipped

### A project can attach work to a phase instead of a single node

Each step SHALL group its nodes into named phases covering exactly its node order, in the same sequence, and an attachment SHALL be able to name a phase.

#### Scenario: a project attaches work to a phase
- **WHEN** the command reaches that phase's boundary
- **THEN** the attachment runs there, without the project naming an individual node

### A node can ship without running, so a project can be offered it rather than told about it

A step SHALL be able to ship nodes it does not run by default. Such a node MUST NOT run unasked, assembles like any other once a recipe names it, and is held by the same gates so it does not rot.

#### Scenario: a step declares a node it does not run
- **WHEN** the command is assembled with the default order
- **THEN** that node contributes nothing to the body

#### Scenario: a recipe names it
- **WHEN** the command is assembled
- **THEN** it assembles like any other node

### A shipped variant names the default node it replaces

A step SHALL declare which default node each optional variant stands in for, such as the delta or bugfix spec drafts, so swapping one in is a pick and not a rewrite.

#### Scenario: a project picks the bugfix draft
- **WHEN** the builder offers the spec-drafting node's alternatives
- **THEN** the bugfix draft is listed as a replacement for the default draft

## Uncovered

- `build.py`, `assemble-nodes.py`, `check-shape-parity.py`, `_command_parts.py`: build-time tooling, covered by the companion-commands specs.
_None._
