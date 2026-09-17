# Living-Spec Commands — Living Spec

<!-- reviewed: d589a63e -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The commands that adopt, sync, validate, show and report on living specs are opt-in, honest about what they read, and never halt the run. This keeps a clean report from passing as a verdict on unread files, and a check from rewriting the spec it checks.

## Requirements

### Living-spec commands are opt-in, non-halting, and honest about what they did not examine

The adopt, move, drift and coverage commands SHALL act only when the project has opted in and SHALL never fail the run, and the drift and coverage reports SHALL make no edits. Their output MUST state what was examined and what was skipped with a reason. A finding is a signal for a surrounding workflow, and these commands do not gate.

#### Scenario: the project has not opted in
- **WHEN** one of these commands runs
- **THEN** it reports nothing and exits successfully

#### Scenario: part of the configured set could not be examined
- **WHEN** the report is rendered
- **THEN** it names both counts and the reason for the skip

### One command syncs every affected living spec from the current changes, uncommitted included

A sync command SHALL, in one pass, group the working tree's changes (uncommitted edits, deletions, untracked files, and commits since each spec's baseline) by capability, using the drift report's working-tree derivation, and update every affected capability spec in place. It SHALL update rather than regenerate, keeping content the change does not invalidate verbatim. It ends with a synced/skipped report, never commits, never redrafts a never-committed spec, and keeps the family's opt-in, never-halt contract.

#### Scenario: changes span several capabilities
- **WHEN** the sync runs with working-tree changes touching multiple capability areas
- **THEN** every affected capability's spec is updated, each scoped to its own changed files, with no hand-picking

#### Scenario: nothing is configured
- **WHEN** the sync runs with living specs disabled or absent
- **THEN** it reports nothing to do and exits successfully

### The shape check is a command, and it reports rather than gates
<!-- touches: speckit-extension/commands/speckit.companion.living-validate.md -->

The shape check SHALL act only when opted in, make no edits, and never fail the run. Given a capability it SHALL check only that spec, otherwise every living spec and every active feature spec's deltas, and its output MUST state what was examined and what was skipped with a reason, treating an unregistered capability name as a skip. The body SHALL NOT direct the assistant to edit a spec to satisfy a finding, because fixing is the author's decision.

#### Scenario: the command runs on a project with findings
- **WHEN** it reports
- **THEN** it names each finding's file, line and fix, and edits nothing

#### Scenario: the command is scoped to one capability
- **WHEN** it runs
- **THEN** only that capability's spec is counted as checked

#### Scenario: the named capability is not registered
- **WHEN** it reports
- **THEN** it lists the name as skipped and checks nothing

#### Scenario: living specs are off for the project
- **WHEN** the command runs
- **THEN** it says so and exits successfully

#### Scenario: the command is run from below the repository root
- **WHEN** it reports
- **THEN** it says nothing was checked and where the registry actually is, rather than the words it uses when the feature is genuinely off

### A spec that is still true can say so, and stop drifting

The drift report SHALL take an explicit per-capability acceptance that writes the commit the spec was read against into the spec itself, since committing it is what moves the drift baseline. Nothing SHALL write an acceptance on its own, because a review is a claim a person makes. Without acceptance, drift grows on every unchanged spec until everything is flagged.

#### Scenario: a spec is read and found correct
- **WHEN** its capability is accepted
- **THEN** the spec carries the commit it was read against, and its requirements are untouched

#### Scenario: the report runs
- **WHEN** drift is computed
- **THEN** no acceptance is recorded, because nobody read anything

### A living spec is readable one slice at a time, from a terminal

A read-only command SHALL print a capability's requirement headings, one named requirement with its scenarios, or the requirements whose file markers describe a path, using the load steps' requirement parser. Every outcome, including an unregistered capability, missing spec file, unmatched or ambiguous name, or unclaimed file, SHALL exit successfully with the alternatives named.

#### Scenario: a reader asks for one requirement
- **WHEN** the command is given a requirement heading that exists in exactly one capability
- **THEN** that requirement's prose and scenarios are printed and no other requirement is

#### Scenario: a heading names two capabilities
- **WHEN** the requested heading exists in more than one registered capability
- **THEN** every candidate is listed with its capability and none is chosen

#### Scenario: living specs are off
- **WHEN** the command runs in a project with no registry, or one that is disabled
- **THEN** it reports nothing and exits successfully

## Uncovered

_None. Re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
