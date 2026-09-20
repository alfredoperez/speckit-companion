# Capture runtime living resolve — Living Spec

<!-- reviewed: 2b4fbe2c -->

## Purpose

The resolver is the one reading of the living-specs registry: which capability owns a file, which requirements a change should read, and how a spec is sliced for a load. Every other tool calls it, so boundaries and markers mean the same thing everywhere. It also governs how the specify and plan steps load those requirements and the project's authored rules.

## Requirements

### Living-spec path resolution stops at a nested project boundary

A directory with its own companion config is a separate project.

#### Scenario: a sample project is nested in the tree
- **WHEN** discovery walks into a directory holding its own companion config
- **THEN** the walk stops and nothing inside is reported, claimed or promoted as the parent's

### A living-spec load is sliced by requirement, and a spec with no markers is read whole

A load hands over the purpose, the requirements whose marker matches a changed file, and every unmarked requirement, each with its own prose and scenarios. A marker can only narrow.

#### Scenario: a marked capability and a change it claims
- **WHEN** a load resolves a capability whose requirements carry markers
- **THEN** it reports the purpose plus the matching and unmarked requirements, not the whole file

#### Scenario: a capability with no markers
- **WHEN** a load resolves it
- **THEN** it is reported as read whole

### A load keeps fenced examples

A reader cannot tell that anything is missing.

#### Scenario: a requirement contains a fenced example
- **WHEN** the load payload is built
- **THEN** the example is still there

### A report that checked nothing never renders as clean

#### Scenario: a report runs where it cannot find the registry
- **WHEN** it renders
- **THEN** it says nothing was checked and why

### A capability whose markers all miss is still loaded with its purpose

Completion accounting has to see it.

#### Scenario: a change touches no file the capability's markers name
- **WHEN** a load resolves the capability
- **THEN** it appears with its purpose and its unmarked requirements only

### Markers are read below a blank line and never handed to the reader as prose

A marker run is the first non-blank lines under a heading, in any order.

#### Scenario: a formatter puts a blank line under the heading
- **WHEN** a load slices that requirement
- **THEN** the marker is still read, and no marker reaches the reader as prose

### A load follows `aligns` edges one hop, and only when asked

A requirement can name a constraining rule under another capability, which no file match would reach. Following is opt-in so a load's size stays predictable.

#### Scenario: a matched requirement names a rule under a capability the change did not touch
- **WHEN** a load is asked to follow the edges
- **THEN** that capability appears carrying only the named requirement, marked as reached by the edge

#### Scenario: the named requirement names an edge of its own
- **WHEN** the same load runs
- **THEN** the second edge is not followed

#### Scenario: the load is not asked to follow
- **WHEN** it runs
- **THEN** it contributes exactly what the file match resolved

### A registered capability with no spec file reports no spec, not zero requirements

#### Scenario: a capability is registered but its spec file is gone
- **WHEN** the resolver is asked for that capability's headings
- **THEN** it reports that there is no spec on disk

### An unmarked requirement matches every file its capability claims

#### Scenario: the resolver is asked which requirements match a file
- **WHEN** the file belongs to a capability with an unmarked requirement
- **THEN** that requirement is returned

### Asking who leans on a requirement returns every requirement aligned to it

A requirement leans on another when its `aligns` marker names that heading exactly, in any capability including the target's own. A disabled registry gives no matches.

#### Scenario: two capabilities align to one heading
- **WHEN** a command asks who leans on it
- **THEN** both requirements are returned

#### Scenario: nothing aligns to the heading
- **WHEN** a command asks who leans on it
- **THEN** no matches are returned

### The load steps read a living spec by requirement, and fall back to the whole file

The specify and plan load steps SHALL read only what the resolver says each capability contributes for the touched files. When the resolver is unavailable or its call fails, they SHALL read each loaded capability's spec whole and continue, because narrowing must never cost a step its brief.

#### Scenario: the resolver answers
- **WHEN** a load step runs against a capability with file markers
- **THEN** it reads that capability's purpose and the named requirements only

#### Scenario: the resolver is unavailable
- **WHEN** the call fails
- **THEN** the step reads the whole spec and continues without failing the command

### A load follows one hop to a rule that lives outside the change

The plan load and each implement worker's slice SHALL ask the resolver to follow requirement edges one hop, and MUST honour a rule reached that way even though it owns no touched file. Without the hop, a worker handed only its phase's files never sees the rule guarding the code it writes. Specify does not take the hop, since a wider brief does not change the spec it writes.

#### Scenario: a plan touches code governed by a rule elsewhere
- **WHEN** the plan load resolves requirements
- **THEN** the rule named by the edge is loaded alongside the file matches

#### Scenario: a worker is handed one phase of that change
- **WHEN** its slice is resolved
- **THEN** the same rule reaches the worker writing the code

### A project's authored guidance reaches the step it was written for

The specify and plan steps SHALL each read only their own step's rules from the registry and treat each line as guidance for the document they write. A registry with no rules SHALL behave exactly as before rules existed.

#### Scenario: a project authors rules for both steps
- **WHEN** a specify run loads living specs
- **THEN** it holds the specify rules and not the plan rules

#### Scenario: the rules cannot be read
- **WHEN** the rules block will not parse
- **THEN** the step runs unchanged and says once that the rules were skipped

## Uncovered

_None._
