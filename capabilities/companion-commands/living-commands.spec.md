# Living-Spec Commands — Living Spec

<!-- reviewed: d589a63e -->

## Purpose

The commands that adopt, sync, check, show and report on living specs are opt-in, never halt the run, and say what they did not examine, so a clean report is never mistaken for a verdict on files nobody read.

## Requirements

### Living-spec commands are opt-in, non-halting, and honest about what they did not examine

Every living-spec command except adopt, which is how a project opts in, SHALL do nothing on a project without an enabled registry, and none SHALL fail the run.

#### Scenario: the project has not opted in
- **WHEN** sync, drift, coverage, the shape check or show runs
- **THEN** it says there is nothing to do and exits successfully

### A living-spec report names what it skipped and why

The drift, coverage and shape-check reports SHALL state how much they examined and list each skipped item with its reason.

#### Scenario: part of the configured set could not be examined
- **WHEN** the report is rendered
- **THEN** it gives both counts and the reason for each skip

### Living-spec reports edit nothing

The drift, coverage and shape-check commands SHALL make no edits, and the shape check SHALL NOT tell the assistant to edit a spec to clear a finding, because fixing is the author's call.

#### Scenario: the shape check finds problems
- **WHEN** it reports
- **THEN** it names each finding's file, line and fix, and no file changes

### One command syncs every affected living spec from the current changes, uncommitted included

Sync SHALL group all working-tree changes (uncommitted edits, deletions, untracked files and commits since each spec's baseline) by capability and update every affected spec in one pass.

#### Scenario: changes span several capabilities
- **WHEN** sync runs
- **THEN** every affected capability's spec is updated, each from its own changed files, with no hand-picking

### Sync updates a spec in place rather than regenerating it

Sync SHALL keep verbatim any content the change does not invalidate, never commit, and never redraft a spec that has never been committed.

#### Scenario: a change touches one requirement's code
- **WHEN** sync updates that capability's spec
- **THEN** only that requirement changes and the rest of the file is byte-identical

### The shape check is a command, and it reports rather than gates
<!-- touches: apps/speckit-extension/commands/speckit.companion.living-validate.md -->

Given a capability, the shape check SHALL check only that spec, and an unregistered name is reported as skipped. Given none, it checks every living spec and every active feature spec's deltas.

#### Scenario: the command is scoped to one capability
- **WHEN** it runs
- **THEN** only that capability's spec is counted as checked

#### Scenario: the named capability is not registered
- **WHEN** it reports
- **THEN** it lists the name as skipped and checks nothing

### The shape check names a requirement too big to hold
<!-- touches: apps/speckit-extension/scripts/living_validate.py, apps/vscode/src/features/specs/specShapeCheck.ts -->

A requirement with more than 4 SHALL, MUST or SHOULD sentences, or more than 120 words before its first scenario, SHALL get a warning naming the split or the cut, in the command and in the editor alike.

#### Scenario: one heading states five rules
- **WHEN** the check runs
- **THEN** it warns that the requirement bundles five rules and says to split it

### The shape check flags a spec nobody has reviewed
<!-- touches: apps/speckit-extension/scripts/living_validate.py, apps/vscode/src/features/specs/specShapeCheck.ts -->

A spec still carrying its surface-draft banner SHALL get a warning until the banner is removed.

#### Scenario: a spec drafted from the code was never reviewed
- **WHEN** it still carries its `> [DRAFT]` banner
- **THEN** the check warns that nobody has reviewed it

### A spec that is still true can say so, and stop drifting

The drift report SHALL take an explicit per-capability acceptance that writes the commit the spec was read against into the spec itself, and nothing SHALL write one on its own, because a review is a claim a person makes.

#### Scenario: a spec is read and found correct
- **WHEN** its capability is accepted
- **THEN** the spec carries the commit it was read against, and its requirements are untouched

#### Scenario: the report runs
- **WHEN** drift is computed
- **THEN** no acceptance is recorded

### A living spec is readable one slice at a time, from a terminal

The show command SHALL print a capability's headings, one named requirement with its scenarios, or the requirements that describe a file. Every miss (unregistered capability, missing spec file, unmatched or ambiguous name, unclaimed file) SHALL exit successfully and name the alternatives.

#### Scenario: a reader asks for one requirement
- **WHEN** the heading exists in exactly one capability
- **THEN** that requirement's prose and scenarios are printed and nothing else

#### Scenario: a heading exists in two capabilities
- **WHEN** it is requested
- **THEN** every candidate is listed with its capability and none is chosen

## Uncovered

_None._
